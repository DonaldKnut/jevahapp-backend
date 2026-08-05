"""
Jevah Content Guardian — local STT + vision + gospel lexicon scoring.
AI (Gemini) is NOT used here; Node calls this first, Gemini only for gray zones.
"""
from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import FastAPI, File, Form, UploadFile
from pydantic import BaseModel, Field

from . import config
from . import text_score
from . import vision
from . import whisper_stt

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("content-guardian")

app = FastAPI(
    title="Jevah Content Guardian",
    version="1.0.0",
    description="Gospel-first upload scoring without cloud AI",
)


class ScoreRequest(BaseModel):
    title: str = ""
    description: str = ""
    transcript: str = ""
    content_type: str = "videos"
    thumbnail: Optional[str] = None
    frames: List[str] = Field(default_factory=list)
    run_vision: bool = True


class ScoreResponse(BaseModel):
    gospel_score: float
    anti_gospel_score: float
    secular_text_score: float
    nsfw_score: float
    christian_scene_score: float
    secular_scene_score: float
    decision_hint: str
    confidence: float
    signals: List[str]
    transcript: str = ""
    gospel_hits: List[str] = Field(default_factory=list)
    anti_hits: List[str] = Field(default_factory=list)
    frame_count_scored: int = 0
    provider: str = "content-guardian"


@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "content-guardian",
        "version": "1.0.0",
        "whisper": whisper_stt.whisper_status(),
        "vision": vision.vision_status(),
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


@app.post("/v1/score", response_model=ScoreResponse)
def score(body: ScoreRequest):
    text = text_score.score_text(body.title, body.description, body.transcript)
    nsfw = 0.0
    christian = 0.0
    secular_scene = 0.0
    frame_count = 0
    vision_signals: list[str] = []

    if body.run_vision and (body.thumbnail or body.frames):
        v = vision.score_vision(body.thumbnail, body.frames or None)
        nsfw = float(v["nsfw_score"])
        christian = float(v["christian_scene_score"])
        secular_scene = float(v["secular_scene_score"])
        frame_count = int(v["frame_count_scored"])
        vision_signals = list(v.get("signals") or [])

    # Combine secular text into scene-ish signal for fusion
    secular_combined = max(
        secular_scene, float(text["secular_text_score"]) * 0.85
    )

    hint, confidence, fuse_signals = text_score.hint_from_text_scores(
        float(text["gospel_score"]),
        float(text["anti_gospel_score"]),
        float(text["secular_text_score"]),
        nsfw=nsfw,
        christian_scene=christian,
        secular_scene=secular_combined,
        content_type=body.content_type,
        nsfw_reject=config.NSFW_REJECT,
        nsfw_safe=config.NSFW_SAFE,
        christian_scene_approve=config.CHRISTIAN_SCENE_APPROVE,
        gospel_scene_approve=config.GOSPEL_SCENE_APPROVE,
        gospel_text_strong=config.GOSPEL_TEXT_STRONG,
        gospel_text_weak=config.GOSPEL_TEXT_WEAK,
        secular_scene_reject=config.SECULAR_SCENE_REJECT,
        secular_scene_safe=config.SECULAR_SCENE_SAFE,
        anti_gospel_reject=config.ANTI_GOSPEL_REJECT,
    )

    signals = list(
        dict.fromkeys(
            list(text["signals"]) + vision_signals + fuse_signals
        )
    )

    return ScoreResponse(
        gospel_score=float(text["gospel_score"]),
        anti_gospel_score=float(text["anti_gospel_score"]),
        secular_text_score=float(text["secular_text_score"]),
        nsfw_score=nsfw,
        christian_scene_score=christian,
        secular_scene_score=secular_scene,
        decision_hint=hint,
        confidence=confidence,
        signals=signals,
        transcript=body.transcript or "",
        gospel_hits=list(text.get("gospel_hits") or []),
        anti_hits=list(text.get("anti_hits") or []),
        frame_count_scored=frame_count,
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
