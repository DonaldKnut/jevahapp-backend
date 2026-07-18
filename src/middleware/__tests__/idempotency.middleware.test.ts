import { Request, Response } from "express";

const store = new Map<string, string>();
let redisDown = false;

jest.mock("../../lib/engagementRedis", () => ({
  engagementGet: jest.fn(),
  engagementSetEx: jest.fn(),
  engagementSetNxEx: jest.fn(),
  engagementDel: jest.fn(),
  bumpEngagementMetric: jest.fn(),
  logEngagementMetric: jest.fn(),
}));

import {
  idempotencyMiddleware,
  idempotencyRedisKey,
  isValidIdempotencyKey,
} from "../idempotency.middleware";
import * as engRedis from "../../lib/engagementRedis";

const VALID_KEY = "550e8400-e29b-41d4-a716-446655440000";
const OTHER_KEY = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

function installStoreMocks() {
  store.clear();
  redisDown = false;
  (engRedis.engagementGet as jest.Mock).mockImplementation(async (key: string) => {
    if (redisDown) return null;
    return store.get(key) ?? null;
  });
  (engRedis.engagementSetEx as jest.Mock).mockImplementation(
    async (key: string, value: string) => {
      if (redisDown) return false;
      store.set(key, value);
      return true;
    }
  );
  (engRedis.engagementSetNxEx as jest.Mock).mockImplementation(
    async (key: string, value: string) => {
      if (redisDown) return null;
      if (store.has(key)) return false;
      store.set(key, value);
      return true;
    }
  );
  (engRedis.engagementDel as jest.Mock).mockImplementation(async (...keys: string[]) => {
    for (const k of keys) store.delete(k);
    return keys.length;
  });
}

function mockRes() {
  const res: Partial<Response> & {
    statusCode: number;
    body?: unknown;
    headers: Record<string, string>;
  } = {
    statusCode: 200,
    headers: {},
    status(code: number) {
      this.statusCode = code;
      return this as Response;
    },
    json(body: unknown) {
      this.body = body;
      return this as Response;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this as Response;
    },
  };
  return res as Response & {
    body?: unknown;
    headers: Record<string, string>;
    __idempotencyWrite?: Promise<unknown>;
  };
}

function makeReq(opts: {
  key?: string | null;
  path?: string;
  userId?: string;
  body?: unknown;
}): Request {
  const path = opts.path || "/media/abc/like";
  return {
    get: (h: string) =>
      opts.key === null
        ? undefined
        : h.toLowerCase() === "idempotency-key"
          ? opts.key ?? VALID_KEY
          : undefined,
    method: "POST",
    originalUrl: `/api/content${path}`,
    baseUrl: "/api/content",
    path,
    params: { contentType: "media", contentId: "abc" },
    body: opts.body ?? {},
    userId: opts.userId ?? "u1",
  } as unknown as Request;
}

describe("idempotencyMiddleware", () => {
  beforeEach(() => {
    installStoreMocks();
    jest.clearAllMocks();
    installStoreMocks();
  });

  it("validates UUID keys", () => {
    expect(isValidIdempotencyKey(VALID_KEY)).toBe(true);
    expect(isValidIdempotencyKey("not-a-uuid")).toBe(false);
    expect(isValidIdempotencyKey("key-12345678")).toBe(false);
  });

  it("no-ops without Idempotency-Key", async () => {
    const next = jest.fn();
    await idempotencyMiddleware()(makeReq({ key: null }), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("returns 400 INVALID_IDEMPOTENCY_KEY for malformed keys", async () => {
    const res = mockRes();
    const next = jest.fn();
    await idempotencyMiddleware()(makeReq({ key: "not-uuid" }), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect((res.body as any).code).toBe("INVALID_IDEMPOTENCY_KEY");
  });

  it("persists response before send and replays same key + fingerprint", async () => {
    const mw = idempotencyMiddleware();
    const req = makeReq({ key: VALID_KEY });
    const res1 = mockRes();
    const next1 = jest.fn(async () => {
      const result = res1.status(200).json({
        success: true,
        data: { liked: true, likeCount: 1 },
      });
      await (result as any);
      await res1.__idempotencyWrite;
    });
    await mw(req, res1, next1);
    expect(next1).toHaveBeenCalled();
    await res1.__idempotencyWrite;

    const stored = store.get(idempotencyRedisKey("u1", VALID_KEY));
    expect(stored).toContain('"liked":true');

    const res2 = mockRes();
    const next2 = jest.fn();
    await mw(req, res2, next2);
    expect(next2).not.toHaveBeenCalled();
    expect(res2.statusCode).toBe(200);
    expect(res2.body).toEqual({ success: true, data: { liked: true, likeCount: 1 } });
    expect(engRedis.bumpEngagementMetric).toHaveBeenCalledWith("idempotencyHits");
  });

  it("returns 409 IDEMPOTENCY_CONFLICT for same key different path", async () => {
    const mw = idempotencyMiddleware();
    const redisKey = idempotencyRedisKey("u1", VALID_KEY);
    store.set(
      redisKey,
      JSON.stringify({
        fingerprint: "different-fingerprint",
        statusCode: 200,
        body: { ok: 1 },
        completedAt: new Date().toISOString(),
      })
    );

    const res = mockRes();
    const next = jest.fn();
    await mw(makeReq({ key: VALID_KEY, path: "/media/other/like" }), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(409);
    expect((res.body as any).code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("returns 409 IDEMPOTENCY_IN_PROGRESS for concurrent same key", async () => {
    const mw = idempotencyMiddleware();
    const redisKey = idempotencyRedisKey("u1", VALID_KEY);
    // First request reserves
    const res1 = mockRes();
    const next1 = jest.fn(); // does not complete
    await mw(makeReq({ key: VALID_KEY }), res1, next1);
    expect(next1).toHaveBeenCalled();
    expect(store.get(redisKey)).toContain("in_progress");

    const res2 = mockRes();
    const next2 = jest.fn();
    await mw(makeReq({ key: VALID_KEY }), res2, next2);
    expect(next2).not.toHaveBeenCalled();
    expect(res2.statusCode).toBe(409);
    expect((res2.body as any).code).toBe("IDEMPOTENCY_IN_PROGRESS");
  });

  it("returns 503 IDEMPOTENCY_UNAVAILABLE when Redis is down", async () => {
    redisDown = true;
    const res = mockRes();
    const next = jest.fn();
    await idempotencyMiddleware()(makeReq({ key: VALID_KEY }), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(503);
    expect((res.body as any).code).toBe("IDEMPOTENCY_UNAVAILABLE");
  });

  it("does not persist 429 and releases reservation", async () => {
    const mw = idempotencyMiddleware();
    const req = makeReq({ key: OTHER_KEY });
    const res = mockRes();
    const next = jest.fn(async () => {
      const result = res.status(429).json({
        success: false,
        code: "LIKE_RATE_LIMITED",
      });
      await (result as any);
    });
    await mw(req, res, next);
    await Promise.resolve();
    expect(store.has(idempotencyRedisKey("u1", OTHER_KEY))).toBe(false);
  });
});
