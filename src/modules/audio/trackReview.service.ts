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

export type TrackModerationDecision = "approved" | "under_review" | "rejected";

export type TrackReviewResult = {
  decision: TrackModerationDecision;
  reason: string;
  source: "guardian_audio" | "ai" | "heuristic" | "fail_open" | "auto_verified";
  transcriptPreview?: string;
};

/**
 * Light metadata review for creator uploads (fallback when Guardian audio unavailable).
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

  // Prefer Guardian text score on metadata alone when audio sample missing
  if (isGuardianConfigured()) {
    const scored = await scoreWithGuardian({
      title: input.title,
      description: [input.artistName, input.genre, input.category, input.licenseNote]
        .filter(Boolean)
        .join(" · "),
      contentType: "music",
      runVision: false,
    });
    if (scored) {
      const outcome = fuseGuardianScores(scored, "music");
      if (outcome.decision === "approve") {
        return {
          decision: "approved",
          reason: "Approved by Content Guardian (metadata/gospel lexicon)",
          source: "guardian_audio",
        };
      }
      if (outcome.decision === "reject") {
        return {
          decision: "rejected",
          reason: "Rejected by Content Guardian (metadata)",
          source: "guardian_audio",
        };
      }
    }
  }

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey || process.env.TRACK_AI_REVIEW === "false") {
    return {
      decision: "under_review",
      reason: "Queued for admin review (AI review disabled or unavailable)",
      source: "fail_open",
    };
  }

  try {
    const model =
      process.env.GEMINI_MODERATION_MODEL ||
      process.env.GEMINI_DEFAULT_MODEL ||
      "gemini-2.5-flash";
    const prompt = `You moderate metadata for a Christian gospel music app (Jevah).
Return ONLY JSON: {"decision":"approved"|"under_review"|"rejected","reason":"short"}.
Approve clearly faith/gospel/worship/ministerial music metadata.
Use under_review for unclear, secular-only, or copyright-risk claims.
Reject explicit sexual, hate, or scam content.

Title: ${input.title}
Artist: ${input.artistName}
Genre: ${input.genre || ""}
Category: ${input.category || ""}
License: ${input.licenseNote || ""}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 120 },
      }),
      signal: AbortSignal.timeout(
        Number(process.env.GEMINI_REQUEST_TIMEOUT_MS || 20000)
      ),
    });

    if (!resp.ok) {
      logger.warn("Track AI review HTTP error", { status: resp.status });
      return {
        decision: "under_review",
        reason: "AI review failed; queued for admin",
        source: "fail_open",
      };
    }

    const json: any = await resp.json();
    const text =
      json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ||
      "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return {
        decision: "under_review",
        reason: "AI returned unparseable result",
        source: "fail_open",
      };
    }
    const parsed = JSON.parse(match[0]);
    const decision = String(parsed.decision || "under_review").toLowerCase();
    if (!["approved", "under_review", "rejected"].includes(decision)) {
      return {
        decision: "under_review",
        reason: "Invalid AI decision",
        source: "fail_open",
      };
    }
    return {
      decision: decision as TrackModerationDecision,
      reason: String(parsed.reason || "AI metadata review").slice(0, 300),
      source: "ai",
    };
  } catch (err: any) {
    logger.warn("Track AI review error", { error: err?.message });
    return {
      decision: "under_review",
      reason: "AI review error; queued for admin",
      source: "fail_open",
    };
  }
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

    // Empty STT → quarantine (don't approve silent/instrumental without gospel metadata strength)
    if (scored.stt_available === false || !(scored.transcript || "").trim()) {
      const meta = await scoreWithGuardian({
        title: input.title,
        description: [input.artistName, input.genre].filter(Boolean).join(" "),
        contentType: "music",
        runVision: false,
      });
      if (meta) {
        const mo = fuseGuardianScores(meta, "music");
        if (mo.decision === "approve" && mo.scores.gospel_score >= 0.7) {
          return {
            decision: "approved",
            reason:
              "Instrumental/no lyrics — approved on strong gospel metadata via Guardian",
            source: "guardian_audio",
          };
        }
      }
      return {
        decision: "under_review",
        reason: "Audio STT empty — queued for admin (possible instrumental)",
        source: "guardian_audio",
      };
    }

    const outcome = fuseGuardianScores(scored, "music");
    const mapped = fusionToModerationResult(outcome, {
      title: input.title,
      contentType: "music",
      transcript: scored.transcript,
    });

    if (outcome.decision === "approve") {
      return {
        decision: "approved",
        reason: mapped.reason || "Approved by Content Guardian (audio STT)",
        source: "guardian_audio",
        transcriptPreview: (scored.transcript || "").slice(0, 200),
      };
    }
    if (outcome.decision === "reject") {
      return {
        decision: "rejected",
        reason: mapped.reason || "Rejected by Content Guardian (audio STT)",
        source: "guardian_audio",
        transcriptPreview: (scored.transcript || "").slice(0, 200),
      };
    }
    return {
      decision: "under_review",
      reason: "Guardian gray-zone — queued for admin",
      source: "guardian_audio",
      transcriptPreview: (scored.transcript || "").slice(0, 200),
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
