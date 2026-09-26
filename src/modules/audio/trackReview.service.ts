import logger from "../../utils/logger";
import {
  fuseGuardianScores,
  fusionToModerationResult,
} from "../../service/moderation/gospelFusion";
import {
  isGuardianConfigured,
  scoreAudioWithGuardian,
  scoreWithGuardian,
} from "../../service/moderation/guardianClient";
import { transcriptHasGospelLexicon } from "../../service/moderation/offlineModeration";

export type TrackModerationDecision = "approved" | "under_review" | "rejected";

export type TrackReviewResult = {
  decision: TrackModerationDecision;
  reason: string;
  source: "guardian_audio" | "ai" | "heuristic" | "fail_open" | "auto_verified";
  transcriptPreview?: string;
};

const SAFETY_TRACK_SIGNALS = [
  "nsfw_reject",
  "sexual_scene_reject",
  "violence_reject",
  "gore_reject",
  "weapons_reject",
  "drugs_reject",
];

/**
 * After the track is heard: publish only a clear gospel pass.
 * Safety fails reject. Everything else waits for admin — never approve from title.
 */
export function heardTrackDecision(signals: string[], fusionDecision: string): TrackModerationDecision {
  if (fusionDecision === "approve") return "approved";
  if (
    fusionDecision === "reject" &&
    signals.some(s => SAFETY_TRACK_SIGNALS.includes(s))
  ) {
    return "rejected";
  }
  return "under_review";
}

/**
 * Fallback when the track could not be heard. Title/artist never auto-publish.
 * Only explicit metadata is a hard reject; the rest goes to admin.
 */
export async function reviewTrackMetadata(input: {
  title: string;
  artistName: string;
  genre?: string | null;
  licenseNote?: string | null;
  category?: string | null;
}): Promise<TrackReviewResult> {
  const blob = [
    input.title,
    input.artistName,
    input.genre || "",
    input.category || "",
    input.licenseNote || "",
  ]
    .join(" ")
    .toLowerCase();

  const hardBlock =
    /\b(porn|xxx|onlyfans|nude|sex tape|kill yourself|cocaine for sale)\b/i;
  if (hardBlock.test(blob)) {
    return {
      decision: "rejected",
      reason: "Metadata matched disallowed content heuristics",
      source: "heuristic",
    };
  }

  return {
    decision: "under_review",
    reason:
      "Track was not heard by moderation — queued for admin review. A gospel title alone is not enough.",
    source: "fail_open",
  };
}

/**
 * Advanced creator audio review: Whisper STT + gospel lexicon via Content Guardian.
 * Contabo-safe — samples first N bytes of the public/presigned audio URL.
 */
export async function reviewTrackAudioWithGuardian(input: {
  title: string;
  artistName: string;
  genre?: string | null;
  category?: string | null;
  licenseNote?: string | null;
  audioUrl: string;
  mimeType?: string | null;
}): Promise<TrackReviewResult | null> {
  if (!isGuardianConfigured()) return null;
  if (process.env.TRACK_GUARDIAN_AUDIO === "false") return null;

  const maxBytes = Math.min(
    Math.max(
      parseInt(process.env.TRACK_GUARDIAN_MAX_BYTES || "", 10) || 8 * 1024 * 1024,
      1_000_000
    ),
    12 * 1024 * 1024
  );

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 90_000);
    const res = await fetch(input.audioUrl, {
      headers: { Range: `bytes=0-${maxBytes - 1}` },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!(res.ok || res.status === 206)) {
      logger.warn("Track Guardian audio fetch failed", { status: res.status });
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1024) return null;

    const scored = await scoreAudioWithGuardian({
      audio: buf,
      filename: "track-sample.mp3",
      mimeType: input.mimeType || "audio/mpeg",
      title: input.title,
      description: [input.artistName, input.genre, input.category, input.licenseNote]
        .filter(Boolean)
        .join(" · "),
      contentType: "music",
    });
    if (!scored) return null;

    const heardLyrics = (scored.transcript || "").trim();
    // Empty STT: we did not hear lyrics. Do not approve from the title.
    if (scored.stt_available === false || !heardLyrics) {
      return {
        decision: "under_review",
        reason:
          "Could not hear lyrics on this track — queued for admin (instrumental or unclear audio)",
        source: "guardian_audio",
      };
    }

    const outcome = fuseGuardianScores(scored, "music", {
      transcriptChars: heardLyrics.length,
      transcriptHasGospel: transcriptHasGospelLexicon(heardLyrics),
    });
    const mapped = fusionToModerationResult(outcome, {
      title: input.title,
      contentType: "music",
      transcript: heardLyrics,
    });
    const decision = heardTrackDecision(outcome.signals, outcome.decision);
    const preview = heardLyrics.slice(0, 200);

    if (decision === "approved") {
      return {
        decision,
        reason: mapped.reason || "Approved after hearing the track (gospel lyrics)",
        source: "guardian_audio",
        transcriptPreview: preview,
      };
    }
    if (decision === "rejected") {
      return {
        decision,
        reason: mapped.reason || "Rejected after hearing the track (safety)",
        source: "guardian_audio",
        transcriptPreview: preview,
      };
    }
    return {
      decision: "under_review",
      reason:
        "Heard the track but it isn’t a clear gospel pass — queued for admin review",
      source: "guardian_audio",
      transcriptPreview: preview,
    };
  } catch (err: any) {
    logger.warn("Track Guardian audio review error", { error: err?.message });
    return null;
  }
}

