"""Lexicon + fusion tests (no torch required)."""
from app.text_score import hint_from_text_scores, score_text


def test_gospel_sermon_scores_high():
    r = score_text(
        title="Sunday Sermon on Grace",
        description="Pastor teaches from Romans about salvation",
        transcript="Jesus Christ is Lord. The Word of God says repent and believe.",
    )
    assert r["gospel_score"] >= 0.7
    assert r["anti_gospel_score"] < 0.3
    assert "gospel_lexicon" in r["signals"]


def test_pidgin_gospel():
    r = score_text(
        title="Thank God testimony",
        description="",
        transcript="Jesus dey do wonders. Oluwa seun. Holy Ghost fire.",
    )
    assert r["gospel_score"] >= 0.5


def test_anti_gospel_club():
    r = score_text(
        title="Club banger turn up",
        description="Nightclub party vibes",
        transcript="Ashawo in the strip club tap that",
    )
    assert r["anti_gospel_score"] >= 0.5


def test_fusion_approve_strong_text():
    hint, conf, signals = hint_from_text_scores(
        0.85, 0.0, 0.1, nsfw=0.05, christian_scene=0.2, secular_scene=0.2
    )
    assert hint == "approve"
    assert conf >= 0.8


def test_fusion_approve_church_scene():
    hint, conf, _ = hint_from_text_scores(
        0.6, 0.0, 0.1, nsfw=0.1, christian_scene=0.7, secular_scene=0.2
    )
    assert hint == "approve"


def test_fusion_reject_nsfw():
    hint, conf, signals = hint_from_text_scores(
        0.9, 0.0, 0.0, nsfw=0.8, christian_scene=0.9, secular_scene=0.1
    )
    assert hint == "reject"
    assert "nsfw_reject" in signals


def test_fusion_reject_secular():
    hint, _, signals = hint_from_text_scores(
        0.15, 0.6, 0.6, nsfw=0.1, christian_scene=0.1, secular_scene=0.7
    )
    assert hint == "reject"


def test_fusion_gray():
    hint, conf, signals = hint_from_text_scores(
        0.45, 0.1, 0.2, nsfw=0.1, christian_scene=0.4, secular_scene=0.4
    )
    assert hint == "review"
    assert "gray_zone" in signals
