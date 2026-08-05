"""Local speech-to-text via faster-whisper."""
from __future__ import annotations

import logging
import os
import tempfile
from typing import Optional

from . import config

logger = logging.getLogger("content-guardian.whisper")

_model = None
_failed = False


def _load_model():
    global _model, _failed
    if _failed or not config.ENABLE_WHISPER:
        return None
    if _model is not None:
        return _model
    try:
        from faster_whisper import WhisperModel

        _model = WhisperModel(
            config.WHISPER_MODEL,
            device=config.WHISPER_DEVICE,
            compute_type=config.WHISPER_COMPUTE,
        )
        logger.info(
            "faster-whisper loaded model=%s device=%s",
            config.WHISPER_MODEL,
            config.WHISPER_DEVICE,
        )
        return _model
    except Exception as e:
        logger.warning("faster-whisper unavailable: %s", e)
        _failed = True
        return None


def transcribe_bytes(
    audio: bytes,
    filename: str = "audio.wav",
    language: Optional[str] = None,
) -> dict:
    """
    Transcribe audio bytes. Returns transcript, confidence, language.
    """
    model = _load_model()
    if model is None:
        return {
            "transcript": "",
            "confidence": 0.0,
            "language": language or "unknown",
            "available": False,
        }

    suffix = os.path.splitext(filename)[1] or ".wav"
    path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(audio)
            path = tmp.name

        segments, info = model.transcribe(
            path,
            language=language,
            beam_size=3,
            vad_filter=True,
        )
        parts: list[str] = []
        probs: list[float] = []
        for seg in segments:
            if seg.text:
                parts.append(seg.text.strip())
            if getattr(seg, "avg_logprob", None) is not None:
                # map logprob ~[-1,0] to rough confidence
                probs.append(max(0.0, min(1.0, 1.0 + float(seg.avg_logprob))))

        transcript = " ".join(parts).strip()
        conf = sum(probs) / len(probs) if probs else (0.7 if transcript else 0.0)
        lang = getattr(info, "language", None) or language or "unknown"
        return {
            "transcript": transcript,
            "confidence": round(conf, 4),
            "language": lang,
            "available": True,
        }
    except Exception as e:
        logger.error("Transcription failed: %s", e)
        return {
            "transcript": "",
            "confidence": 0.0,
            "language": language or "unknown",
            "available": True,
            "error": str(e)[:200],
        }
    finally:
        if path:
            try:
                os.unlink(path)
            except OSError:
                pass


def whisper_status() -> dict:
    return {
        "enabled": config.ENABLE_WHISPER,
        "failed": _failed,
        "loaded": _model is not None,
        "model": config.WHISPER_MODEL,
    }
