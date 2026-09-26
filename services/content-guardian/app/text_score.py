"""Deterministic gospel / anti-gospel text scoring."""
from __future__ import annotations

import re
import unicodedata
from typing import Iterable

from .lexicons import (
    ANTI_GOSPEL_TERMS,
    GOSPEL_ANCHOR_TERMS,
    GOSPEL_ATMOSPHERE_TERMS,
    GOSPEL_SUPPORT_TERMS,
    JESUS_NAME_TERMS,
    MOTIVATION_TERMS,
    SECULAR_SOFT_TERMS,
)

# "John 3" / "Romans 8" — not the name John / Johnny
_BIBLE_CITATION = re.compile(
    r"\b(?:genesis|exodus|leviticus|numbers|deuteronomy|joshua|judges|ruth|"
    r"samuel|kings|chronicles|ezra|nehemiah|esther|job|psalm|psalms|proverb|proverbs|"
    r"ecclesiastes|isaiah|jeremiah|ezekiel|daniel|hosea|joel|amos|obadiah|jonah|"
    r"micah|nahum|habakkuk|zephaniah|haggai|zechariah|malachi|"
    r"matthew|mark|luke|john|acts|romans|corinthians|galatians|ephesians|"
    r"philippians|colossians|thessalonians|timothy|titus|philemon|hebrews|"
    r"james|peter|jude|revelation)\s+\d+",
    re.IGNORECASE,
)


def _normalize(text: str) -> str:
    if not text:
        return ""
    t = unicodedata.normalize("NFKC", text).lower()
    t = re.sub(r"\s+", " ", t).strip()
    return t


def _count_hits(normalized: str, terms: Iterable[str]) -> tuple[int, list[str]]:
    """Whole-term matches only — 'john' must not fire on 'johnny', 'grace' not on 'disgrace'."""
    hits: list[str] = []
    if not normalized:
        return 0, hits
    for term in terms:
        pattern = r"(?<!\w)" + re.escape(term) + r"(?!\w)"
        if re.search(pattern, normalized):
            hits.append(term)
    return len(hits), hits


def _jesus_count(normalized: str) -> tuple[int, list[str]]:
    return _count_hits(normalized, JESUS_NAME_TERMS)


def _anchor_count(normalized: str) -> tuple[int, list[str]]:
    n, hits = _count_hits(normalized, GOSPEL_ANCHOR_TERMS)
    if normalized and _BIBLE_CITATION.search(normalized):
        n += 1
        hits = hits + ["bible_citation"]
    return n, hits


def _gospel_score_from_counts(
    jesus_n: int, support_n: int, atmosphere_n: int = 0
) -> float:
    # Auto-publish bar is Jesus / Christ / Jesu / Yesu / Jisos in the body.
    if jesus_n <= 0:
        if atmosphere_n + support_n >= 1:
            return min(0.45, 0.2 + 0.08 * (atmosphere_n + support_n))
        return 0.0
    return min(1.0, 0.6 + 0.2 * (jesus_n - 1) + 0.08 * (support_n + atmosphere_n))


