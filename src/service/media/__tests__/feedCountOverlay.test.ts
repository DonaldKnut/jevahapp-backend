const mockSafe = jest.fn();

jest.mock("../../../lib/engagementRedis", () => ({
  engagementRedisSafe: (...args: unknown[]) => mockSafe(...args),
}));

jest.mock("../../../models/media.model", () => ({
  Media: {
    find: jest.fn(),
  },
}));

jest.mock("../../../lib/redisCounters", () => {
  const actual = jest.requireActual("../../../lib/redisCounters");
  return {
    ...actual,
    mgetPostCounters: jest.fn(),
    seedPostCountersIfMissing: jest.fn(),
  };
});

import { attachFreshEngagementCounts } from "../feedCountOverlay";
import { mgetPostCounters, seedPostCountersIfMissing } from "../../../lib/redisCounters";

describe("attachFreshEngagementCounts", () => {
  beforeEach(() => jest.clearAllMocks());

  const items = [
    {
      _id: "aaaaaaaaaaaaaaaaaaaaaaaa",
      title: "One",
      likeCount: 3,
      commentCount: 1,
      viewCount: 10,
      shareCount: 0,
      totalLikes: 3,
      totalViews: 10,
    },
    {
      _id: "bbbbbbbbbbbbbbbbbbbbbbbb",
      title: "Two",
      likeCount: 7,
      commentCount: 2,
      viewCount: 20,
      shareCount: 1,
    },
  ];

  it("overlays fresh counts from Redis onto cached items", async () => {
    (mgetPostCounters as jest.Mock).mockResolvedValue(
      new Map([
        ["aaaaaaaaaaaaaaaaaaaaaaaa", { likes: 5, comments: 4, views: 50, shares: 2 }],
      ])
    );
    (seedPostCountersIfMissing as jest.Mock).mockResolvedValue(new Map());

    const out = await attachFreshEngagementCounts(items);

    expect(out[0].likeCount).toBe(5);
    expect(out[0].totalLikes).toBe(5);
    expect(out[0].commentCount).toBe(4);
    expect(out[0].viewCount).toBe(50);
    expect(out[0].shareCount).toBe(2);
    expect(out[1].likeCount).toBe(7);
  });

  it("returns items unchanged when Redis is unavailable", async () => {
    (mgetPostCounters as jest.Mock).mockResolvedValue(null);
    const out = await attachFreshEngagementCounts(items);
    expect(out).toBe(items);
  });

  it("handles empty input without touching Redis", async () => {
    const out = await attachFreshEngagementCounts([]);
    expect(out).toEqual([]);
    expect(mgetPostCounters).not.toHaveBeenCalled();
  });
});
