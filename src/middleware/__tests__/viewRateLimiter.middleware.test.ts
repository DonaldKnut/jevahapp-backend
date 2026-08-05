/**
 * viewRateLimiter resolves songId (CF) and returns soft 429 with counted:false.
 */
jest.mock("../../lib/redisRateLimit", () => ({
  redisRateLimit: jest.fn(),
}));
jest.mock("../../lib/engagementRedis", () => ({
  bumpEngagementMetric: jest.fn(),
  logEngagementMetric: jest.fn(),
}));

import { redisRateLimit } from "../../lib/redisRateLimit";
import { viewRateLimiter } from "../viewRateLimiter.middleware";

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  return res;
}

describe("viewRateLimiter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("allows when under limit (CF songId)", async () => {
    (redisRateLimit as jest.Mock).mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
    const next = jest.fn();
    const req: any = {
      userId: "u1",
      params: { songId: "692d7baeee2475007039982c" },
    };
    await viewRateLimiter(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
    expect(redisRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        key: expect.stringContaining("view:u1:copyright_free_song:692d7baeee2475007039982c"),
      })
    );
  });

  it("returns 429 VIEW_RATE_LIMITED with counted:false (soft)", async () => {
    (redisRateLimit as jest.Mock).mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 12,
    });
    const next = jest.fn();
    const res = mockRes();
    const req: any = {
      userId: "u1",
      params: { songId: "abc" },
    };
    await viewRateLimiter(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "VIEW_RATE_LIMITED",
        data: expect.objectContaining({ counted: false }),
      })
    );
  });
});
