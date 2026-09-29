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
  violence_score?: number;
  gore_score?: number;
  weapons_score?: number;
  drugs_score?: number;
  sexual_scene_score?: number;
  decision_hint: GuardianDecisionHint;
  confidence: number;
  signals: string[];
  transcript?: string;
  ocr_text?: string;
  gospel_hits?: string[];
  anti_hits?: string[];
  frame_count_scored?: number;
  provider?: string;
  vision_available?: boolean;
  stt_available?: boolean;
  ocr_available?: boolean;
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
    frames: (input.frames || []).slice(0, 16),
    run_vision: input.runVision !== false,
    run_ocr: true,
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

export async function scoreAudioWithGuardian(input: {
  audio: Buffer;
  filename?: string;
  mimeType?: string;
  title?: string;
  description?: string;
  contentType?: string;
  language?: string;
}): Promise<GuardianScoreResult | null> {
  const base = guardianBaseUrl();
  if (!base || circuitOpen()) return null;

  try {
    const form = new FormData();
    const mime = input.mimeType || "audio/mpeg";
    const blob = new Blob([new Uint8Array(input.audio)], { type: mime });
    form.append("file", blob, input.filename || "audio.mp3");
    form.append("title", input.title || "");
    form.append("description", input.description || "");
    form.append("content_type", input.contentType || "music");
    if (input.language) form.append("language", input.language);

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs());
    const res = await fetch(`${base}/v1/score-audio`, {
      method: "POST",
      body: form,
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) {
      recordFailure();
      logger.warn("Guardian /v1/score-audio failed", { status: res.status });
      return null;
    }
    const data = (await res.json()) as GuardianScoreResult;
    recordSuccess();
    return data;
  } catch (err: any) {
    recordFailure();
    logger.warn("Guardian /v1/score-audio error", {
      error: String(err?.message || err),
    });
    return null;
  }
}

export async function ocrFramesWithGuardian(
  frames: string[],
  maxFrames = 8
): Promise<{ text: string; available: boolean; signals: string[] } | null> {
  const base = guardianBaseUrl();
  if (!base || circuitOpen() || !frames.length) return null;

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs());
    const res = await fetch(`${base}/v1/ocr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        frames: frames.slice(0, maxFrames),
        max_frames: maxFrames,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) {
      recordFailure();
      return null;
    }
    const data = (await res.json()) as {
      text?: string;
      available?: boolean;
      signals?: string[];
    };
    recordSuccess();
    return {
      text: (data.text || "").trim(),
      available: data.available !== false,
      signals: data.signals || [],
    };
  } catch (err: any) {
    recordFailure();
    logger.warn("Guardian /v1/ocr error", {
      error: String(err?.message || err),
    });
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