def score_text(
    title: str = "",
    description: str = "",
    transcript: str = "",
) -> dict:
    """
    Returns gospel_score, anti_gospel_score, secular_text_score in [0, 1],
    plus signal strings. gospel_score is anchor-weighted from the body.
    """
    title_n = _normalize(title)
    body_n = _normalize(f"{description} {transcript}")
    blob = _normalize(f"{title} {description} {transcript}")
    if not blob:
        return {
            "gospel_score": 0.0,
            "anti_gospel_score": 0.0,
            "secular_text_score": 0.0,
            "gospel_hits": [],
            "anti_hits": [],
            "signals": ["empty_text"],
        }

    body_jesus, body_jesus_hits = _jesus_count(body_n)
    title_jesus, _ = _jesus_count(title_n)
    body_anchors, body_anchor_hits = _anchor_count(body_n)
    body_support, body_support_hits = _count_hits(body_n, GOSPEL_SUPPORT_TERMS)
    body_atm, body_atm_hits = _count_hits(body_n, GOSPEL_ATMOSPHERE_TERMS)
    atmosphere_n = body_atm
    a_count, a_hits = _count_hits(blob, ANTI_GOSPEL_TERMS)
    s_count, s_hits = _count_hits(blob, SECULAR_SOFT_TERMS)
    m_count, m_hits = _count_hits(blob, MOTIVATION_TERMS)

    if body_n:
        gospel_score = _gospel_score_from_counts(
            body_jesus, body_support, body_atm
        )
        if title_jesus and body_jesus:
            gospel_score = min(1.0, gospel_score + 0.1)
    elif title_jesus:
        gospel_score = 0.15
    else:
        gospel_score = _gospel_score_from_counts(0, body_support, 0)

    anti_gospel_score = min(1.0, a_count / 2.0)
    secular_text_score = min(
        1.0, (s_count * 0.35 + a_count * 0.5 + m_count * 0.45) / 2.0
    )

    signals: list[str] = []
    if body_jesus_hits:
        signals.append("gospel_anchor")
        signals.append("gospel_lexicon")
    elif atmosphere_n or body_support or body_anchor_hits:
        signals.append("gospel_atmosphere")
    if a_hits:
        signals.append("anti_gospel_lexicon")
    if s_hits:
        signals.append("secular_lexicon")
    if m_hits:
        signals.append("motivation_lexicon")

    return {
        "gospel_score": round(gospel_score, 4),
        "anti_gospel_score": round(anti_gospel_score, 4),
        "secular_text_score": round(secular_text_score, 4),
        "gospel_hits": (body_anchor_hits + body_support_hits + body_atm_hits)[:12],
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
    transcript_chars: int = 0,
    transcript_has_anchor: bool = False,
    violence: float = 0.0,
    gore: float = 0.0,
    weapons: float = 0.0,
    drugs: float = 0.0,
    sexual_scene: float = 0.0,
    nsfw_reject: float = 0.65,
    nsfw_safe: float = 0.25,
    christian_scene_approve: float = 0.55,
    gospel_scene_approve: float = 0.55,
    gospel_text_strong: float = 0.70,
    gospel_text_weak: float = 0.30,
    secular_scene_reject: float = 0.55,
    secular_scene_safe: float = 0.45,
    anti_gospel_reject: float = 0.50,
    video_transcript_min_chars: int = 80,
    violence_reject: float = 0.45,
    gore_reject: float = 0.40,
    weapons_reject: float = 0.48,
    drugs_reject: float = 0.48,
    sexual_scene_reject: float = 0.50,
) -> tuple[str, float, list[str]]:
    """
    Pure fusion used by the Python service (mirrored in Node).
    Returns (decision_hint, confidence, signals).
    """
    signals: list[str] = []
    ct = (content_type or "").lower()
    is_av = ct in ("videos", "sermon", "music", "audio", "podcast") or not ct

    if nsfw >= nsfw_reject or sexual_scene >= sexual_scene_reject:
        signals.append("nsfw_reject" if nsfw >= nsfw_reject else "sexual_scene_reject")
        return "reject", 0.94, signals

    if violence >= violence_reject:
        signals.append("violence_reject")
        return "reject", 0.93, signals

    if gore >= gore_reject:
        signals.append("gore_reject")
        return "reject", 0.93, signals

    if weapons >= weapons_reject:
        signals.append("weapons_reject")
        return "reject", 0.9, signals

    if drugs >= drugs_reject:
        signals.append("drugs_reject")
        return "reject", 0.9, signals

    if anti >= anti_gospel_reject and gospel < 0.45:
        signals.append("anti_gospel_reject")
        return "reject", 0.88, signals

    if gospel < gospel_text_weak and (
        secular_scene >= secular_scene_reject or anti >= anti_gospel_reject
    ):
        signals.append("secular_off_theme")
        return "reject", 0.85, signals

    is_video = ct in ("videos", "sermon", "live", "recording") or not ct
    spoken_anchor = (
        transcript_has_anchor
        or (
            transcript_chars >= video_transcript_min_chars
            and gospel >= gospel_text_strong
        )
    )

    if (
        christian_scene >= christian_scene_approve
        and gospel >= gospel_scene_approve
        and nsfw < nsfw_safe
        and violence < violence_reject * 0.7
        and gore < gore_reject * 0.7
    ):
        if is_video and not spoken_anchor:
            signals.append("church_scene_needs_spoken_anchor")
            return "review", 0.5, signals
        signals.append("church_scene_gospel")
        return "approve", 0.9, signals

    if gospel >= gospel_text_strong and nsfw < nsfw_safe and secular_scene < secular_scene_safe:
        if is_video:
            if christian_scene >= christian_scene_approve and spoken_anchor:
                signals.append("strong_gospel_text")
                signals.append("video_visual_corroboration")
                return "approve", 0.82, signals
            if spoken_anchor and violence < 0.3 and gore < 0.25:
                signals.append("strong_gospel_transcript")
                signals.append("spoken_word_of_god")
                return "approve", 0.84, signals
            signals.append("strong_gospel_text_needs_spoken_or_visual")
            return "review", 0.5, signals
        signals.append("strong_gospel_text")
        return "approve", 0.86, signals

    if ct in ("music", "audio", "podcast", "books", "ebook") and gospel >= gospel_text_strong and anti < 0.35:
        signals.append("audio_book_gospel")
        return "approve", 0.84, signals

    if is_av and gospel < 0.35 and secular >= 0.5 and christian_scene < 0.35:
        signals.append("secular_entertainment")
        return "reject", 0.8, signals

    signals.append("gray_zone")
    return "review", 0.45, signals
