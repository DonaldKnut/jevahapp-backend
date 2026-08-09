"""
Jevah Feed Ranker — Contabo-safe algorithmic re-ranker.

NO TensorFlow. NO Torch. NO sentence-transformers.
Pure FastAPI + stdlib math on features Node already computed.

Default Contabo deploy: leave FEED_RANKER_URL unset — Node local ranker
handles everything with zero extra RAM. Start this only if you want a
separate process for experimentation.
"""
from __future__ import annotations

import math
import os
import random
from typing import Any, Optional

from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="Jevah Feed Ranker", version="1.0.0")


class Candidate(BaseModel):
    id: str
    contentType: Optional[str] = None
    likeCount: float = 0
    viewCount: float = 0
    commentCount: float = 0
    shareCount: float = 0
    bookmarkCount: float = 0
    playCount: float = 0
    genre: Optional[str] = None
    artistId: Optional[str] = None
    topics: list[str] = Field(default_factory=list)
    category: Optional[str] = None
    title: Optional[str] = None
    createdAt: Optional[str] = None
    publishedAt: Optional[str] = None


class Affinity(BaseModel):
    preferredGenres: list[str] = Field(default_factory=list)
    preferredContentTypes: list[str] = Field(default_factory=list)
    preferredArtistIds: list[str] = Field(default_factory=list)
    skippedIds: list[str] = Field(default_factory=list)
    likedIds: list[str] = Field(default_factory=list)


class RankRequest(BaseModel):
    userId: str
    surface: str = "for_you"
    candidates: list[Candidate]
    affinity: Optional[Affinity] = None


class RankResponse(BaseModel):
    orderedIds: list[str]
    scores: dict[str, float] = Field(default_factory=dict)
    provider: str = "feed-ranker-lite"


def _log1p(x: float) -> float:
    return math.log1p(max(0.0, x))


def score_candidate(c: Candidate, aff: Affinity) -> float:
    engagement = (
        0.3 * _log1p(c.likeCount)
        + 0.2 * _log1p(c.viewCount)
        + 0.15 * _log1p(c.commentCount)
        + 0.15 * _log1p(c.bookmarkCount)
        + 0.1 * _log1p(c.shareCount)
        + 0.1 * _log1p(c.playCount)
    )

    genres = {g.lower() for g in aff.preferredGenres}
    types = {t.lower() for t in aff.preferredContentTypes}
    artists = set(aff.preferredArtistIds)
    skipped = set(aff.skippedIds)
    liked = set(aff.likedIds)

    affinity = 0.0
    if c.genre and c.genre.lower() in genres:
        affinity += 0.2
    if c.contentType and c.contentType.lower() in types:
        affinity += 0.1
    if c.artistId and c.artistId in artists:
        affinity += 0.25
    if c.id in liked:
        affinity -= 0.35
    if c.id in skipped:
        affinity -= 0.55

    noise = 0.06 * random.random()
    score = 0.5 * engagement + 0.35 * max(0.0, affinity) + 0.15 * noise
    if c.id in skipped:
        score *= 0.4
    return score


@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "feed-ranker-lite",
        "torch": False,
        "tensorflow": False,
        "ram_note": "feature-only; safe for small VPS",
    }


@app.post("/v1/rank", response_model=RankResponse)
def rank(body: RankRequest):
    aff = body.affinity or Affinity()
    scored = [(c.id, score_candidate(c, aff)) for c in body.candidates if c.id]
    scored.sort(key=lambda x: x[1], reverse=True)
    return RankResponse(
        orderedIds=[i for i, _ in scored],
        scores={i: round(s, 4) for i, s in scored},
        provider="feed-ranker-lite",
    )


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("FEED_RANKER_PORT", "8092"))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)
