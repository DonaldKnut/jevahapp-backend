"""Env-driven Content Guardian configuration."""
from __future__ import annotations

import os


def _env_bool(name: str, default: bool = True) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


HOST = os.getenv("GUARDIAN_HOST", "0.0.0.0")
PORT = int(os.getenv("GUARDIAN_PORT", "8091"))

ENABLE_WHISPER = _env_bool("GUARDIAN_ENABLE_WHISPER", True)
ENABLE_NUDENET = _env_bool("GUARDIAN_ENABLE_NUDENET", True)
ENABLE_CLIP = _env_bool("GUARDIAN_ENABLE_CLIP", True)

WHISPER_MODEL = os.getenv("GUARDIAN_WHISPER_MODEL", "base")
WHISPER_DEVICE = os.getenv("GUARDIAN_WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE = os.getenv("GUARDIAN_WHISPER_COMPUTE", "int8")

CLIP_MODEL = os.getenv("GUARDIAN_CLIP_MODEL", "ViT-B-32")
CLIP_PRETRAINED = os.getenv("GUARDIAN_CLIP_PRETRAINED", "openai")

# Fusion thresholds (mirrored in Node gospelFusion for defense in depth)
NSFW_REJECT = _env_float("GUARDIAN_NSFW_REJECT", 0.65)
NSFW_SAFE = _env_float("GUARDIAN_NSFW_SAFE", 0.25)
CHRISTIAN_SCENE_APPROVE = _env_float("GUARDIAN_CHRISTIAN_SCENE_APPROVE", 0.55)
GOSPEL_SCENE_APPROVE = _env_float("GUARDIAN_GOSPEL_SCENE_APPROVE", 0.55)
GOSPEL_TEXT_STRONG = _env_float("GUARDIAN_GOSPEL_TEXT_STRONG", 0.70)
GOSPEL_TEXT_WEAK = _env_float("GUARDIAN_GOSPEL_TEXT_WEAK", 0.30)
SECULAR_SCENE_REJECT = _env_float("GUARDIAN_SECULAR_SCENE_REJECT", 0.55)
SECULAR_SCENE_SAFE = _env_float("GUARDIAN_SECULAR_SCENE_SAFE", 0.45)
ANTI_GOSPEL_REJECT = _env_float("GUARDIAN_ANTI_GOSPEL_REJECT", 0.50)

MAX_FRAMES = int(os.getenv("GUARDIAN_MAX_FRAMES", "8"))
MAX_AUDIO_SCORE_BYTES = int(os.getenv("GUARDIAN_MAX_AUDIO_SCORE_BYTES", str(8 * 1024 * 1024)))
