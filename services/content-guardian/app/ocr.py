"""
Frame OCR for on-screen Scripture, lyrics, and sermon slides.
Uses Tesseract when available; fails soft if missing (Node still has STT + vision).
"""
from __future__ import annotations

import base64
import logging
import re
from io import BytesIO
from typing import Iterable, Optional

from . import config

logger = logging.getLogger("content-guardian.ocr")

_ocr_ready: Optional[bool] = None


def _tesseract_available() -> bool:
    global _ocr_ready
    if _ocr_ready is not None:
        return _ocr_ready
    try:
        import pytesseract  # noqa: F401
        from PIL import Image  # noqa: F401

        # Probe binary
        pytesseract.get_tesseract_version()
        _ocr_ready = True
    except Exception as exc:  # pragma: no cover - env dependent
        logger.warning("Frame OCR unavailable: %s", exc)
        _ocr_ready = False
    return bool(_ocr_ready)


def ocr_status() -> dict:
    return {
        "available": _tesseract_available(),
        "enabled": bool(getattr(config, "ENABLE_OCR", True)),
        "max_frames": int(getattr(config, "OCR_MAX_FRAMES", 8)),
    }


def _decode_data_url(data_url: str) -> Optional[bytes]:
    if not data_url:
        return None
    raw = data_url
    if "," in data_url and data_url.strip().lower().startswith("data:"):
        raw = data_url.split(",", 1)[1]
    try:
        return base64.b64decode(raw, validate=False)
    except Exception:
        return None


def _ocr_image_bytes(data: bytes) -> str:
    import pytesseract
    from PIL import Image, ImageOps, ImageFilter

    img = Image.open(BytesIO(data))
    # Upscale small slides so verse text is readable
    w, h = img.size
    if max(w, h) < 900:
        scale = 900 / max(w, h)
        img = img.resize((int(w * scale), int(h * scale)))
    gray = ImageOps.grayscale(img)
    gray = ImageOps.autocontrast(gray)
    gray = gray.filter(ImageFilter.SHARPEN)
    text = pytesseract.image_to_string(gray, lang="eng") or ""
    text = re.sub(r"\s+", " ", text).strip()
    return text


def extract_text_from_frames(
    frames: Iterable[str] | None,
    *,
    max_frames: int | None = None,
) -> dict:
    """
    OCR up to max_frames data-URL / base64 images.
    Returns { text, frame_count, available, signals }.
    """
    enabled = bool(getattr(config, "ENABLE_OCR", True))
    cap = int(max_frames or getattr(config, "OCR_MAX_FRAMES", 8))
    if not enabled:
        return {
            "text": "",
            "frame_count": 0,
            "available": False,
            "signals": ["ocr_disabled"],
        }
    if not _tesseract_available():
        return {
            "text": "",
            "frame_count": 0,
            "available": False,
            "signals": ["ocr_unavailable"],
        }

    texts: list[str] = []
    scored = 0
    for frame in list(frames or [])[:cap]:
        blob = _decode_data_url(frame)
        if not blob:
            continue
        try:
            t = _ocr_image_bytes(blob)
            scored += 1
            if t and len(t) >= 3:
                texts.append(t)
        except Exception as exc:
            logger.debug("OCR frame failed: %s", exc)

    merged = " ".join(texts)
    # Dedup near-identical slide repeats
    if len(merged) > 40:
        parts = [p.strip() for p in re.split(r"(?<=[.!?])\s+", merged) if p.strip()]
        seen: set[str] = set()
        uniq: list[str] = []
        for p in parts:
            key = p.lower()[:80]
            if key in seen:
                continue
            seen.add(key)
            uniq.append(p)
        merged = " ".join(uniq)

    signals = ["frame_ocr"]
    if merged:
        signals.append("frame_ocr_text")
    return {
        "text": merged[:8000],
        "frame_count": scored,
        "available": True,
        "signals": signals,
    }
