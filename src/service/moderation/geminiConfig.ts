/**
 * Central Gemini model + API key configuration.
 * One API key authenticates all features; model IDs are env strings (not separate tokens).
 *
 * Supported env names (first non-empty wins, then failover on API_KEY_INVALID):
 *   GOOGLE_AI_API_KEY | GOOGLE_GEMINI_API_KEY | GEMINI_API_KEY
 */
import logger from "../../utils/logger";

const RETIRED_MODELS = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-1.0-pro"];

/** Deduped candidate API keys from env (never log values). */
export function getGoogleAiApiKeyCandidates(): string[] {
  const raw = [
    process.env.GOOGLE_AI_API_KEY,
    process.env.GOOGLE_GEMINI_API_KEY,
    process.env.GEMINI_API_KEY,
  ];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const k of raw) {
    const t = k?.trim();
    if (!t || t.length < 20 || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

export function getGoogleAiApiKey(): string | null {
  return getGoogleAiApiKeyCandidates()[0] || null;
}

/** Which env vars are set (names only) — for startup logs. */
export function getConfiguredGeminiKeyEnvNames(): string[] {
  const names: string[] = [];
  if (process.env.GOOGLE_AI_API_KEY?.trim()) names.push("GOOGLE_AI_API_KEY");
  if (process.env.GOOGLE_GEMINI_API_KEY?.trim()) names.push("GOOGLE_GEMINI_API_KEY");
  if (process.env.GEMINI_API_KEY?.trim()) names.push("GEMINI_API_KEY");
  return names;
}

export function getDefaultGeminiModel(): string {
  return (
    process.env.GEMINI_DEFAULT_MODEL ||
    process.env.GEMINI_MODERATION_MODEL ||
    "gemini-2.5-flash"
  );
}

export function getModerationModelId(useEscalation = false): string {
  const base = process.env.GEMINI_MODERATION_MODEL || getDefaultGeminiModel();
  const escalation =
    process.env.GEMINI_MODERATION_ESCALATION_MODEL || base;
  return useEscalation ? escalation : base;
}

export function getActiveModerationModelId(): string {
  return getModerationModelId(
    process.env.USE_GEMINI_PRO_MODEL === "true" ||
      process.env.NODE_ENV === "production"
  );
}

export function getTranscriptionModelId(): string {
  return process.env.GEMINI_TRANSCRIPTION_MODEL || getDefaultGeminiModel();
}

export function assertSupportedGeminiModel(modelId: string, context: string): void {
  const id = (modelId || "").toLowerCase();
  if (RETIRED_MODELS.some(r => id === r) || id.includes("gemini-1.5") || id.includes("gemini-1.0")) {
    const msg = `Retired Gemini model "${modelId}" referenced in ${context}. Use gemini-2.5-flash (or set GEMINI_*_MODEL).`;
    if (process.env.NODE_ENV === "production") {
      throw new Error(msg);
    }
    logger.warn(msg);
  }
}

/** Policy/prompt versions for moderation decision reuse. */
export const MODERATION_PROMPT_VERSION = "v2-ng-multilingual";
export const MODERATION_POLICY_VERSION = "christian-platform-v2";

export function validateGeminiStartupConfig(): void {
  const names = getConfiguredGeminiKeyEnvNames();
  if (names.length === 0) {
    logger.warn(
      "No Gemini API key env set (GOOGLE_AI_API_KEY / GOOGLE_GEMINI_API_KEY / GEMINI_API_KEY) — offline moderation only"
    );
    return;
  }
  logger.info("Gemini API key env(s) detected", {
    envNames: names,
    candidateCount: getGoogleAiApiKeyCandidates().length,
    hint: "If logs show API_KEY_INVALID, create a new key at https://aistudio.google.com/apikey and set GOOGLE_AI_API_KEY",
  });
  for (const [label, id] of [
    ["default", getDefaultGeminiModel()],
    ["moderation", getModerationModelId(false)],
    ["transcription", getTranscriptionModelId()],
  ] as const) {
    assertSupportedGeminiModel(id, label);
    logger.info("Gemini model configured", { feature: label, modelId: id });
  }
}
