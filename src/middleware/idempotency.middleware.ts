import { createHash } from "crypto";
import { NextFunction, Request, Response } from "express";
import {
  bumpEngagementMetric,
  engagementDel,
  engagementGet,
  engagementSetEx,
  engagementSetNxEx,
  logEngagementMetric,
} from "../lib/engagementRedis";
import logger from "../utils/logger";

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60; // 24h
/** Short enough that a 504 retry is not stuck behind a dead in_progress lock. */
const IN_PROGRESS_TTL_SECONDS = 8;

/** RFC 4122 UUID (any version) */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type StoredIdempotencyRecord = {
  fingerprint: string;
  statusCode: number;
  body: unknown;
  completedAt: string;
};

type InProgressRecord = {
  status: "in_progress";
  fingerprint: string;
};

export function isValidIdempotencyKey(key: string): boolean {
  return UUID_RE.test(key.trim());
}

function fingerprintRequest(req: Request): string {
  const path = `${req.baseUrl || ""}${req.path || ""}` || req.originalUrl || req.url;
  const payload = JSON.stringify({
    method: (req.method || "POST").toUpperCase(),
    path,
    params: req.params || {},
    body: req.body ?? {},
  });
  return createHash("sha256").update(payload).digest("hex");
}

/** User-scoped key — path lives in fingerprint so cross-route reuse conflicts */
export function idempotencyRedisKey(userId: string, key: string): string {
  return `idem:${userId}:${key}`;
}

function shouldPersistStatus(statusCode: number): boolean {
  // Persist business outcomes; never lock a client into a rate-limit response
  if (statusCode === 429) return false;
  if (statusCode === 503) return false;
  return statusCode >= 200 && statusCode < 500;
}

/**
 * Idempotency-Key middleware for toggle-like mutations.
 * - Header present → must be UUID; else 400 INVALID_IDEMPOTENCY_KEY
 * - Key: idem:{userId}:{key} (path/body in fingerprint)
 * - Same key + fingerprint → replay stored response
 * - Same key + different fingerprint → 409 IDEMPOTENCY_CONFLICT
 * - Redis down with key present → fail **open** (process mutation, log warning)
 * - Missing header → no-op
 */
