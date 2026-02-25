import asyncio
import json
import os
import signal
import subprocess
import threading
import time
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

_MODEL_SIZE_MB: dict[str, int] = {m["name"]: m["size_mb"] for m in AVAILABLE_MODELS}

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


# ─── Model download with progress ────────────────────────────────────────────

def _download_model_with_progress(model_name: str, job_id: str, emit_fn) -> bool:
    """
    Download model from HuggingFace Hub while emitting SSE progress events.

    Emits:  {"type": "model_downloading", "model": ..., "percent": 0-100, "size_mb": ...}
    Returns True on success, False if job was cancelled.
    Raises RuntimeError on download failure.
    """
    from huggingface_hub import snapshot_download, HfApi

    repo_id = model_name if "/" in model_name else f"Systran/faster-whisper-{model_name}"
    size_mb = _MODEL_SIZE_MB.get(model_name, 0)

    # ── Try to get precise total size from HF API ─────────────────────────────
    total_bytes = 0
    try:
        api = HfApi()
        siblings = api.model_info(repo_id, timeout=10).siblings or []
        ALLOWED = (".json", ".bin", ".msgpack", ".txt", ".tiktoken", ".model")
        total_bytes = sum(
            (s.size or 0) for s in siblings
            if any(s.rfilename.endswith(ext) for ext in ALLOWED)
        )
        if total_bytes > 0:
            size_mb = round(total_bytes / 1_048_576)
    except Exception:
        # Network may be slow; fall back to known size
        total_bytes = size_mb * 1_048_576

    emit_fn({"type": "model_downloading", "model": model_name, "percent": 0, "size_mb": size_mb})

    # ── Start snapshot_download in a daemon thread ────────────────────────────
    dl_errors: list[Exception] = []

    def do_download():
        try:
            snapshot_download(
                repo_id,
                allow_patterns=["config.json", "tokenizer.json", "vocabulary.json",
                                 "*.bin", "*.msgpack"],
            )
        except Exception as e:
            dl_errors.append(e)

    dl_thread = threading.Thread(target=do_download, daemon=True)
    dl_thread.start()

    # ── Poll cache blobs directory for byte-level progress ────────────────────
    cache_root = os.environ.get(
        "HF_HOME", os.path.join(os.path.expanduser("~"), ".cache", "huggingface")
    )
    blobs_dir = os.path.join(
        cache_root, "hub",
        f"models--{repo_id.replace('/', '--')}",
        "blobs",
    )

    last_percent = -1
    while dl_thread.is_alive():
        # Honour cancellation
        if job_id in _cancelled_jobs:
            return False

        downloaded_bytes = 0
        if os.path.isdir(blobs_dir):
            for entry in os.scandir(blobs_dir):
                if entry.name.endswith(".lock"):
                    continue
                try:
                    downloaded_bytes += entry.stat().st_size
                except OSError:
                    pass

        percent = min(99, int(downloaded_bytes / total_bytes * 100)) if total_bytes > 0 else 0

        if percent != last_percent:
            emit_fn({"type": "model_downloading", "model": model_name,
                     "percent": percent, "size_mb": size_mb})
            last_percent = percent

        time.sleep(0.5)

    if dl_errors:
        raise RuntimeError(f"모델 다운로드 실패: {dl_errors[0]}")

    emit_fn({"type": "model_downloading", "model": model_name, "percent": 100, "size_mb": size_mb})
    return True


# ─── Anti-hallucination helpers ───────────────────────────────────────────────

# Base kwargs applied to every model.transcribe() call.
# Key changes vs. faster-whisper defaults:
#   condition_on_previous_text=False — prevents the model from feeding its own
#     previous output back as context, which is the #1 cause of runaway "Yeah. Yeah. Yeah."
#   temperature tuple — falls back to higher temperatures when low-T output is
#     unreliable (low log-prob or high compression ratio), breaking repetition loops
#   compression_ratio_threshold=2.4 — discards segments whose output is suspiciously
#     compressed (i.e. very repetitive text from the model)
_TRANSCRIBE_KWARGS_BASE: dict = {
    'beam_size': 5,
    'vad_filter': True,
    'condition_on_previous_text': False,
    'temperature': (0.0, 0.2, 0.4, 0.6, 0.8, 1.0),
    'compression_ratio_threshold': 2.4,
    'log_prob_threshold': -1.0,
    'no_speech_threshold': 0.6,
}


