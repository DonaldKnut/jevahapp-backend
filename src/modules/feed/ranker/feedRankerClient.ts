/**
 * Optional Contabo-safe HTTP re-ranker client.
 * Default: OFF (FEED_RANKER_URL unset) — zero RAM / zero latency cost.
 * When set: 120ms timeout, circuit breaker, soft-fail to local score.
 */
import logger from "../../utils/logger";

export type RankerCandidate = {
  id: string;
  contentType?: string;
  likeCount?: number;
  viewCount?: number;
  commentCount?: number;
  shareCount?: number;
  bookmarkCount?: number;
  playCount?: number;
  genre?: string;
  artistId?: string;
  topics?: string[];
  category?: string;
  title?: string;
  createdAt?: string;
  publishedAt?: string;
};

export type RankerRequest = {
  userId: string;
  surface: "for_you" | "music_for_you";
  candidates: RankerCandidate[];
  affinity?: {
    preferredGenres?: string[];
    preferredContentTypes?: string[];
    preferredArtistIds?: string[];
    skippedIds?: string[];
    likedIds?: string[];
  };
};

export type RankerResponse = {
  orderedIds: string[];
  scores?: Record<string, number>;
  provider?: string;
};

function baseUrl(): string | null {
  const url = (process.env.FEED_RANKER_URL || "").trim().replace(/\/$/, "");
  return url || null;
}

function timeoutMs(): number {
  const n = parseInt(process.env.FEED_RANKER_TIMEOUT_MS || "120", 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 400) : 120;
}

let failCount = 0;
let openUntil = 0;
const FAIL_THRESHOLD = 3;
const COOLDOWN_MS = 30_000;

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
    logger.warn("Feed ranker circuit open", { coolDownMs: COOLDOWN_MS });
  }
}

export function isFeedRankerConfigured(): boolean {
  return !!baseUrl();
}

export async function rankWithSidecar(
  body: RankerRequest
): Promise<RankerResponse | null> {
  const base = baseUrl();
  if (!base || circuitOpen()) return null;
  if (!body.candidates.length) return { orderedIds: [] };

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs());
    const res = await fetch(`${base}/v1/rank`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) {
      recordFailure();
      return null;
    }
    const data = (await res.json()) as RankerResponse;
    if (!Array.isArray(data.orderedIds)) {
      recordFailure();
      return null;
    }
    recordSuccess();
    return data;
  } catch (err: any) {
    recordFailure();
    logger.debug("Feed ranker soft-fail", { error: String(err?.message || err) });
    return null;
  }
}
