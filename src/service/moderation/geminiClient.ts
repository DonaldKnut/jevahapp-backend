/**
 * Bounded Gemini generateContent helper with timeout + jittered retries.
 * On API_KEY_INVALID, rotates through GOOGLE_AI_API_KEY / GOOGLE_GEMINI_API_KEY / GEMINI_API_KEY.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  getGoogleAiApiKeyCandidates,
  getDefaultGeminiModel,
} from "./geminiConfig";
import { engagementRedisSafe } from "../../lib/engagementRedis";
import logger from "../../utils/logger";

const DEFAULT_TIMEOUT_MS = Math.min(
  120_000,
  Math.max(15_000, parseInt(process.env.GEMINI_REQUEST_TIMEOUT_MS || "60000", 10) || 60_000)
);
const MAX_RETRIES = Math.min(3, Math.max(0, parseInt(process.env.GEMINI_MAX_RETRIES || "2", 10) || 2));
let activeCalls = 0;
const MAX_CONCURRENT = Math.min(
  8,
  Math.max(1, parseInt(process.env.GEMINI_MAX_CONCURRENT || "3", 10) || 3)
);
const CONCURRENCY_KEY = "gemini:concurrency:v1";

/** Index into key candidates when primary key is rejected by Google. */
let keyFailIndex = 0;

export function createGeminiClient(): GoogleGenerativeAI | null {
  const candidates = getGoogleAiApiKeyCandidates();
  if (candidates.length === 0) return null;
  const idx = Math.min(keyFailIndex, candidates.length - 1);
  return new GoogleGenerativeAI(candidates[idx]);
}

export function markGeminiApiKeyInvalid(): void {
  const candidates = getGoogleAiApiKeyCandidates();
  if (keyFailIndex < candidates.length - 1) {
    keyFailIndex += 1;
    logger.warn("Gemini API key marked invalid — rotating to next env candidate", {
      nextIndex: keyFailIndex,
      remaining: candidates.length - keyFailIndex,
    });
  } else {
    logger.error(
      "All configured Gemini API keys rejected (API_KEY_INVALID). Offline moderation will be used until keys are fixed."
    );
  }
}

export function isGeminiApiKeyError(err: unknown): boolean {
  const msg = String((err as any)?.message || err || "");
  return /API[_ ]?KEY[_ ]?INVALID|API key not valid|PERMISSION_DENIED.*API key/i.test(
    msg
  );
}

async function waitForSlot(): Promise<void> {
  const start = Date.now();
  while (activeCalls >= MAX_CONCURRENT) {
    if (Date.now() - start > 30_000) {
      throw new Error("Gemini concurrency limit wait timeout");
    }
    await new Promise(r => setTimeout(r, 50 + Math.random() * 100));
  }
}

async function acquireDistributedSlot(): Promise<boolean> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const acquired = await engagementRedisSafe(
      "geminiConcurrencyAcquire",
      async redis =>
        Number(
          await redis.eval(
            `local n = redis.call("INCR", KEYS[1])
             if n == 1 then redis.call("EXPIRE", KEYS[1], ARGV[2]) end
             if n > tonumber(ARGV[1]) then
               redis.call("DECR", KEYS[1])
               return 0
             end
             return 1`,
            1,
            CONCURRENCY_KEY,
            String(MAX_CONCURRENT),
            "180"
          )
        ) === 1,
      null
    );
    if (acquired === null || acquired) return acquired === true;
    await new Promise(r => setTimeout(r, 75 + Math.random() * 125));
  }
  throw new Error("Gemini distributed concurrency wait timeout");
}

async function releaseDistributedSlot(acquired: boolean): Promise<void> {
  if (!acquired) return;
  await engagementRedisSafe(
    "geminiConcurrencyRelease",
    async redis =>
      redis.eval(
        `local n = tonumber(redis.call("GET", KEYS[1]) or "0")
         if n <= 1 then return redis.call("DEL", KEYS[1]) end
         return redis.call("DECR", KEYS[1])`,
        1,
        CONCURRENCY_KEY
      ),
    null
  );
}

export async function generateContentWithRetry(
  model: { generateContent: (req: any) => Promise<any> },
  request: any,
  opts?: { timeoutMs?: number; label?: string }
): Promise<any> {
  const timeoutMs = opts?.timeoutMs || DEFAULT_TIMEOUT_MS;
  let lastErr: any;
  const candidates = getGoogleAiApiKeyCandidates();

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    await waitForSlot();
    const distributedSlot = await acquireDistributedSlot();
    activeCalls++;
    try {
      let activeModel = model;
      if (keyFailIndex > 0 && candidates[keyFailIndex]) {
        const client = new GoogleGenerativeAI(candidates[keyFailIndex]);
        const modelId = getDefaultGeminiModel();
        activeModel = client.getGenerativeModel({ model: modelId });
      }

      const result = await Promise.race([
        activeModel.generateContent(request),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(`Gemini timeout after ${timeoutMs}ms`)),
            timeoutMs
          )
        ),
      ]);
      return result;
    } catch (err: any) {
      lastErr = err;
      const msg = String(err?.message || err);
      if (isGeminiApiKeyError(err)) {
        markGeminiApiKeyInvalid();
        if (keyFailIndex < candidates.length) {
          continue;
        }
        break;
      }
      const retryable = /429|5\d\d|timeout|ECONNRESET|unavailable/i.test(msg);
      logger.warn("Gemini call failed", {
        label: opts?.label,
        attempt,
        error: msg,
        retryable,
      });
      if (!retryable || attempt === MAX_RETRIES) break;
      const backoff = Math.min(8000, 400 * Math.pow(2, attempt) + Math.random() * 200);
      await new Promise(r => setTimeout(r, backoff));
    } finally {
      activeCalls--;
      await releaseDistributedSlot(distributedSlot);
    }
  }
  throw lastErr;
}
