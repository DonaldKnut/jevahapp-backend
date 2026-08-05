"""Deterministic gospel / anti-gospel text scoring."""
from __future__ import annotations

import re
import unicodedata
from typing import Iterable

from .lexicons import ANTI_GOSPEL_TERMS, GOSPEL_TERMS, SECULAR_SOFT_TERMS


def _normalize(text: str) -> str:
    if not text:
        return ""
    t = unicodedata.normalize("NFKC", text).lower()
    t = re.sub(r"\s+", " ", t).strip()
    return t


def _count_hits(normalized: str, terms: Iterable[str]) -> tuple[int, list[str]]:
    hits: list[str] = []
    for term in terms:
        if term in normalized:
            hits.append(term)
    return len(hits), hits


def score_text(
    title: str = "",
    description: str = "",
    transcript: str = "",
) -> dict:
    """
    Returns gospel_score, anti_gospel_score, secular_text_score in [0, 1],
    plus signal strings.
    """
    # Title weighted higher — users see it first
    blob = _normalize(f"{title} {title} {description} {transcript}")
    if not blob:
        return {
            "gospel_score": 0.0,
            "anti_gospel_score": 0.0,
            "secular_text_score": 0.0,
            "gospel_hits": [],
            "anti_hits": [],
            "signals": ["empty_text"],
        }

    g_count, g_hits = _count_hits(blob, GOSPEL_TERMS)
    a_count, a_hits = _count_hits(blob, ANTI_GOSPEL_TERMS)
    s_count, s_hits = _count_hits(blob, SECULAR_SOFT_TERMS)

    # Saturating scores — a few strong hits are enough
    gospel_score = min(1.0, g_count / 4.0)
    anti_gospel_score = min(1.0, a_count / 2.0)
    secular_text_score = min(1.0, (s_count * 0.35 + a_count * 0.5) / 2.0)

    # Title-only gospel boost
    title_n = _normalize(title)
    if title_n:
        t_g, _ = _count_hits(title_n, GOSPEL_TERMS)
        if t_g:
            gospel_score = min(1.0, gospel_score + 0.15)

    signals: list[str] = []
    if g_hits:
        signals.append("gospel_lexicon")
    if a_hits:
        signals.append("anti_gospel_lexicon")
    if s_hits:
        signals.append("secular_lexicon")

    return {
        "gospel_score": round(gospel_score, 4),
        "anti_gospel_score": round(anti_gospel_score, 4),
        "secular_text_score": round(secular_text_score, 4),
        "gospel_hits": g_hits[:12],
        "anti_hits": a_hits[:12],
        "signals": signals,
    }


def hint_from_text_scores(
    gospel: float,
    anti: float,
    secular: float,
    *,
    nsfw: float = 0.0,
    christian_scene: float = 0.0,
    secular_scene: float = 0.0,
    content_type: str = "",
    nsfw_reject: float = 0.65,
    nsfw_safe: float = 0.25,
    christian_scene_approve: float = 0.55,
    gospel_scene_approve: float = 0.55,
    gospel_text_strong: float = 0.70,
    gospel_text_weak: float = 0.30,
    secular_scene_reject: float = 0.55,
    secular_scene_safe: float = 0.45,
    anti_gospel_reject: float = 0.50,
) -> tuple[str, float, list[str]]:
    """
    Pure fusion used by the Python service (mirrored in Node).
    Returns (decision_hint, confidence, signals).
    """
    signals: list[str] = []
    ct = (content_type or "").lower()
    is_av = ct in ("videos", "sermon", "music", "audio", "podcast") or not ct

    if nsfw >= nsfw_reject:
        signals.append("nsfw_reject")
        return "reject", 0.92, signals

    if anti >= anti_gospel_reject and gospel < 0.45:
        signals.append("anti_gospel_reject")
        return "reject", 0.88, signals

    if gospel < gospel_text_weak and (
        secular_scene >= secular_scene_reject or anti >= anti_gospel_reject
    ):
        signals.append("secular_off_theme")
        return "reject", 0.85, signals

    # Strong visual church + gospel text
    if (
        christian_scene >= christian_scene_approve
        and gospel >= gospel_scene_approve
        and nsfw < nsfw_safe
    ):
        signals.append("church_scene_gospel")
        return "approve", 0.9, signals

    # Strong text gospel, safe vision / no frames
    if gospel >= gospel_text_strong and nsfw < nsfw_safe and secular_scene < secular_scene_safe:
        signals.append("strong_gospel_text")
        return "approve", 0.86, signals

    # Audio / books: text-led approve
    if ct in ("music", "audio", "podcast", "books", "ebook") and gospel >= gospel_text_strong and anti < 0.35:
        signals.append("audio_book_gospel")
        return "approve", 0.84, signals

    # Explicit secular entertainment with weak gospel
    if is_av and gospel < 0.35 and secular >= 0.5 and christian_scene < 0.35:
        signals.append("secular_entertainment")
        return "reject", 0.8, signals

    signals.append("gray_zone")
    return "review", 0.45, signals
