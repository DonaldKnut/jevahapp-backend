import logger from "../../utils/logger";

export type TrackModerationDecision = "approved" | "under_review" | "rejected";

/**
 * Light metadata review for creator uploads (no full audio download).
 * Fail-open → under_review so admins always have a gate when AI is unavailable.
 */
export async function reviewTrackMetadata(input: {
  title: string;
  artistName: string;
  genre?: string | null;
  licenseNote?: string | null;
  category?: string | null;
}): Promise<{
  decision: TrackModerationDecision;
  reason: string;
  source: "ai" | "heuristic" | "fail_open";
}> {
  const blob = [
    input.title,
    input.artistName,
    input.genre || "",
    input.category || "",
    input.licenseNote || "",
  ]
    .join(" ")
    .toLowerCase();

  // Fast heuristic blocklist (NSFW / clear spam) — gospel-safe defaults
  const hardBlock =
    /\b(porn|xxx|onlyfans|nude|sex tape|kill yourself|cocaine for sale)\b/i;
  if (hardBlock.test(blob)) {
    return {
      decision: "rejected",
      reason: "Metadata matched disallowed content heuristics",
      source: "heuristic",
    };
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

/** Verified artists can auto-publish when env allows (default on). */
export function shouldAutoApproveVerifiedArtist(isVerified: boolean): boolean {
  if (!isVerified) return false;
  return process.env.TRACK_AUTO_APPROVE_VERIFIED !== "false";
}
