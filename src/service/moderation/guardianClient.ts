/**
 * HTTP client for the Python Content Guardian sidecar.
 */
import logger from "../../utils/logger";

export type GuardianDecisionHint = "approve" | "reject" | "review";

export interface GuardianScoreRequest {
  title?: string;
  description?: string;
  transcript?: string;
  contentType?: string;
  thumbnail?: string;
  frames?: string[];
  runVision?: boolean;
}

export interface GuardianScoreResult {
  gospel_score: number;
  anti_gospel_score: number;
  secular_text_score: number;
  nsfw_score: number;
  christian_scene_score: number;
  secular_scene_score: number;
  decision_hint: GuardianDecisionHint;
  confidence: number;
  signals: string[];
  transcript?: string;
  gospel_hits?: string[];
  anti_hits?: string[];
  frame_count_scored?: number;
  provider?: string;
}

export interface GuardianTranscribeResult {
  transcript: string;
  confidence: number;
  language?: string;
  available?: boolean;
  error?: string;
}

function guardianBaseUrl(): string | null {
  const url = (process.env.CONTENT_GUARDIAN_URL || "").trim().replace(/\/$/, "");
  return url || null;
}

function timeoutMs(): number {
  const n = parseInt(process.env.CONTENT_GUARDIAN_TIMEOUT_MS || "120000", 10);
  return Number.isFinite(n) && n > 0 ? n : 120000;
}

/** Simple circuit: after N consecutive failures, skip calls for coolDownMs. */
let failCount = 0;
let openUntil = 0;
const FAIL_THRESHOLD = 3;
const COOLDOWN_MS = 60_000;

function circuitOpen(): boolean {
  return Date.now() < openUntil;
}

function recordSuccess(): void {
  failCount = 0;
  openUntil = 0;
}

function recordFailure(): void {
  failCount += 1;
  if (failCount >= FAIL_THRESHOLD) {
    openUntil = Date.now() + COOLDOWN_MS;
    logger.warn("Content Guardian circuit open", {
      failCount,
      coolDownMs: COOLDOWN_MS,
    });
  }
}

export function isGuardianConfigured(): boolean {
  return !!guardianBaseUrl();
}

export function isGuardianCircuitOpen(): boolean {
  return circuitOpen();
}

export async function guardianHealth(): Promise<{
  ok: boolean;
  detail?: any;
}> {
  const base = guardianBaseUrl();
  if (!base) return { ok: false, detail: { reason: "not_configured" } };
  if (circuitOpen()) return { ok: false, detail: { reason: "circuit_open" } };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), Math.min(8000, timeoutMs()));
    const res = await fetch(`${base}/health`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) {
      recordFailure();
      return { ok: false, detail: { status: res.status } };
    }
    const detail = await res.json();
    recordSuccess();
    return { ok: true, detail };
  } catch (err: any) {
    recordFailure();
    return { ok: false, detail: { error: String(err?.message || err) } };
  }
}

export async function scoreWithGuardian(
  input: GuardianScoreRequest
): Promise<GuardianScoreResult | null> {
  const base = guardianBaseUrl();
  if (!base || circuitOpen()) return null;

  const body = {
    title: input.title || "",
    description: input.description || "",
    transcript: input.transcript || "",
    content_type: input.contentType || "videos",
    thumbnail: input.thumbnail || null,
    frames: (input.frames || []).slice(0, 10),
    run_vision: input.runVision !== false,
  };

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs());
    const res = await fetch(`${base}/v1/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) {
      recordFailure();
      logger.warn("Guardian /v1/score failed", { status: res.status });
      return null;
    }
    const data = (await res.json()) as GuardianScoreResult;
    recordSuccess();
    return data;
  } catch (err: any) {
    recordFailure();
    logger.warn("Guardian /v1/score error", { error: String(err?.message || err) });
    return null;
  }
}

export async function transcribeWithGuardian(
  audio: Buffer,
  filename = "audio.wav",
  mimeType = "audio/wav",
  language?: string
): Promise<GuardianTranscribeResult | null> {
  const base = guardianBaseUrl();
  if (!base || circuitOpen()) return null;

  try {
    const form = new FormData();
    const blob = new Blob([new Uint8Array(audio)], { type: mimeType });
    form.append("file", blob, filename);
    if (language) form.append("language", language);

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs());
    const res = await fetch(`${base}/v1/transcribe`, {
      method: "POST",
      body: form,
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) {
      recordFailure();
      return null;
    }
    const data = (await res.json()) as GuardianTranscribeResult;
    recordSuccess();
    return data;
  } catch (err: any) {
    recordFailure();
    logger.warn("Guardian /v1/transcribe error", {
      error: String(err?.message || err),
    });
    return null;
  }
}
