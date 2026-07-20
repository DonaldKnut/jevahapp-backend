/**
 * Media-type evidence budgets for cost-bounded, full-timeline sampling.
 * Never sample only the first N minutes — distribute across the whole asset.
 */

export type EvidenceMediaKind = "video" | "audio" | "book" | "image" | "unknown";

export interface EvidenceProfile {
  kind: EvidenceMediaKind;
  /** Evenly spaced video frames across full duration */
  maxFrames: number;
  minFrames: number;
  /** Distributed audio clips */
  maxAudioClips: number;
  minAudioClips: number;
  clipSeconds: number;
  /** Hard cap on total transcribed audio seconds */
  maxTranscribedSeconds: number;
  /** Distributed text windows for ebooks */
  maxTextChars: number;
  minTextChars: number;
  textWindows: number;
  /** Thumbnail max edge px before base64 */
  thumbnailMaxPx: number;
  /** Minimum modalities required before auto-approve is allowed */
  requireTranscriptOrFrames: boolean;
}

function envInt(name: string, fallback: number): number {
  const n = parseInt(process.env[name] || "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function resolveEvidenceKind(contentType: string, mimeType?: string): EvidenceMediaKind {
  const ct = (contentType || "").toLowerCase();
  const mime = (mimeType || "").toLowerCase();
  if (ct === "videos" || ct === "sermon" || mime.startsWith("video/")) return "video";
  if (ct === "music" || ct === "audio" || ct === "podcast" || mime.startsWith("audio/"))
    return "audio";
  if (ct === "books" || ct === "ebook" || mime.includes("pdf") || mime.includes("epub"))
    return "book";
  if (ct === "image" || mime.startsWith("image/")) return "image";
  return "unknown";
}

export function getEvidenceProfile(
  contentType: string,
  mimeType?: string,
  escalate = false
): EvidenceProfile {
  const kind = resolveEvidenceKind(contentType, mimeType);
  const frameCap = envInt("MODERATION_MAX_VIDEO_FRAMES", 10);
  const clipCap = envInt("VERIFICATION_MAX_AUDIO_SEGMENTS", 5);

  if (kind === "video") {
    return {
      kind,
      maxFrames: escalate ? Math.min(16, frameCap + 4) : Math.min(10, frameCap),
      minFrames: 4,
      maxAudioClips: escalate ? Math.min(7, clipCap + 2) : Math.min(5, clipCap),
      minAudioClips: 2,
      clipSeconds: 45,
      maxTranscribedSeconds: escalate ? 300 : 240,
      maxTextChars: 0,
      minTextChars: 0,
      textWindows: 0,
      thumbnailMaxPx: 512,
      requireTranscriptOrFrames: true,
    };
  }

  if (kind === "audio") {
    return {
      kind,
      maxFrames: 0,
      minFrames: 0,
      maxAudioClips: escalate ? Math.min(6, clipCap + 1) : Math.min(4, clipCap),
      minAudioClips: 2,
      clipSeconds: 40,
      maxTranscribedSeconds: escalate ? 210 : 180,
      maxTextChars: 0,
      minTextChars: 0,
      textWindows: 0,
      thumbnailMaxPx: 512,
      requireTranscriptOrFrames: true,
    };
  }

  if (kind === "book") {
    return {
      kind,
      maxFrames: 0,
      minFrames: 0,
      maxAudioClips: 0,
      minAudioClips: 0,
      clipSeconds: 0,
      maxTranscribedSeconds: 0,
      maxTextChars: escalate ? 16000 : 12000,
      minTextChars: 400,
      textWindows: escalate ? 7 : 5,
      thumbnailMaxPx: 512,
      requireTranscriptOrFrames: true,
    };
  }

  return {
    kind,
    maxFrames: 0,
    minFrames: 0,
    maxAudioClips: 0,
    minAudioClips: 0,
    clipSeconds: 0,
    maxTranscribedSeconds: 0,
    maxTextChars: 2000,
    minTextChars: 0,
    textWindows: 1,
    thumbnailMaxPx: 512,
    requireTranscriptOrFrames: false,
  };
}

/** Evenly spaced offsets in [0, duration) for N samples (full timeline). */
export function distributedOffsets(durationSeconds: number, count: number): number[] {
  if (durationSeconds <= 0 || count <= 0) return [0];
  if (count === 1) return [Math.max(0, durationSeconds * 0.1)];
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = (i / Math.max(1, count - 1)) * Math.max(0, durationSeconds - 0.5);
    out.push(Math.max(0, Math.min(durationSeconds - 0.25, t)));
  }
  return out;
}

export function clipDurationsWithinBudget(
  profile: EvidenceProfile,
  durationSeconds: number
): { offsets: number[]; clipSeconds: number } {
  const n = Math.min(
    profile.maxAudioClips,
    Math.max(profile.minAudioClips, Math.ceil(durationSeconds / 180) || profile.minAudioClips)
  );
  let clipSeconds = Math.min(profile.clipSeconds, Math.max(10, durationSeconds));
  const total = n * clipSeconds;
  if (total > profile.maxTranscribedSeconds) {
    clipSeconds = Math.max(15, Math.floor(profile.maxTranscribedSeconds / n));
  }
  return {
    offsets: distributedOffsets(durationSeconds, n),
    clipSeconds,
  };
}

export interface EvidenceCoverage {
  title: boolean;
  description: boolean;
  transcript: boolean;
  transcriptChars: number;
  frames: boolean;
  frameCount: number;
  thumbnail: boolean;
  textChars: number;
}

export function hasMinimumEvidence(
  profile: EvidenceProfile,
  coverage: EvidenceCoverage
): boolean {
  if (!profile.requireTranscriptOrFrames) {
    return coverage.title || coverage.description;
  }
  if (profile.kind === "book") {
    return coverage.textChars >= profile.minTextChars || coverage.transcriptChars >= profile.minTextChars;
  }
  if (profile.kind === "video") {
    return (
      coverage.frameCount >= profile.minFrames ||
      coverage.transcriptChars >= 20
    );
  }
  if (profile.kind === "audio") {
    return coverage.transcriptChars >= 20;
  }
  return coverage.title || coverage.description;
}
