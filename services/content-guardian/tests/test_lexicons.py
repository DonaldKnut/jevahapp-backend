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


def test_spoken_prayer_without_jesus_auto_publishes():
    r = score_text(
        title="Sunday service",
        description="",
        transcript="Prayer changes things amen. This ministry walks in grace. Pastor said make we pray.",
    )
    assert r["gospel_score"] >= 0.55
    assert "gospel_lexicon" in r["signals"]


def test_spoken_prayer_with_jesus_auto_publishes():
    r = score_text(
        title="Sunday service",
        description="",
        transcript="Make we pray. Amen. Jesus dey faithful. This ministry walks in grace.",
    )
    assert r["gospel_score"] >= 0.55
    assert "gospel_anchor" in r["signals"]


def test_john_316_scripture_reading_scores_high():
    r = score_text(
        title="Bible reading",
        description="",
        transcript=(
            "For God so loved the world that he gave his only begotten Son, "
            "that whosoever believeth in him should not perish but have everlasting life. "
            "John 3:16"
        ),
    )
    assert r["gospel_score"] >= 0.7
    assert "gospel_anchor" in r["signals"]
    assert "bible_citation" in r["gospel_hits"]


def test_hymn_to_god_scores_high():
    r = score_text(
        title="Choir night",
        description="",
        transcript=(
            "Amazing grace how sweet the sound. Glory to God forever. "
            "Hallelujah we worship the Lord today."
        ),
    )
    assert r["gospel_score"] >= 0.7
    assert "gospel_lexicon" in r["signals"]


def test_title_only_prayer_does_not_score_as_gospel():
    r = score_text(
        title="Sunday Prayer Ministry",
        description="",
        transcript="Hustle harder and get the bag this week team.",
    )
    assert r["gospel_score"] < 0.55


def test_substring_does_not_count_john_or_grace():
    r = score_text(
        title="Johnny's disgrace",
        description="across the room",
        transcript="Johnny crossed the street with disgrace.",
    )
    assert r["gospel_score"] < 0.3


def test_fusion_approve_strong_text():
    hint, conf, signals = hint_from_text_scores(
        0.85,
        0.0,
        0.1,
        nsfw=0.05,
        christian_scene=0.2,
        secular_scene=0.2,
        content_type="music",
    )
    assert hint == "approve"
    assert conf >= 0.8


def test_fusion_church_scene_without_spoken_anchor_is_review():
    hint, _, signals = hint_from_text_scores(
        0.6,
        0.0,
        0.1,
        nsfw=0.1,
        christian_scene=0.7,
        secular_scene=0.2,
        content_type="videos",
        transcript_chars=200,
        transcript_has_anchor=False,
    )
    assert hint == "review"
    assert "church_scene_needs_spoken_anchor" in signals


def test_fusion_approve_church_scene_with_spoken_anchor():
    hint, conf, _ = hint_from_text_scores(
        0.6,
        0.0,
        0.1,
        nsfw=0.1,
        christian_scene=0.7,
        secular_scene=0.2,
        content_type="videos",
        transcript_chars=120,
        transcript_has_anchor=True,
    )
    assert hint == "approve"


def test_fusion_reject_nsfw():
    hint, conf, signals = hint_from_text_scores(
        0.9, 0.0, 0.0, nsfw=0.8, christian_scene=0.9, secular_scene=0.1
    )
    assert hint == "reject"
    assert "nsfw_reject" in signals


def test_fusion_reject_violence_with_gospel_title_scores():
    hint, conf, signals = hint_from_text_scores(
        0.95,
        0.0,
        0.1,
        nsfw=0.05,
        christian_scene=0.1,
        secular_scene=0.2,
        content_type="videos",
        violence=0.7,
    )
    assert hint == "reject"
    assert "violence_reject" in signals


def test_fusion_reject_sexual_scene():
    hint, _, signals = hint_from_text_scores(
        0.9, 0.0, 0.0, nsfw=0.1, sexual_scene=0.75
    )
    assert hint == "reject"
    assert "sexual_scene_reject" in signals


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
