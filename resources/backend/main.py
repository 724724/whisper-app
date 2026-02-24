import asyncio
import json
import signal
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


# ─── Transcription ───────────────────────────────────────────────────────────

class TranscribeRequest(BaseModel):
    file_path: str
    model: str = "base"
    language: str | None = None


@app.post("/transcribe")
async def start_transcribe(req: TranscribeRequest):
    job_id = str(uuid.uuid4())
    _jobs[job_id] = []
    event = asyncio.Event()
    _job_done[job_id] = event

    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, _run_transcription, job_id, req.file_path, req.model, req.language)

    return {"job_id": job_id}


@app.delete("/transcribe/{job_id}")
async def cancel_transcription(job_id: str):
    """Signal the transcription worker to stop after the current segment."""
    _cancelled_jobs.add(job_id)
    return {"cancelled": True}


def _do_transcription(job_id: str, model, file_path: str, language: str | None) -> None:
    """Run the transcription loop and append events to _jobs[job_id]."""
    segments, info = model.transcribe(
        file_path,
        beam_size=5,
        language=language if language else None,
        vad_filter=True,
    )
    segment_list = []
    for i, seg in enumerate(segments):
        # Check for user-initiated cancellation between segments
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


def _is_cuda_error(msg: str) -> bool:
    m = msg.lower()
    return "libcublas" in m or "libcudart" in m or (
        "cuda" in m and ("library" in m or "not found" in m or "cannot be loaded" in m)
    )


def _run_transcription(job_id: str, file_path: str, model_name: str, language: str | None):
    try:
        model = transcriber.load_model(model_name)
        try:
            _do_transcription(job_id, model, file_path, language)
        except Exception as cuda_e:
            if _is_cuda_error(str(cuda_e)):
                # CUDA runtime failed during inference — fall back to CPU and retry
                try:
                    print(f"[backend] CUDA inference failed: {cuda_e}. Retrying on CPU...", flush=True)
                except (BrokenPipeError, OSError):
                    pass
                transcriber.disable_cuda()
                model = transcriber.load_model(model_name)
                # Clear any partial events already added
                _jobs[job_id] = []
                _do_transcription(job_id, model, file_path, language)
            else:
                raise
    except Exception as e:
        tb = traceback.format_exc()
        print(f"[backend] transcription error:\n{tb}", flush=True)
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
