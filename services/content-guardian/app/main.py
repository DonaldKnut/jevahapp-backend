"""
Jevah Content Guardian — local STT + vision + OCR + gospel lexicon scoring.
AI (Gemini) is NOT used here; Node calls this first, Gemini only for gray zones.
"""
from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import FastAPI, File, Form, UploadFile
from pydantic import BaseModel, Field

from . import config
from . import ocr as frame_ocr
from . import text_score
from . import vision
from . import whisper_stt

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("content-guardian")

app = FastAPI(
    title="Jevah Content Guardian",
    version="1.1.0",
    description="Gospel-first upload scoring without cloud AI (STT + vision + OCR)",
)


class ScoreRequest(BaseModel):
    title: str = ""
    description: str = ""
    transcript: str = ""
    content_type: str = "videos"
    thumbnail: Optional[str] = None
    frames: List[str] = Field(default_factory=list)
    run_vision: bool = True
    run_ocr: bool = True


class ScoreResponse(BaseModel):
    gospel_score: float
    anti_gospel_score: float
    secular_text_score: float
    nsfw_score: float
    christian_scene_score: float
    secular_scene_score: float
    violence_score: float = 0.0
    gore_score: float = 0.0
    weapons_score: float = 0.0
    drugs_score: float = 0.0
    sexual_scene_score: float = 0.0
    decision_hint: str
    confidence: float
    signals: List[str]
    transcript: str = ""
    ocr_text: str = ""
    gospel_hits: List[str] = Field(default_factory=list)
    anti_hits: List[str] = Field(default_factory=list)
    frame_count_scored: int = 0
    provider: str = "content-guardian"
    vision_available: bool = True
    stt_available: bool = True
    ocr_available: bool = True


class OcrRequest(BaseModel):
    frames: List[str] = Field(default_factory=list)
    max_frames: Optional[int] = None


@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "content-guardian",
        "version": "1.1.0",
        "whisper": whisper_stt.whisper_status(),
        "vision": vision.vision_status(),
        "ocr": frame_ocr.ocr_status(),
        "thresholds": {
            "nsfw_reject": config.NSFW_REJECT,
            "gospel_text_strong": config.GOSPEL_TEXT_STRONG,
            "gospel_text_weak": config.GOSPEL_TEXT_WEAK,
        },
    }


@app.post("/v1/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
):
    data = await file.read()
    result = whisper_stt.transcribe_bytes(
        data,
        filename=file.filename or "audio.wav",
        language=language or None,
    )
    return result


@app.post("/v1/ocr")
def ocr_frames(body: OcrRequest):
    """OCR on-screen Scripture / lyrics from sampled video frames."""
    result = frame_ocr.extract_text_from_frames(
        body.frames,
        max_frames=body.max_frames,
    )
    return result


@app.post("/v1/score-audio")
async def score_audio(
    file: UploadFile = File(...),
    title: str = Form(""),
    description: str = Form(""),
    content_type: str = Form("music"),
    language: Optional[str] = Form(None),
):
    """
    Creator / CF audio path: Whisper STT + gospel lexicon (no vision).
    Contabo-safe — Node should cap upload size (~8MB sample).
    """
    max_bytes = int(getattr(config, "MAX_AUDIO_SCORE_BYTES", 8 * 1024 * 1024))
    data = await file.read()
    if len(data) > max_bytes:
        data = data[:max_bytes]

    tr = whisper_stt.transcribe_bytes(
        data,
        filename=file.filename or "audio.mp3",
        language=language or None,
    )
    transcript = (tr.get("transcript") or "").strip()
    stt_ok = bool(tr.get("available", True)) and len(transcript) > 0

    body = ScoreRequest(
        title=title or "",
        description=description or "",
        transcript=transcript,
        content_type=content_type or "music",
        run_vision=False,
        run_ocr=False,
    )
    scored = score(body)
    scored.transcript = transcript
    scored.stt_available = stt_ok
    scored.vision_available = False
    scored.ocr_available = False
    if not stt_ok:
        scored.signals = list(
            dict.fromkeys(list(scored.signals) + ["stt_unavailable_or_empty"])
        )
        if scored.decision_hint == "approve":
            scored.decision_hint = "review"
            scored.confidence = min(scored.confidence, 0.45)
    return scored