export function idempotencyMiddleware() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const rawKey = req.get("Idempotency-Key") || req.get("idempotency-key");
    if (!rawKey || typeof rawKey !== "string" || !rawKey.trim()) {
      next();
      return;
    }

    const key = rawKey.trim();
    if (!isValidIdempotencyKey(key)) {
      res.status(400).json({
        success: false,
        code: "INVALID_IDEMPOTENCY_KEY",
        message: "Idempotency-Key must be a valid UUID",
        data: {},
      });
      return;
    }

    const userId = (req as any).userId as string | undefined;
    if (!userId) {
      next();
      return;
    }

    const redisKey = idempotencyRedisKey(userId, key);
    const fingerprint = fingerprintRequest(req);
    (req as any).idempotencyRedisKey = redisKey;

    try {
      const existingRaw = await engagementGet(redisKey);

      // engagementGet returns null on Redis failure too — distinguish via NX probe below
      if (existingRaw) {
        try {
          const existing = JSON.parse(existingRaw) as
            | StoredIdempotencyRecord
            | InProgressRecord;

          if ("status" in existing && existing.status === "in_progress") {
            if (existing.fingerprint !== fingerprint) {
              bumpEngagementMetric("idempotencyConflicts");
              res.status(409).json({
                success: false,
                code: "IDEMPOTENCY_CONFLICT",
                message: "Idempotency-Key is already in use for a different request",
                data: {},
              });
              return;
            }
            res.setHeader("Retry-After", "1");
            res.status(409).json({
              success: false,
              code: "IDEMPOTENCY_IN_PROGRESS",
              message: "A request with this Idempotency-Key is already being processed",
              data: { retryAfterSeconds: 1 },
            });
            return;
          }

          const completed = existing as StoredIdempotencyRecord;
          if (completed.fingerprint !== fingerprint) {
            bumpEngagementMetric("idempotencyConflicts");
            res.status(409).json({
              success: false,
              code: "IDEMPOTENCY_CONFLICT",
              message: "Idempotency-Key was reused for a different request",
              data: {},
            });
            return;
          }

          bumpEngagementMetric("idempotencyHits");
          logEngagementMetric("idempotency_replay", {
            userId,
            idempotencyKey: key,
            statusCode: completed.statusCode,
          });
          (req as any).idempotencyReplayed = true;
          res.status(completed.statusCode).json(completed.body);
          return;
        } catch {
          // Corrupt record — overwrite
        }
      }

      const reserved = await engagementSetNxEx(
        redisKey,
        JSON.stringify({ status: "in_progress", fingerprint } satisfies InProgressRecord),
        IN_PROGRESS_TTL_SECONDS
      );

      // null = Redis unavailable — fail open so likes still work locally / during outages
      if (reserved === null) {
        logger.warn("Idempotency store unavailable; failing open (processing without idempotency)", {
          userId,
          idempotencyKey: key,
          path: `${req.baseUrl || ""}${req.path || ""}`,
        });
        logEngagementMetric("idempotency_fail_open", {
          userId,
          idempotencyKey: key,
        });
        delete (req as any).idempotencyRedisKey;
        next();
        return;
      }

      if (!reserved) {
        const raced = await engagementGet(redisKey);
        if (raced) {
          try {
            const parsed = JSON.parse(raced) as StoredIdempotencyRecord & InProgressRecord;
            if (parsed.fingerprint && parsed.fingerprint !== fingerprint) {
              bumpEngagementMetric("idempotencyConflicts");
              res.status(409).json({
                success: false,
                code: "IDEMPOTENCY_CONFLICT",
                message: "Idempotency-Key is already in use for a different request",
                data: {},
              });
              return;
            }
            if (parsed.statusCode && parsed.body !== undefined) {
              bumpEngagementMetric("idempotencyHits");
              (req as any).idempotencyReplayed = true;
              res.status(parsed.statusCode).json(parsed.body);
              return;
            }
          } catch {
            /* fall through */
          }
        }
        res.setHeader("Retry-After", "1");
        res.status(409).json({
          success: false,
          code: "IDEMPOTENCY_IN_PROGRESS",
          message: "A request with this Idempotency-Key is already being processed",
          data: { retryAfterSeconds: 1 },
        });
        return;
      }

      // Persist completed response BEFORE sending so retries never double-toggle
      const originalJson = res.json.bind(res);
      res.json = ((body: unknown) => {
        const statusCode = res.statusCode || 200;
        if (!shouldPersistStatus(statusCode)) {
          // Release reservation so client can retry same key (e.g. after 429)
          void engagementDel(redisKey);
          return originalJson(body);
        }

        const record: StoredIdempotencyRecord = {
          fingerprint,
          statusCode,
          body,
          completedAt: new Date().toISOString(),
        };

        // Persist in the background. Never block the HTTP body on Redis —
        // a hung SET was a production 504 on POST /like.
        const write = engagementSetEx(
          redisKey,
          JSON.stringify(record),
          IDEMPOTENCY_TTL_SECONDS
        ).then(ok => {
          if (!ok) {
            void engagementDel(redisKey);
            logger.warn("Idempotency persist failed; released reservation", { redisKey });
          }
          return ok;
        });

        (res as any).__idempotencyWrite = write;
        return originalJson(body);
      }) as Response["json"];

      next();
    } catch (error: any) {
      logger.warn("Idempotency middleware error; failing open", {
        error: error?.message,
        userId,
        idempotencyKey: key,
      });
      delete (req as any).idempotencyRedisKey;
      next();
    }
  };
}

/** Clear in-progress reservation (e.g. rate limiter rejected after reserve) */
export async function releaseIdempotencyReservation(req: Request): Promise<void> {
  const redisKey = (req as any).idempotencyRedisKey as string | undefined;
  if (!redisKey) return;
  await engagementDel(redisKey);
}
