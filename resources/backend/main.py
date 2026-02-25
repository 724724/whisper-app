import asyncio
import json
import signal
import subprocess
import traceback
import uuid
from typing import AsyncGenerator

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import transcriber

# Prevent SIGPIPE from crashing the server when a client disconnects mid-stream
try:
    signal.signal(signal.SIGPIPE, signal.SIG_IGN)
except AttributeError:
    pass  # Windows

app = FastAPI(title="Whisper App Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory job store: job_id -> list of SSE event dicts (or "done"/"error")
_jobs: dict[str, list[dict]] = {}
_job_done: dict[str, asyncio.Event] = {}
_cancelled_jobs: set[str] = set()

AVAILABLE_MODELS = [
    {"name": "tiny", "size_mb": 75},
    {"name": "base", "size_mb": 145},
    {"name": "small", "size_mb": 466},
    {"name": "medium", "size_mb": 1500},
    {"name": "large-v2", "size_mb": 2900},
    {"name": "large-v3", "size_mb": 2900},
]

# Chunked transcription constants
CHUNK_DURATION = 900.0   # 15 minutes per chunk
OVERLAP = 15.0           # 15-second overlap on each side of a boundary


# ─── Health ──────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    cuda_info = transcriber.get_cuda_info()
    return {
        "status": "ok",
        "cuda_available": cuda_info["cuda_available"],
        "gpu_name": cuda_info["gpu_name"],
        "model_loaded": transcriber.get_loaded_model_name(),
    }


# ─── Models ──────────────────────────────────────────────────────────────────

@app.get("/models")
def list_models():
    return AVAILABLE_MODELS


class LoadModelRequest(BaseModel):
    model: str


@app.post("/models/load")
def load_model(req: LoadModelRequest):
    try:
        transcriber.load_model(req.model)
        return {"success": True, "model": req.model}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Usage ───────────────────────────────────────────────────────────────────

@app.get("/usage")
def get_usage():
    cuda_info = transcriber.get_cuda_info()
    if cuda_info["cuda_available"]:
        try:
            r = subprocess.run(
                ["nvidia-smi", "--query-gpu=utilization.gpu", "--format=csv,noheader,nounits"],
                capture_output=True, text=True, timeout=2,
            )
            percent = int(r.stdout.strip().split("\n")[0]) if r.returncode == 0 else None
        except Exception:
            percent = None
        return {"type": "gpu", "percent": percent}
    else:
        import psutil
        return {"type": "cpu", "percent": round(psutil.cpu_percent(interval=0.1))}


# ─── Transcription ───────────────────────────────────────────────────────────

class TranscribeRequest(BaseModel):
    file_path: str
    model: str = "base"
    language: str | None = None
    start_ms: int | None = None
    end_ms: int | None = None


@app.post("/transcribe")
async def start_transcribe(req: TranscribeRequest):
    job_id = str(uuid.uuid4())
    _jobs[job_id] = []
    event = asyncio.Event()
    _job_done[job_id] = event

    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, _run_transcription, job_id, req.file_path, req.model, req.language, req.start_ms, req.end_ms)

    return {"job_id": job_id}


@app.delete("/transcribe/{job_id}")
async def cancel_transcription(job_id: str):
    """Signal the transcription worker to stop after the current segment."""
    _cancelled_jobs.add(job_id)
    return {"cancelled": True}


def _do_transcription(
    job_id: str,
    model,
    file_path: str,
    language: str | None,
    start_ms: int | None = None,
    end_ms: int | None = None,
) -> None:
    """
    Transcribe a specific clip (used for per-segment retranscription).
    Emits SSE events directly to _jobs[job_id].
    """
    clip_timestamps = None
    if start_ms is not None:
        start_sec = start_ms / 1000.0
        end_sec = end_ms / 1000.0 if end_ms is not None else None
        clip_timestamps = f"{start_sec},{end_sec}" if end_sec is not None else str(start_sec)

    kwargs: dict = {
        'beam_size': 5,
        'language': language if language else None,
        'vad_filter': True,
    }
    if clip_timestamps is not None:
        kwargs['clip_timestamps'] = clip_timestamps

    segments, info = model.transcribe(file_path, **kwargs)
    segment_list = []
    for i, seg in enumerate(segments):
        if job_id in _cancelled_jobs:
            _cancelled_jobs.discard(job_id)
            _jobs[job_id].append({
                "type": "done",
                "language": info.language,
                "total_segments": len(segment_list),
                "cancelled": True,
            })
            return

        event = {
            "type": "segment",
            "id": str(i),
            "start": seg.start,
            "end": seg.end,
            "text": seg.text.strip(),
        }
        _jobs[job_id].append(event)
        segment_list.append(event)

    _jobs[job_id].append({
        "type": "done",
        "language": info.language,
        "total_segments": len(segment_list),
    })


