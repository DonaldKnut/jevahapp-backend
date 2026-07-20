/**
 * Redis-backed AI budgets (multi-instance safe) with local fallback.
 */
import {
  engagementRedisSafe,
  engagementGet,
} from "../../lib/engagementRedis";
import logger from "../../utils/logger";

export type AiBudgetCounters = {
  requests: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  budgetBlocks: number;
  providerErrors: number;
  quarantines: number;
  approvals: number;
  rejects: number;
};

const dayKey = (): string => new Date().toISOString().slice(0, 10);

function envInt(name: string, fallback: number): number {
  const n = parseInt(process.env[name] || "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getAiDailyLimits() {
  return {
    maxRequests: envInt("GEMINI_DAILY_REQUEST_BUDGET", 500),
    maxInputTokens: envInt("GEMINI_DAILY_INPUT_TOKEN_BUDGET", 2_000_000),
    maxOutputTokens: envInt("GEMINI_DAILY_OUTPUT_TOKEN_BUDGET", 200_000),
    maxUploadsPerUser: envInt("MODERATION_DAILY_UPLOADS_PER_USER", 30),
  };
}

function budgetKey(metric: string): string {
  return `ai-budget:v1:${dayKey()}:${metric}`;
}

function userUploadKey(userId: string): string {
  return `ai-budget:v1:uploads:${dayKey()}:${userId}`;
}

/** Local fallback when Redis is down */
const localDay = { day: "", counters: emptyCounters(), users: new Map<string, number>() };

function emptyCounters(): AiBudgetCounters {
  return {
    requests: 0,
    estimatedInputTokens: 0,
    estimatedOutputTokens: 0,
    budgetBlocks: 0,
    providerErrors: 0,
    quarantines: 0,
    approvals: 0,
    rejects: 0,
  };
}

function ensureLocalDay() {
  const d = dayKey();
  if (localDay.day !== d) {
    localDay.day = d;
    localDay.counters = emptyCounters();
    localDay.users.clear();
  }
}

async function incrBudget(metric: string, by = 1): Promise<number> {
  const key = budgetKey(metric);
  const next = await engagementRedisSafe(
    "aiBudgetIncr",
    async r => {
      const n = await r.incrby(key, by);
      await r.expire(key, 48 * 3600);
      return typeof n === "number" ? n : Number(n);
    },
    -1
  );
  if (next < 0) {
    ensureLocalDay();
    const c = localDay.counters as any;
    c[metric] = (c[metric] || 0) + by;
    return c[metric];
  }
  return next;
}

async function getBudgetMetric(metric: string): Promise<number> {
  const raw = await engagementGet(budgetKey(metric));
  if (raw === null) {
    ensureLocalDay();
    return (localDay.counters as any)[metric] || 0;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export async function canUserUploadForModeration(userId: string): Promise<boolean> {
  const limits = getAiDailyLimits();
  const key = userUploadKey(userId);
  const count = await engagementRedisSafe(
    "aiUserUploadGet",
    async r => Number((await r.get(key)) || 0),
    -1
  );
  if (count < 0) {
    ensureLocalDay();
    return (localDay.users.get(userId) || 0) < limits.maxUploadsPerUser;
  }
  return count < limits.maxUploadsPerUser;
}

export async function recordUserUploadForModeration(userId: string): Promise<void> {
  const key = userUploadKey(userId);
  const ok = await engagementRedisSafe(
    "aiUserUploadIncr",
    async r => {
      const n = await r.incr(key);
      await r.expire(key, 48 * 3600);
      return n;
    },
    null
  );
  if (ok === null) {
    ensureLocalDay();
    localDay.users.set(userId, (localDay.users.get(userId) || 0) + 1);
  }
}

/** Atomically consumes one per-user moderation upload slot. */
export async function reserveUserUploadForModeration(
  userId: string
): Promise<boolean> {
  const key = userUploadKey(userId);
  const limit = getAiDailyLimits().maxUploadsPerUser;
  const reserved = await engagementRedisSafe(
    "aiUserUploadReserve",
    async redis =>
      Number(
        await redis.eval(
          `local n = tonumber(redis.call("GET", KEYS[1]) or "0")
           if n >= tonumber(ARGV[1]) then return 0 end
           n = redis.call("INCR", KEYS[1])
           redis.call("EXPIRE", KEYS[1], 172800)
           return 1`,
          1,
          key,
          String(limit)
        )
      ) === 1,
    null
  );
  if (reserved !== null) return reserved;
  ensureLocalDay();
  const count = localDay.users.get(userId) || 0;
  if (count >= limit) return false;
  localDay.users.set(userId, count + 1);
  return true;
}

export async function canSpendAiBudget(
  estimatedInputTokens = 2000,
  estimatedOutputTokens = 512
): Promise<boolean> {
  const limits = getAiDailyLimits();
  const [requests, input, output] = await Promise.all([
    getBudgetMetric("requests"),
    getBudgetMetric("estimatedInputTokens"),
    getBudgetMetric("estimatedOutputTokens"),
  ]);
  if (requests >= limits.maxRequests) return false;
  if (input + estimatedInputTokens > limits.maxInputTokens) return false;
  if (output + estimatedOutputTokens > limits.maxOutputTokens) return false;
  return true;
}

/**
 * Atomically checks and reserves one provider request plus estimated tokens.
 * This prevents concurrent workers from all passing a read-only budget check.
 */
export async function reserveAiBudget(
  estimatedInputTokens = 2000,
  estimatedOutputTokens = 512
): Promise<boolean> {
  const limits = getAiDailyLimits();
  const keys = [
    budgetKey("requests"),
    budgetKey("estimatedInputTokens"),
    budgetKey("estimatedOutputTokens"),
  ];
  const reserved = await engagementRedisSafe(
    "aiBudgetReserve",
    async redis =>
      Number(
        await redis.eval(
          `local requests = tonumber(redis.call("GET", KEYS[1]) or "0")
           local input = tonumber(redis.call("GET", KEYS[2]) or "0")
           local output = tonumber(redis.call("GET", KEYS[3]) or "0")
           if requests + 1 > tonumber(ARGV[3])
             or input + tonumber(ARGV[1]) > tonumber(ARGV[4])
             or output + tonumber(ARGV[2]) > tonumber(ARGV[5]) then
             return 0
           end
           redis.call("INCR", KEYS[1])
           redis.call("INCRBY", KEYS[2], ARGV[1])
           redis.call("INCRBY", KEYS[3], ARGV[2])
           redis.call("EXPIRE", KEYS[1], 172800)
           redis.call("EXPIRE", KEYS[2], 172800)
           redis.call("EXPIRE", KEYS[3], 172800)
           return 1`,
          3,
          ...keys,
          String(estimatedInputTokens),
          String(estimatedOutputTokens),
          String(limits.maxRequests),
          String(limits.maxInputTokens),
          String(limits.maxOutputTokens)
        )
      ) === 1,
    null
  );
  if (reserved !== null) return reserved;

  ensureLocalDay();
  const c = localDay.counters;
  if (
    c.requests + 1 > limits.maxRequests ||
    c.estimatedInputTokens + estimatedInputTokens > limits.maxInputTokens ||
    c.estimatedOutputTokens + estimatedOutputTokens > limits.maxOutputTokens
  ) {
    return false;
  }
  c.requests += 1;
  c.estimatedInputTokens += estimatedInputTokens;
  c.estimatedOutputTokens += estimatedOutputTokens;
  return true;
}

export async function recordAiUsage(opts: {
  inputTokens?: number;
  outputTokens?: number;
  outcome?: "approve" | "reject" | "quarantine" | "error" | "budget_block";
  /** When false, do not increment request counter (e.g. hard blocklist / budget block with no provider call) */
  countedRequest?: boolean;
  /** Request/tokens were already atomically reserved before the provider call. */
  usageReserved?: boolean;
}): Promise<void> {
  const counted = opts.countedRequest !== false && !opts.usageReserved;
  try {
    if (counted) await incrBudget("requests", 1);
    if (!opts.usageReserved && opts.inputTokens) {
      await incrBudget("estimatedInputTokens", opts.inputTokens);
    }
    if (!opts.usageReserved && opts.outputTokens) {
      await incrBudget("estimatedOutputTokens", opts.outputTokens);
    }
    switch (opts.outcome) {
      case "approve":
        await incrBudget("approvals", 1);
        break;
      case "reject":
        await incrBudget("rejects", 1);
        break;
      case "quarantine":
        await incrBudget("quarantines", 1);
        break;
      case "error":
        await incrBudget("providerErrors", 1);
        break;
      case "budget_block":
        await incrBudget("budgetBlocks", 1);
        break;
      default:
        break;
    }
  } catch (err: any) {
    logger.warn("recordAiUsage failed", { error: err?.message });
  }
}

export async function getAiBudgetSnapshot(): Promise<
  AiBudgetCounters & { day: string; limits: ReturnType<typeof getAiDailyLimits> }
> {
  const metrics = [
    "requests",
    "estimatedInputTokens",
    "estimatedOutputTokens",
    "budgetBlocks",
    "providerErrors",
    "quarantines",
    "approvals",
    "rejects",
  ] as const;
  const values = await Promise.all(metrics.map(m => getBudgetMetric(m)));
  const counters = emptyCounters();
  metrics.forEach((m, i) => {
    (counters as any)[m] = values[i];
  });
  return {
    day: dayKey(),
    limits: getAiDailyLimits(),
    ...counters,
  };
}

export function logProviderHealth(modelId: string, ok: boolean, detail?: string): void {
  if (ok) {
    logger.info("AI provider health ok", { modelId });
  } else {
    logger.error("AI provider health failed", { modelId, detail });
  }
}
