const mockDelPattern = jest.fn(async (_pattern?: string) => undefined);
const mockBump = jest.fn();

jest.mock("../../service/cache.service", () => ({
  __esModule: true,
  default: {
    delPattern: (pattern: string) => mockDelPattern(pattern),
  },
}));

jest.mock("../engagementRedis", () => ({
  bumpEngagementMetric: (...args: any[]) => mockBump(...args),
  engagementRedisSafe: jest.fn(async (_name: string, fn: any) => {
    const redis = {
      get: jest.fn(async () => "1"),
      incr: jest.fn(async () => 2),
    };
    return fn(redis);
  }),
}));

import { invalidateFeedCaches } from "../invalidateFeedCaches";
import { engagementRedisSafe } from "../engagementRedis";
import { FEED_GLOBAL_PATTERN, feedUserPattern } from "../cacheKeys";

describe("invalidateFeedCaches", () => {
  beforeEach(() => {
    mockDelPattern.mockClear();
    (engagementRedisSafe as jest.Mock).mockClear();
  });

  it("bumps generation and cleans legacy/user patterns", async () => {
    await invalidateFeedCaches("content1", "user1");
    expect(engagementRedisSafe).toHaveBeenCalledWith(
      "feedGenerationBump",
      expect.any(Function),
      null
    );
    expect(mockDelPattern).toHaveBeenCalledWith(FEED_GLOBAL_PATTERN);
    expect(mockDelPattern).toHaveBeenCalledWith(feedUserPattern("user1"));
  });
});
