import { Types } from "mongoose";

jest.mock("../../../lib/redisCounters", () => ({
  getUserLikeState: jest.fn().mockResolvedValue(null),
  setUserLikeState: jest.fn(),
  getPostCounter: jest.fn().mockResolvedValue(10),
  setPostCounter: jest.fn(),
  incrPostCounter: jest.fn().mockImplementation(async ({ delta }: { delta: number }) => 10 + delta),
  clampCount: (n: number | null | undefined) => Math.max(0, n ?? 0),
}));

jest.mock("../../../models/like.model", () => ({
  Like: {
    findOne: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock("../../../service/notification.service", () => ({
  NotificationService: { notifyContentLike: jest.fn(), notifyPublicActivity: jest.fn() },
}));

jest.mock("../../../service/viralContent.service", () => ({
  default: { checkViralMilestones: jest.fn() },
}));

jest.mock("../shared/contentType.resolver", () => ({
  normalizeContentType: (t: string) => t,
  verifyContentExists: jest.fn().mockResolvedValue(true),
  isUserOwnContent: jest.fn().mockResolvedValue(false),
}));

jest.mock("../../../models/media.model", () => ({
  Media: {
    startSession: jest.fn().mockResolvedValue({
      withTransaction: jest.fn(async (fn: () => Promise<void>) => fn()),
      endSession: jest.fn(),
    }),
    findByIdAndUpdate: jest.fn().mockResolvedValue({ likeCount: 1 }),
    findById: jest.fn().mockResolvedValue({ likeCount: 1 }),
  },
}));

import likeService from "../like/like.service";

describe("LikeService — idempotency", () => {
  const userId = new Types.ObjectId().toString();
  const contentId = new Types.ObjectId().toString();

  it("fast toggle returns consistent shape", async () => {
    const result = await likeService.toggleLikeFast(userId, contentId, "media");
    expect(result).toMatchObject({
      contentId,
      liked: expect.any(Boolean),
      likeCount: expect.any(Number),
    });
  });

  it("second fast toggle flips liked state", async () => {
    const { getUserLikeState } = require("../../../lib/redisCounters");
    getUserLikeState.mockResolvedValueOnce(true);
    const result = await likeService.toggleLikeFast(userId, contentId, "media");
    expect(result.liked).toBe(false);
  });
});