export function shouldAutoApproveVerifiedArtist(isVerified: boolean): boolean {
  if (!isVerified) return false;
  // Opt-in skip only. Default: verified artists still get Guardian audio review.
  return process.env.TRACK_VERIFIED_SKIP_AUDIO === "true";
}

const COVER_VISION_MAX_BYTES = 5 * 1024 * 1024;

/**
 * NSFW / lewd-scene check for track covers (and similar public images).
 * Contabo-safe: loads from R2 key or public URL, max 5MB.
 * NSFW reject always blocks. Soft vision failure → under_review (never auto-approve porn miss).
 */
export async function reviewImageNsfwWithGuardian(input: {
  title?: string;
  imageUrl?: string | null;
  objectKey?: string | null;
  mimeType?: string | null;
  label?: string;
}): Promise<TrackReviewResult | null> {
  if (!isGuardianConfigured()) return null;
  if (process.env.TRACK_COVER_VISION === "false") return null;

  const label = input.label || "cover";
  let buf: Buffer | null = null;
  let mime = input.mimeType || "image/jpeg";

  try {
    if (input.objectKey) {
      const fileUploadService = (
        await import("../../service/fileUpload.service")
      ).default;
      buf = await fileUploadService.getObjectBuffer(input.objectKey, {
        maxBytes: COVER_VISION_MAX_BYTES,
      });
      const lower = input.objectKey.toLowerCase();
      if (lower.endsWith(".png")) mime = "image/png";
      else if (lower.endsWith(".webp")) mime = "image/webp";
    }
    if (!buf?.length && input.imageUrl) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 30_000);
      const res = await fetch(input.imageUrl, {
        headers: { Range: `bytes=0-${COVER_VISION_MAX_BYTES - 1}` },
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!(res.ok || res.status === 206)) {
        logger.warn("Cover vision fetch failed", {
          status: res.status,
          label,
        });
        return null;
      }
      buf = Buffer.from(await res.arrayBuffer());
      const ct = res.headers.get("content-type");
      if (ct?.startsWith("image/")) mime = ct.split(";")[0].trim();
    }
  } catch (err: any) {
    logger.warn("Cover vision load error", { error: err?.message, label });
    return null;
  }

  if (!buf?.length || buf.length < 64) return null;

  const thumbnail = `data:${mime};base64,${buf.toString("base64")}`;
  const scored = await scoreWithGuardian({
    title: input.title || label,
    description: `Public ${label} image for gospel app`,
    contentType: "videos", // enable vision soft-fail quarantine path
    thumbnail,
    runVision: true,
  });
  if (!scored) return null;

  const outcome = fuseGuardianScores(scored, "videos");
  const nsfw = scored.nsfw_score ?? 0;

  if (
    scored.vision_available === false &&
    outcome.decision === "approve"
  ) {
    return {
      decision: "under_review",
      reason: `${label} vision unavailable — queued for admin`,
      source: "guardian_audio",
    };
  }

  if (outcome.decision === "reject" || nsfw >= 0.65) {
    return {
      decision: "rejected",
      reason: `Rejected: inappropriate ${label} (NSFW/vision)`,
      source: "guardian_audio",
    };
  }

  if (outcome.decision === "review" || nsfw >= 0.25) {
    return {
      decision: "under_review",
      reason: `${label} needs human review (vision gray-zone)`,
      source: "guardian_audio",
    };
  }

  return {
    decision: "approved",
    reason: `${label} passed vision NSFW check`,
    source: "guardian_audio",
  };
}
