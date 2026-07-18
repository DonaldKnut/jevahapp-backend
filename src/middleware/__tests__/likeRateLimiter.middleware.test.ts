import { Request, Response } from "express";

jest.mock("../../lib/redisRateLimit", () => ({
  redisRateLimit: jest.fn(),
}));

jest.mock("../../lib/engagementRedis", () => ({
  bumpEngagementMetric: jest.fn(),
  logEngagementMetric: jest.fn(),
}));

import { likeRateLimiter } from "../likeRateLimiter.middleware";
import { redisRateLimit } from "../../lib/redisRateLimit";
import { bumpEngagementMetric } from "../../lib/engagementRedis";

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
  return res as Response & { body?: unknown; headers: Record<string, string> };
}

describe("likeRateLimiter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("allows when under both limits", async () => {
    (redisRateLimit as jest.Mock)
      .mockResolvedValueOnce({ allowed: true, remaining: 3, retryAfterSeconds: 0 })
      .mockResolvedValueOnce({ allowed: true, remaining: 59, retryAfterSeconds: 0 });

    const next = jest.fn();
    const req = {
      userId: "u1",
      params: { contentType: "videos", contentId: "m1" },
    } as unknown as Request;

    await likeRateLimiter(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
    expect(redisRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ key: "like:u1:media:m1", limit: 4 })
    );
    expect(redisRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ key: "like:u1", limit: 60 })
    );
  });

  it("returns 429 LIKE_RATE_LIMITED with Retry-After and does not call next", async () => {
    (redisRateLimit as jest.Mock).mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 8,
    });

    const next = jest.fn();
    const res = mockRes();
    const req = {
      userId: "u1",
      params: { contentType: "media", contentId: "m1" },
    } as unknown as Request;

    await likeRateLimiter(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
    expect(res.headers["Retry-After"]).toBe("8");
    expect((res.body as any).code).toBe("LIKE_RATE_LIMITED");
    expect((res.body as any).data.retryAfterSeconds).toBe(8);
    expect(bumpEngagementMetric).toHaveBeenCalledWith("rateLimitRejections");
  });
});