@app.post("/v1/score", response_model=ScoreResponse)
def score(body: ScoreRequest):
    ocr_text = ""
    ocr_signals: list[str] = []
    ocr_available = True

    if body.run_ocr and body.frames:
        ocr_result = frame_ocr.extract_text_from_frames(body.frames)
        ocr_text = (ocr_result.get("text") or "").strip()
        ocr_signals = list(ocr_result.get("signals") or [])
        ocr_available = bool(ocr_result.get("available", True))
    elif body.run_ocr:
        ocr_available = bool(frame_ocr.ocr_status().get("available"))

    # Merge OCR into spoken body so silent Scripture slides score as gospel
    spoken_body = f"{body.transcript or ''} {ocr_text}".strip()
    text = text_score.score_text(body.title, body.description, spoken_body)

    nsfw = 0.0
    christian = 0.0
    secular_scene = 0.0
    violence = 0.0
    gore = 0.0
    weapons = 0.0
    drugs = 0.0
    sexual_scene = 0.0
    frame_count = 0
    vision_signals: list[str] = []
    vision_available = True

    if body.run_vision and (body.thumbnail or body.frames):
        v = vision.score_vision(body.thumbnail, body.frames or None)
        nsfw = float(v["nsfw_score"])
        christian = float(v["christian_scene_score"])
        secular_scene = float(v["secular_scene_score"])
        violence = float(v.get("violence_score") or 0)
        gore = float(v.get("gore_score") or 0)
        weapons = float(v.get("weapons_score") or 0)
        drugs = float(v.get("drugs_score") or 0)
        sexual_scene = float(v.get("sexual_scene_score") or 0)
        frame_count = int(v["frame_count_scored"])
        vision_signals = list(v.get("signals") or [])
        vision_available = bool(v.get("vision_available", True))
        if not vision_available:
            vision_signals.append("vision_unavailable")
    elif body.run_vision:
        status = vision.vision_status()
        vision_available = bool(status.get("nudenet") or status.get("clip"))
        if not vision_available:
            vision_signals.append("vision_unavailable")

    secular_combined = max(
        secular_scene, float(text["secular_text_score"]) * 0.85
    )

    spoken_chars = len(spoken_body)
    hint, confidence, fuse_signals = text_score.hint_from_text_scores(
        float(text["gospel_score"]),
        float(text["anti_gospel_score"]),
        float(text["secular_text_score"]),
        nsfw=nsfw,
        christian_scene=christian,
        secular_scene=secular_combined,
        content_type=body.content_type,
        transcript_chars=spoken_chars,
        transcript_has_anchor=(
            "gospel_anchor" in (text.get("signals") or [])
            or "gospel_lexicon" in (text.get("signals") or [])
        ),
        violence=violence,
        gore=gore,
        weapons=weapons,
        drugs=drugs,
        sexual_scene=sexual_scene,
        nsfw_reject=config.NSFW_REJECT,
        nsfw_safe=config.NSFW_SAFE,
        christian_scene_approve=config.CHRISTIAN_SCENE_APPROVE,
        gospel_scene_approve=config.GOSPEL_SCENE_APPROVE,
        gospel_text_strong=config.GOSPEL_TEXT_STRONG,
        gospel_text_weak=config.GOSPEL_TEXT_WEAK,
        secular_scene_reject=config.SECULAR_SCENE_REJECT,
        secular_scene_safe=config.SECULAR_SCENE_SAFE,
        anti_gospel_reject=config.ANTI_GOSPEL_REJECT,
        violence_reject=config.VIOLENCE_REJECT,
        gore_reject=config.GORE_REJECT,
        weapons_reject=config.WEAPONS_REJECT,
        drugs_reject=config.DRUGS_REJECT,
        sexual_scene_reject=config.SEXUAL_SCENE_REJECT,
    )

    # Silent Scripture / lyric slides: OCR gospel + safe visuals → approve
    if (
        hint == "review"
        and ocr_text
        and ("gospel_anchor" in text["signals"] or "gospel_lexicon" in text["signals"])
        and nsfw < config.NSFW_SAFE
        and violence < config.VIOLENCE_REJECT * 0.7
        and sexual_scene < config.SEXUAL_SCENE_REJECT
    ):
        if christian >= config.CHRISTIAN_SCENE_APPROVE * 0.7 or float(text["gospel_score"]) >= config.GOSPEL_TEXT_STRONG:
            hint = "approve"
            confidence = max(confidence, 0.82)
            fuse_signals = list(fuse_signals) + ["frame_ocr_gospel_approve"]

    if body.run_vision and (body.thumbnail or body.frames) and not vision_available:
        # Don't quarantine OCR-clear Scripture when vision soft-fails
        if hint == "approve" and (
            "frame_ocr_gospel_approve" in fuse_signals
            or "gospel_anchor" in text["signals"]
        ):
            fuse_signals = list(fuse_signals) + [
                "vision_soft_fail_overridden_by_ocr_gospel"
            ]
        else:
            if hint == "approve":
                hint = "review"
                confidence = min(confidence, 0.4)
            fuse_signals = list(fuse_signals) + ["vision_soft_fail_quarantine"]

    signals = list(
        dict.fromkeys(
            list(text["signals"]) + vision_signals + ocr_signals + fuse_signals
        )
    )

    stt_status = whisper_stt.whisper_status()
    stt_available = bool(stt_status.get("available", True))

    return ScoreResponse(
        gospel_score=float(text["gospel_score"]),
        anti_gospel_score=float(text["anti_gospel_score"]),
        secular_text_score=float(text["secular_text_score"]),
        nsfw_score=nsfw,
        christian_scene_score=christian,
        secular_scene_score=secular_scene,
        violence_score=violence,
        gore_score=gore,
        weapons_score=weapons,
        drugs_score=drugs,
        sexual_scene_score=sexual_scene,
        decision_hint=hint,
        confidence=confidence,
        signals=signals,
        transcript=body.transcript or "",
        ocr_text=ocr_text,
        gospel_hits=list(text.get("gospel_hits") or []),
        anti_hits=list(text.get("anti_hits") or []),
        frame_count_scored=frame_count,
        vision_available=vision_available,
        stt_available=stt_available,
        ocr_available=ocr_available,
    )


def run():
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=config.HOST,
        port=config.PORT,
        reload=False,
    )


if __name__ == "__main__":
    run()
