/**
 * Shared Christian / gospel / biblical signal detection.
 * Used by fusion, Gemini parse, and offline heuristics so one lexicon drives auto-publish.
 */

/** Christ / Jesus names (EN + common local forms). */
export const CHRIST_NAME =
  /\b(?:jesus|christ|jesu|yesu|jisos|messiah|jesu\s+kristi|jesus\s+dey|blood\s+of\s+jesus|lamb\s+of\s+god|in\s+jesus\s+name)\b/i;

/** Bible book + chapter (e.g. "John 3", "Romans 8:28", "Psalm 23"). */
export const BIBLE_CITATION =
  /\b(?:genesis|exodus|leviticus|numbers|deuteronomy|joshua|judges|ruth|samuel|kings|chronicles|ezra|nehemiah|esther|job|psalm|psalms|proverb|proverbs|ecclesiastes|song\s+of\s+solomon|isaiah|jeremiah|lamentations|ezekiel|daniel|hosea|joel|amos|obadiah|jonah|micah|nahum|habakkuk|zephaniah|haggai|zechariah|malachi|matthew|mark|luke|john|acts|romans|corinthians|galatians|ephesians|philippians|colossians|thessalonians|timothy|titus|philemon|hebrews|james|peter|jude|revelation)\s+\d+(?:\s*[:：]\s*\d+)?\b/i;

/**
 * Clear Christian / gospel / biblical body signals.
 * Any strong hit is enough to auto-publish when safety is clear.
 */
export const GOSPEL_LEXICON =
  /\b(?:jesus|christ|jesu|yesu|jisos|messiah|yahweh|jehovah|holy\s+spirit|holy\s+ghost|almighty\s+god|living\s+god|our\s+god|heavenly\s+father|father\s+in\s+heaven|praise\s+(?:the\s+)?god|glory\s+to\s+god|thank\s+(?:you\s+)?god|bless(?:ed)?\s+(?:be\s+)?(?:the\s+)?(?:name\s+of\s+)?god|word\s+of\s+god|kingdom\s+of\s+(?:god|heaven)|son\s+of\s+god|blood\s+of\s+(?:jesus|the\s+lamb)|lamb\s+of\s+god|in\s+jesus\s+name|bible|scripture|gospel|salvation|redemption|repent(?:ance)?|resurrection|crucified|risen|born\s+again|sanctification|eternal\s+life|everlasting\s+life|only\s+begotten|whosoever\s+believ(?:eth|es)|for\s+god\s+so\s+loved|open\s+(?:your\s+)?bibles?|turn\s+with\s+me\s+to|brothers?\s+and\s+sisters?|beloved\s+(?:brethren|saints)|worship|hallelujah|halleluyah|hosanna|hymn|choir|testimony|evangelism|anointing|sermon|congregation|altar|fellowship|disciple|apostle|covenant|righteousness|pastor|ministry|prayer|amen|the\s+lord|let\s+us\s+pray|make\s+we\s+pray|make\s+una\s+pray|god\s+dey|oluwa|olorun|chukwu|chineke|ubangiji|adura|ekpere|addu'?a|amazing\s+grace|how\s+great\s+thou\s+art|blessed\s+assurance|to\s+god\s+be\s+the\s+glory|great\s+is\s+thy\s+faithfulness|praise\s+(?:and\s+)?worship|holy\s+bible|reading\s+(?:from\s+)?(?:the\s+)?(?:word|scripture|bible))\b/i;

export type GospelSignalStrength = "none" | "weak" | "strong";

export interface GospelSignal {
  hasSignal: boolean;
  strength: GospelSignalStrength;
  /** Approximate distinct hit classes (christ / citation / lexicon). */
  hitClasses: number;
  hasChristName: boolean;
  hasBibleCitation: boolean;
  hasLexicon: boolean;
}

export function analyzeGospelSignal(text?: string): GospelSignal {
  const t = (text || "").trim();
  if (t.length < 20) {
    return {
      hasSignal: false,
      strength: "none",
      hitClasses: 0,
      hasChristName: false,
      hasBibleCitation: false,
      hasLexicon: false,
    };
  }

  const hasChristName = CHRIST_NAME.test(t);
  const hasBibleCitation = BIBLE_CITATION.test(t);
  const hasLexicon = GOSPEL_LEXICON.test(t);
  const hitClasses =
    (hasChristName ? 1 : 0) + (hasBibleCitation ? 1 : 0) + (hasLexicon ? 1 : 0);

  if (!hitClasses) {
    return {
      hasSignal: false,
      strength: "none",
      hitClasses: 0,
      hasChristName,
      hasBibleCitation,
      hasLexicon,
    };
  }

  // Scripture citation or Jesus/Christ name → strong even in shorter clips
  const strength: GospelSignalStrength =
    hasChristName || hasBibleCitation || hitClasses >= 2 || t.length >= 40
      ? "strong"
      : "weak";

  return {
    hasSignal: true,
    strength,
    hitClasses,
    hasChristName,
    hasBibleCitation,
    hasLexicon,
  };
}

/** Spoken transcript only — ignores title/description. */
export function transcriptHasGospelLexicon(transcript?: string): boolean {
  const t = (transcript || "").trim();
  if (t.length < 40) {
    // Short clips: still allow clear Scripture citation / Christ name
    const s = analyzeGospelSignal(t);
    return s.hasChristName || s.hasBibleCitation;
  }
  return analyzeGospelSignal(t).hasSignal;
}

/**
 * Description + transcript + OCR body (never title alone).
 * Helps when STT is empty but the verse was pasted or shown on screen.
 */
export function bodyHasGospelLexicon(
  description?: string,
  transcript?: string,
  ocrText?: string
): boolean {
  const body = `${description || ""} ${transcript || ""} ${ocrText || ""}`.trim();
  if (body.length < 40) {
    const s = analyzeGospelSignal(body);
    return s.hasChristName || s.hasBibleCitation;
  }
  return analyzeGospelSignal(body).hasSignal;
}

export function bodyGospelStrength(
  description?: string,
  transcript?: string,
  ocrText?: string
): GospelSignalStrength {
  return analyzeGospelSignal(
    `${description || ""} ${transcript || ""} ${ocrText || ""}`.trim()
  ).strength;
}

/** On-screen OCR alone (silent Scripture / lyric slides). */
export function ocrHasGospelLexicon(ocrText?: string): boolean {
  const t = (ocrText || "").trim();
  if (t.length < 20) {
    const s = analyzeGospelSignal(t);
    return s.hasChristName || s.hasBibleCitation;
  }
  return analyzeGospelSignal(t).hasSignal;
}
