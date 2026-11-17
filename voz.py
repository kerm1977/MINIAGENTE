"""Transcripción de voz local con faster-whisper (gratis, sin nube)."""
import os
import tempfile

_model = None
MODEL_NAME = os.environ.get("WHISPER_MODEL", "base")


def _patch_av_open():
    """PyAV nuevo no acepta metadata_errors (faster-whisper sí lo pasa)."""
    try:
        import av
    except Exception:
        return
    orig = av.open
    if getattr(orig, "_mini_agent_patch", False):
        return

    def open_compat(*args, **kwargs):
        kwargs.pop("metadata_errors", None)
        return orig(*args, **kwargs)

    open_compat._mini_agent_patch = True
    av.open = open_compat


_patch_av_open()


def _get_model():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel
        _model = WhisperModel(MODEL_NAME, device="cpu", compute_type="int8")
    return _model


def transcribe(file_obj, lang="es"):
    """file_obj: archivo o file-like (webm/ogg/mp3/wav). Devuelve texto."""
    suffix = ".webm"
    name = getattr(file_obj, "filename", "") or ""
    if "." in name:
        suffix = "." + name.rsplit(".", 1)[1]
    fd, path = tempfile.mkstemp(suffix=suffix)
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(file_obj.read() if hasattr(file_obj, "read") else file_obj)
        segments, _ = _get_model().transcribe(
            path, language=lang, beam_size=1, vad_filter=False
        )
        return " ".join(s.text.strip() for s in segments).strip()
    finally:
        os.unlink(path)