def _make_repeat_filter(max_consecutive: int = 4):
    """
    Return a stateful callable(text: str) -> bool.
    Returns True (keep) if the segment is not an obvious hallucination run.

    Logic: if the same normalised text appears more than max_consecutive times
    in a row, every subsequent occurrence is dropped until a different text appears.
    This catches "Yeah. Yeah. Yeah. …" without discarding genuine brief repetitions.
    """
    last_norm: list[str | None] = [None]
    count: list[int] = [0]

    def keep(text: str) -> bool:
        norm = text.strip().lower().rstrip('.,!?…;: ')
        if norm == last_norm[0]:
            count[0] += 1
        else:
            last_norm[0] = norm
            count[0] = 1
        return count[0] <= max_consecutive

    return keep


# ─── Core transcription helpers ───────────────────────────────────────────────

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
        **_TRANSCRIBE_KWARGS_BASE,
        'language': language if language else None,
    }
    if clip_timestamps is not None:
        kwargs['clip_timestamps'] = clip_timestamps

    segments, info = model.transcribe(file_path, **kwargs)
    repeat_filter = _make_repeat_filter()
    segment_list: list[dict] = []

    for seg in segments:
        if job_id in _cancelled_jobs:
            _cancelled_jobs.discard(job_id)
            _jobs[job_id].append({
                "type": "done",
                "language": info.language,
                "total_segments": len(segment_list),
                "cancelled": True,
            })
            return

        text = seg.text.strip()
        if not text or not repeat_filter(text):
            continue

        event = {
            "type": "segment",
            "id": str(len(segment_list)),
            "start": seg.start,
            "end": seg.end,
            "text": text,
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
    """
    duration = transcriber.get_audio_duration(file_path)

    # Short audio — no chunking needed
    if duration <= 0 or duration <= CHUNK_DURATION + OVERLAP:
        _do_transcription(job_id, model, file_path, language)
        return

    # ── Build chunk list ──────────────────────────────────────────────────────
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
    # Single repeat-filter shared across all chunks so runs spanning a boundary are caught
    repeat_filter = _make_repeat_filter()

    for chunk_idx, (clip_start, clip_end, boundary_start, is_last) in enumerate(chunks):
        boundary_end = boundary_start + CHUNK_DURATION

        try:
            print(
                f"[backend] chunk {chunk_idx + 1}/{len(chunks)}: "
                f"{clip_start:.0f}s–{clip_end:.0f}s "
                f"(keeping [{boundary_start:.0f}s, {'end' if is_last else f'{boundary_end:.0f}s'}])",
                flush=True,
            )
        except (BrokenPipeError, OSError):
            pass

        kwargs: dict = {
            **_TRANSCRIBE_KWARGS_BASE,
            'language': detected_language or (language if language else None),
            'clip_timestamps': f"{clip_start},{clip_end}",
        }

        segments, info = model.transcribe(file_path, **kwargs)

        if detected_language is None:
            detected_language = info.language

        for seg in segments:
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
            if seg.start < boundary_start:
                continue
            if not is_last and seg.start >= boundary_end:
                continue

            text = seg.text.strip()
            if not text or not repeat_filter(text):
                continue

            event = {
                "type": "segment",
                "id": str(len(all_segments)),
                "start": seg.start,
                "end": seg.end,
                "text": text,
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
            _do_transcription(job_id, m, file_path, language, start_ms, end_ms)
        else:
            _do_full_transcription(job_id, m, file_path, language)

    try:
        # ── Phase 1: Download model with progress if not cached ───────────────
        if not transcriber.is_model_downloaded(model_name):
            def emit_dl(event):
                _jobs[job_id].append(event)

            ok = _download_model_with_progress(model_name, job_id, emit_dl)
            if not ok:
                # Cancelled during download
                _cancelled_jobs.discard(job_id)
                _jobs[job_id].append({
                    "type": "done",
                    "language": "",
                    "total_segments": 0,
                    "cancelled": True,
                })
                return

        # ── Phase 2: Load model (instant when already cached) ─────────────────
        _jobs[job_id].append({"type": "model_loaded", "model": model_name})
        model = transcriber.load_model(model_name)

        # ── Phase 3: Transcribe ───────────────────────────────────────────────
        try:
            _run(model)
        except Exception as cuda_e:
            if _is_cuda_error(str(cuda_e)):
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