def _do_full_transcription(job_id: str, model, file_path: str, language: str | None) -> None:
    """
    Transcribe an entire file, using 15-minute chunks with 15-second overlap to
    prevent Whisper hallucination on long audio (≥15 min).

    Strategy:
      - Each chunk is fed to the model with OVERLAP seconds of audio before and
        after its "responsibility zone" (= the boundary zone it owns).
      - Only segments whose start time falls inside the responsibility zone are
        kept. Segments in the overlap region appear in two consecutive chunks but
        are emitted only by the chunk that owns the boundary.
      - The language detected in chunk 0 is reused for all subsequent chunks.
    """
    duration = transcriber.get_audio_duration(file_path)

    # Short audio — no chunking needed
    if duration <= 0 or duration <= CHUNK_DURATION + OVERLAP:
        _do_transcription(job_id, model, file_path, language)
        return

    # ── Build chunk list ──────────────────────────────────────────────────────
    # Each entry: (clip_start, clip_end, boundary_start, is_last)
    #   clip_*      = what we feed to the model (includes overlap)
    #   boundary_*  = which output segment start times we actually keep
    chunks: list[tuple[float, float, float, bool]] = []
    i = 0
    while True:
        boundary_start = i * CHUNK_DURATION
        if boundary_start >= duration:
            break
        clip_start = max(0.0, boundary_start - OVERLAP)
        clip_end   = boundary_start + CHUNK_DURATION + OVERLAP
        is_last    = clip_end >= duration
        chunks.append((clip_start, min(clip_end, duration), boundary_start, is_last))
        i += 1

    # ── Transcribe each chunk ─────────────────────────────────────────────────
    all_segments: list[dict] = []
    detected_language: str | None = None

    for chunk_idx, (clip_start, clip_end, boundary_start, is_last) in enumerate(chunks):
        boundary_end = boundary_start + CHUNK_DURATION

        try:
            print(
                f"[backend] chunk {chunk_idx + 1}/{len(chunks)}: "
                f"{clip_start:.0f}s – {clip_end:.0f}s "
                f"(keeping [{boundary_start:.0f}s, {'end' if is_last else f'{boundary_end:.0f}s'}])",
                flush=True,
            )
        except (BrokenPipeError, OSError):
            pass

        kwargs: dict = {
            'beam_size': 5,
            # Pass detected language to subsequent chunks (faster + consistent)
            'language': detected_language or (language if language else None),
            'vad_filter': True,
            'clip_timestamps': f"{clip_start},{clip_end}",
        }

        segments, info = model.transcribe(file_path, **kwargs)

        # Capture language from first chunk
        if detected_language is None:
            detected_language = info.language

        for seg in segments:
            # Honour cancellation requests between segments
            if job_id in _cancelled_jobs:
                _cancelled_jobs.discard(job_id)
                _jobs[job_id].append({
                    "type": "done",
                    "language": detected_language or "unknown",
                    "total_segments": len(all_segments),
                    "cancelled": True,
                })
                return

            # ── Boundary filter ───────────────────────────────────────────────
            # Discard segments that belong to the overlap zone of an adjacent chunk.
            if seg.start < boundary_start:
                continue  # Overlap before: owned by the previous chunk
            if not is_last and seg.start >= boundary_end:
                continue  # Overlap after: owned by the next chunk

            event = {
                "type": "segment",
                "id": str(len(all_segments)),
                "start": seg.start,
                "end": seg.end,
                "text": seg.text.strip(),
            }
            _jobs[job_id].append(event)
            all_segments.append(event)

    _jobs[job_id].append({
        "type": "done",
        "language": detected_language or "unknown",
        "total_segments": len(all_segments),
    })


def _is_cuda_error(msg: str) -> bool:
    m = msg.lower()
    return "libcublas" in m or "libcudart" in m or (
        "cuda" in m and ("library" in m or "not found" in m or "cannot be loaded" in m)
    )


def _run_transcription(
    job_id: str,
    file_path: str,
    model_name: str,
    language: str | None,
    start_ms: int | None = None,
    end_ms: int | None = None,
):
    def _run(m):
        if start_ms is not None:
            # Segment retranscription: transcribe only the specified clip, no chunking
            _do_transcription(job_id, m, file_path, language, start_ms, end_ms)
        else:
            # Full-file transcription: auto-chunk long audio to prevent hallucination
            _do_full_transcription(job_id, m, file_path, language)

    try:
        model = transcriber.load_model(model_name)
        try:
            _run(model)
        except Exception as cuda_e:
            if _is_cuda_error(str(cuda_e)):
                # CUDA runtime failed during inference — fall back to CPU and retry
                try:
                    print(f"[backend] CUDA inference failed: {cuda_e}. Retrying on CPU...", flush=True)
                except (BrokenPipeError, OSError):
                    pass
                transcriber.disable_cuda()
                model = transcriber.load_model(model_name)
                _jobs[job_id] = []
                _run(model)
            else:
                raise
    except Exception as e:
        tb = traceback.format_exc()
        try:
            print(f"[backend] transcription error:\n{tb}", flush=True)
        except (BrokenPipeError, OSError):
            pass
        _jobs[job_id].append({"type": "error", "message": f"{e}\n\n{tb}"})
    finally:
        _job_done[job_id].set()


@app.get("/transcribe/{job_id}/stream")
async def stream_transcription(job_id: str):
    if job_id not in _jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    async def event_generator() -> AsyncGenerator[str, None]:
        sent_index = 0
        while True:
            events = _jobs.get(job_id, [])
            while sent_index < len(events):
                ev = events[sent_index]
                yield f"data: {json.dumps(ev)}\n\n"
                sent_index += 1
                if ev["type"] in ("done", "error"):
                    # Clean up job after streaming
                    _jobs.pop(job_id, None)
                    _job_done.pop(job_id, None)
                    return
            await asyncio.sleep(0.1)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
