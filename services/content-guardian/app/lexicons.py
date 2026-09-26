"""
Tiered gospel lexicons for EN + Nigerian Pidgin + Yoruba / Igbo / Hausa.

ANCHOR — required to auto-publish (Christ, Scripture, or local name of Jesus/God in worship).
SUPPORT — confirms an anchor (worship, choir). Never enough alone.
ATMOSPHERE — prayer / amen / pastor / ministry. Holds for review; never auto-publishes.
"""
from __future__ import annotations

# Must be spoken to auto-publish: Jesus / Christ / Jesu / Yesu / Jisos
JESUS_NAME_TERMS: list[str] = [
    "jesus",
    "christ",
    "jesu",
    "yesu",
    "jisos",
    "messiah",
    "jesu kristi",
    "jesus dey",
    "blood of jesus",
    "lamb of god",
    "in jesus name",
]

# Other gospel body signals — confirm a Jesus-named sermon, not enough alone
GOSPEL_ANCHOR_TERMS: list[str] = JESUS_NAME_TERMS + [
    "yahweh",
    "jehovah",
    "holy spirit",
    "holy ghost",
    "bible",
    "scripture",
    "word of god",
    "kingdom of god",
    "kingdom of heaven",
    "salvation",
    "redemption",
    "repentance",
    "resurrection",
    "crucified",
    "risen",
    "born again",
    "sanctification",
    "eternal life",
    "gospel",
    "oluwa",
    "olorun",
    "chukwu",
    "chineke",
    "ubangiji",
    "god dey do",
]

# Confirms an anchor; does not saturate gospel_score alone
GOSPEL_SUPPORT_TERMS: list[str] = [
    "worship",
    "hallelujah",
    "halleluyah",
    "hosanna",
    "hymn",
    "choir",
    "testimony",
    "evangelism",
    "anointing",
    "orin iyin",
    "olorun tobi",
    "igbagbo",
    "otito",
    "ibada",
    "thank god",
    "bless god",
    "fire of god",
]

# Quiet sermons and prayer language — approve when spoken in the body
GOSPEL_ATMOSPHERE_TERMS: list[str] = [
    "prayer",
    "amen",
    "pastor",
    "ministry",
    "grace",
    "sermon",
    "congregation",
    "altar",
    "praise",
    "fellowship",
    "disciple",
    "apostle",
    "covenant",
    "righteousness",
    "adura",
    "ekpere",
    "addu'a",
    "the lord",
    "let us pray",
    "make we pray",
    "make una pray",
    "in jesus name",
    "god dey",
]

# Backward-compatible union (do not use for auto-publish scoring)
GOSPEL_TERMS: list[str] = (
    GOSPEL_ANCHOR_TERMS + GOSPEL_SUPPORT_TERMS + GOSPEL_ATMOSPHERE_TERMS
)

ANTI_GOSPEL_TERMS: list[str] = [
    "porn",
    "porno",
    "xxx",
    "nude",
    "nudity",
    "strip club",
    "nightclub",
    "club banger",
    "onlyfans",
    "ashawo",
    "olosho",
    "oloshi",
    "runs girl",
    "runsgirl",
    "doggy style",
    "quickie",
    "masturbat",
    "knack me",
    "i go knack",
    "come knack",
    "tap that",
    "tap current",
    "blaspheme",
    "blasphemy",
    "satanic ritual",
    "witchcraft party",
    "secular rap",
    "trap music",
    "afrobeats party",
    "club vibe",
    "turn up",
    "flexing money",
    "lewd dance",
    "twerk",
    "grinding on",
]

SECULAR_SOFT_TERMS: list[str] = [
    "party vibes",
    "dance challenge",
    "tiktok dance",
    "club night",
    "rave",
    "hookup",
    "side chick",
    "side chic",
    "sugar daddy",
    "yahoo boy",
]

# Generic motivation / self-help (reject when no gospel anchor)
MOTIVATION_TERMS: list[str] = [
    "motivational speaker",
    "motivation monday",
    "mindset",
    "hustle culture",
    "law of attraction",
    "manifestation",
    "self help",
    "self-help",
    "believe in yourself",
    "grind mode",
    "passive income",
    "millionaire mindset",
    "boss babe",
    "success tips",
    "confidence tips",
    "how to get rich",
    "level up your life",
]
