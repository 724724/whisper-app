import ctypes
import subprocess

from faster_whisper import WhisperModel
import ctranslate2


def _safe_print(*args, **kwargs):
    """Print that silently ignores broken pipe errors (common in subprocess context)."""
    try:
        print(*args, **kwargs)
    except (BrokenPipeError, OSError):
        pass

_model: WhisperModel | None = None
_model_name: str | None = None
# None = not yet tested  |  True = CUDA works  |  False = CUDA unusable
_cuda_usable: bool | None = None


def _check_cuda_libs() -> bool:
    """Try to dlopen the CUDA 12 libraries that ctranslate2 actually needs."""
    for lib in ("libcublas.so.12", "libcudart.so.12"):
        try:
            ctypes.CDLL(lib)
        except OSError:
            _safe_print(f"[transcriber] {lib} not found — will use CPU.", flush=True)
            return False
    return True


def get_cuda_info() -> dict:
    global _cuda_usable
    try:
        gpu_count = ctranslate2.get_cuda_device_count()
    except Exception:
        gpu_count = 0

    if gpu_count > 0 and _cuda_usable is None:
        _cuda_usable = _check_cuda_libs()

    cuda_available = gpu_count > 0 and (_cuda_usable is True)
    gpu_name = None
    if cuda_available:
        try:
            result = subprocess.run(
                ["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"],
                capture_output=True, text=True, timeout=5,
            )
            if result.returncode == 0:
                gpu_name = result.stdout.strip().split("\n")[0]
        except Exception:
            gpu_name = "Unknown GPU"
    return {"cuda_available": cuda_available, "gpu_name": gpu_name}


def load_model(model_name: str) -> WhisperModel:
    global _model, _model_name

    if _model is not None and _model_name == model_name:
        return _model

    cuda_info = get_cuda_info()

    if cuda_info["cuda_available"]:
        _safe_print(f"[transcriber] Loading '{model_name}' on CUDA (float16)...", flush=True)
        _model = WhisperModel(model_name, device="cuda", compute_type="float16")
    else:
        _safe_print(f"[transcriber] Loading '{model_name}' on CPU (int8)...", flush=True)
        _model = WhisperModel(model_name, device="cpu", compute_type="int8")

    _model_name = model_name
    return _model


def disable_cuda() -> None:
    """Call this when a CUDA error occurs during inference to force future loads to CPU."""
    global _model, _model_name, _cuda_usable
    _cuda_usable = False
    _model = None
    _model_name = None


def get_loaded_model_name() -> str | None:
    return _model_name


def unload_model() -> None:
    global _model, _model_name
    _model = None
    _model_name = None


def is_model_downloaded(model_name: str) -> bool:
    """Return True if the model is already present in the HuggingFace Hub cache."""
    repo_id = model_name if "/" in model_name else f"Systran/faster-whisper-{model_name}"

    # Primary check: use huggingface_hub cache API (fast, no network)
    try:
        from huggingface_hub import try_to_load_from_cache
        result = try_to_load_from_cache(repo_id, "config.json")
        if isinstance(result, str):
            return True
    except (ImportError, Exception):
        pass

    # Fallback: inspect cache directory directly
    try:
        import os
        cache_root = os.environ.get(
            "HF_HOME", os.path.join(os.path.expanduser("~"), ".cache", "huggingface")
        )
        snapshots_dir = os.path.join(
            cache_root, "hub", f"models--{repo_id.replace('/', '--')}", "snapshots"
        )
        for snap in os.listdir(snapshots_dir):
            if os.path.isfile(os.path.join(snapshots_dir, snap, "config.json")):
                return True
    except Exception:
        pass

    return False


def get_audio_duration(file_path: str) -> float:
    """Return the duration of an audio/video file in seconds using PyAV (bundled with faster-whisper)."""
    try:
        import av
        with av.open(file_path) as container:
            if container.duration is not None:
                # container.duration is in microseconds
                return container.duration / 1_000_000
            # Fallback: sum stream durations
            for stream in container.streams:
                if stream.duration and stream.time_base:
                    return float(stream.duration * stream.time_base)
        return 0.0
    except Exception:
        return 0.0
