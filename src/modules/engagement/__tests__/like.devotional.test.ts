const mockLikeDevotional = jest.fn();
const mockHasUserLikedDevotional = jest.fn();

jest.mock("../../../service/devotionals.service", () => ({
  __esModule: true,
  devotionalService: {
    likeDevotional: (...args: unknown[]) => mockLikeDevotional(...args),
    hasUserLikedDevotional: (...args: unknown[]) => mockHasUserLikedDevotional(...args),
  },
}));

jest.mock("../../../models/devotional.model", () => ({
  Devotional: {
    findById: jest.fn(),
  },
}));

jest.mock("../../../models/copyrightFreeSong.model", () => ({ CopyrightFreeSong: {} }));
jest.mock("../../../service/copyrightFreeSongInteraction.service", () => ({
  CopyrightFreeSongInteractionService: jest.fn(),
}));
jest.mock("../like/like.content", () => ({
  contentLikeService: { isSupported: () => false },
}));
jest.mock("../like/like.community", () => ({
  communityLikeService: {},
}));
jest.mock("../../../lib/redisCounters", () => ({
  getPostCounter: jest.fn(),
  setPostCounter: jest.fn(),
  clampCount: (n: number | null | undefined) => Math.max(0, n ?? 0),
}));
jest.mock("../../../utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { Types } from "mongoose";
import likeService from "../like/like.service";

describe("LikeService — devotional", () => {
  const userId = new Types.ObjectId().toString();
  const contentId = new Types.ObjectId().toString();

  beforeEach(() => {
    mockLikeDevotional.mockReset();
    mockHasUserLikedDevotional.mockReset();
    mockLikeDevotional.mockResolvedValue({ liked: true, likeCount: 5 });
    mockHasUserLikedDevotional.mockResolvedValue(true);
  });

  it("toggleLikeFast delegates to devotionalService", async () => {
    const result = await likeService.toggleLikeFast(userId, contentId, "devotional");
    expect(mockLikeDevotional).toHaveBeenCalledWith({ userId, devotionalId: contentId });
    expect(result).toEqual(
      expect.objectContaining({ contentId, liked: true, likeCount: 5, contentType: "devotional" })
    );
  });

  it("toggleLike durably toggles devotionals (no background read-only path)", async () => {
    const result = await likeService.toggleLike(userId, contentId, "devotional");
    expect(mockLikeDevotional).toHaveBeenCalledWith({ userId, devotionalId: contentId });
    expect(result).toEqual(
      expect.objectContaining({ contentId, liked: true, likeCount: 5, contentType: "devotional" })
    );
  });
});
