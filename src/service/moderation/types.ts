/** Shared moderation DTOs — imported by service + workers without circular deps. */
export interface ModerationResult {
  isApproved: boolean;
  confidence: number; // 0-1
  reason?: string;
  flags: string[];
  requiresReview: boolean;
  languageCandidates?: string[];
  modelId?: string;
}

export interface ModerationInput {
  transcript?: string;
  videoFrames?: string[]; // Base64 encoded images
  thumbnail?: string; // Base64 encoded thumbnail image
  title?: string;
  description?: string;
  contentType: string;
  mediaId?: string;
  contentHash?: string;
  fileMimeType?: string;
}

export function policyText(input: ModerationInput): string {
  return `${input.title || ""} ${input.description || ""} ${input.transcript || ""}`;
}

/** Heuristic language candidates for Nigerian multilingual evidence logging. */
export function detectLanguageCandidates(text: string): string[] {
  const t = (text || "").toLowerCase();
  const out = new Set<string>(["en"]);
  if (/\b(?:wetin|dey|abi|naija|no be|make we|oya|sef)\b/.test(t)) out.add("pcm");
  if (
    /\b(?:oluwa|olorun|adura|igbagbo|jesu|yesu|ẹni|fun)\b/.test(t) ||
    /[ẹọṣàáéíóúǹ]/.test(t)
  ) {
    out.add("yo");
  }
  if (/\b(?:chukwu|chineke|chisom|nke|nwanne|jisos|ekpere)\b/.test(t)) out.add("ig");
  if (/\b(?:ubangiji|addu'?a|ibada|yesu|allah)\b/.test(t)) out.add("ha");
  return [...out];
}

/** Evenly subsample frames across the video for the vision model. */
export function sampleVideoFramesForModeration(
  frames: string[],
  max: number
): string[] {
  if (!frames.length || max <= 0) return [];
  if (frames.length <= max) return frames;
  const out: string[] = [];
  for (let i = 0; i < max; i++) {
    const idx = Math.round((i * (frames.length - 1)) / (max - 1));
    out.push(frames[idx]);
  }
  return out;
}

export const MODERATION_TRANSCRIPT_PROMPT_MAX = 12000;

export const MODERATION_MAX_VIDEO_FRAMES = Math.min(
  16,
  Math.max(4, parseInt(process.env.MODERATION_MAX_VIDEO_FRAMES || "10", 10) || 10)
);
