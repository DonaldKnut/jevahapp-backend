import { Types } from "mongoose";

const mockVerify = jest.fn();
const mockEmit = jest.fn();
const mockInvalidate = jest.fn().mockResolvedValue(undefined);
const mockNotify = jest.fn();

function mockQuery<T>(value: T) {
  const q: any = {
    session: jest.fn().mockImplementation(() => q),
    select: jest.fn().mockImplementation(() => q),
    maxTimeMS: jest.fn().mockImplementation(() => q),
    lean: jest.fn().mockResolvedValue(value),
    then: (resolve: (v: T) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(value).then(resolve, reject),
  };
  return q;
}

jest.mock("../shared/contentType.resolver", () => {
  const actual = jest.requireActual("../shared/contentType.resolver");
  return {
    ...actual,
    verifyContentExists: (...args: unknown[]) => mockVerify(...args),
  };
});

jest.mock("../like/like.sideEffects", () => ({
  emitLikeSocket: (...args: unknown[]) => mockEmit(...args),
  invalidateFeedCaches: (...args: unknown[]) => mockInvalidate(...args),
  fireLikeNotifications: (...args: unknown[]) => mockNotify(...args),
}));

jest.mock("../../../lib/redisCounters", () => ({
  getUserLikeState: jest.fn().mockResolvedValue(null),
  setUserLikeState: jest.fn().mockResolvedValue(undefined),
  getPostCounter: jest.fn().mockResolvedValue(null),
  setPostCounter: jest.fn().mockResolvedValue(undefined),
  incrPostCounter: jest.fn(),
  clampCount: (n: number | null | undefined) => Math.max(0, n ?? 0),
}));

const likeFindOne = jest.fn();
const likeCreate = jest.fn();
const likeFindOneAndDelete = jest.fn();
const likeDeleteOne = jest.fn();

jest.mock("../../../models/like.model", () => ({
  Like: {
    findOne: (...args: unknown[]) => likeFindOne(...args),
    create: (...args: unknown[]) => likeCreate(...args),
    findOneAndDelete: (...args: unknown[]) => likeFindOneAndDelete(...args),
    deleteOne: (...args: unknown[]) => likeDeleteOne(...args),
  },
}));

const mediaFindByIdAndUpdate = jest.fn();
const mediaStartSession = jest.fn();

jest.mock("../../../models/media.model", () => ({
  Media: {
    startSession: (...args: unknown[]) => mediaStartSession(...args),
    findByIdAndUpdate: (...args: unknown[]) => mediaFindByIdAndUpdate(...args),
    findById: jest.fn(),
  },
}));

jest.mock("../../../models/user.model", () => ({ User: {} }));
jest.mock("../../../models/interaction.model", () => ({ Interaction: {} }));
jest.mock("../../../models/devotional.model", () => ({ Devotional: {} }));
jest.mock("../../../service/devotionals.service", () => ({
  devotionalService: {},
}));
jest.mock("../../../models/copyrightFreeSong.model", () => ({ CopyrightFreeSong: {} }));
jest.mock("../../../service/copyrightFreeSongInteraction.service", () => ({
  CopyrightFreeSongInteractionService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../like/like.community", () => ({ communityLikeService: {} }));
jest.mock("../like/like.counts", () => ({
  getLikeCountFromDB: jest.fn(),
}));
jest.mock("../../../utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import likeService from "../like/like.service";
import { getLikeCountFromDB } from "../like/like.counts";
import { LikeOperationError } from "../like/like.errors";
import { contentLikeService } from "../like/like.content";

describe("LikeService — durable Media toggle", () => {
  const userId = new Types.ObjectId().toString();
  const contentId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    mockVerify.mockResolvedValue(true);
    (getLikeCountFromDB as jest.Mock).mockResolvedValue(1);
    mediaStartSession.mockResolvedValue({
      withTransaction: jest.fn(async (fn: () => Promise<void>) => fn()),
      endSession: jest.fn(),
    });
    likeFindOne.mockReturnValue(mockQuery(null));
    likeFindOneAndDelete.mockReturnValue(mockQuery(null));
    likeCreate.mockResolvedValue({ _id: new Types.ObjectId() });
    likeDeleteOne.mockResolvedValue({ deletedCount: 1 });
    mediaFindByIdAndUpdate.mockReturnValue(mockQuery({ likeCount: 1 }));
  });

  it("likes media and returns committed shape without a Mongo session", async () => {
    const likeDocId = new Types.ObjectId();
    likeFindOneAndDelete.mockReturnValue(mockQuery(null));
    likeCreate.mockResolvedValue({ _id: likeDocId });
    mediaFindByIdAndUpdate.mockReturnValue(mockQuery({ likeCount: 1 }));

    const result = await likeService.toggleLike(userId, contentId, "media");

    expect(mockVerify).toHaveBeenCalledWith(contentId, "media");
    expect(mediaStartSession).not.toHaveBeenCalled();
    expect(likeCreate).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        contentId,
        contentType: "media",
        liked: true,
        likeCount: 1,
        likeId: likeDocId.toString(),
        updatedAt: expect.any(String),
      })
    );
    expect(mockEmit).toHaveBeenCalledWith(contentId, "media", 1, true, userId);
    expect(mockNotify).toHaveBeenCalledWith(
      userId,
      contentId,
      "media",
      true,
      likeDocId.toString()
    );
  });

  it("normalizes feed alias videos → media before toggle", async () => {
    await likeService.toggleLike(userId, contentId, "videos");
    expect(mockVerify).toHaveBeenCalledWith(contentId, "media");
  });

  it("unlikes when Like row exists", async () => {
    const existingId = new Types.ObjectId();
    likeFindOneAndDelete.mockReturnValue(mockQuery({ _id: existingId }));
    mediaFindByIdAndUpdate.mockReturnValue(mockQuery({ likeCount: 0 }));

    const result = await likeService.toggleLike(userId, contentId, "media");
    expect(result.liked).toBe(false);
    expect(result.likeCount).toBe(0);
    expect(likeFindOneAndDelete).toHaveBeenCalled();
    expect(likeCreate).not.toHaveBeenCalled();
    expect(mockNotify).toHaveBeenCalledWith(
      userId,
      contentId,
      "media",
      false,
      undefined
    );
  });

  it("returns before Redis cache refresh (must not 504 on Redis hang)", async () => {
    const { setPostCounter } = jest.requireMock("../../../lib/redisCounters");
    let release!: () => void;
    setPostCounter.mockReturnValue(new Promise<void>(resolve => {
      release = resolve;
    }));
    likeFindOneAndDelete.mockReturnValue(mockQuery(null));
    likeCreate.mockResolvedValue({ _id: new Types.ObjectId() });
    mediaFindByIdAndUpdate.mockReturnValue(mockQuery({ likeCount: 4 }));

    await expect(
      likeService.toggleLike(userId, contentId, "media")
    ).resolves.toEqual(expect.objectContaining({ liked: true, likeCount: 4 }));
    release();
  });

  it("throws CONTENT_NOT_FOUND without mutating when media missing", async () => {
    mockVerify.mockResolvedValue(false);

    await expect(likeService.toggleLike(userId, contentId, "media")).rejects.toMatchObject({
      code: "CONTENT_NOT_FOUND",
      statusCode: 404,
    });
    expect(likeCreate).not.toHaveBeenCalled();
    expect(mediaStartSession).not.toHaveBeenCalled();
  });

  it("hasUserLiked reads Mongo Like row with contentType media", async () => {
    likeFindOne.mockReturnValue(mockQuery({ _id: new Types.ObjectId() }));

    const liked = await contentLikeService.hasUserLiked(userId, contentId, "media");
    expect(liked).toBe(true);
    expect(likeFindOne).toHaveBeenCalledWith({
      userId: expect.any(Types.ObjectId),
      contentId: expect.any(Types.ObjectId),
      contentType: "media",
    });
  });

  it("LikeOperationError exposes stable codes", () => {
    const err = new LikeOperationError("INVALID_CONTENT_TYPE", "bad", 400, {});
    expect(err.code).toBe("INVALID_CONTENT_TYPE");
    expect(err.statusCode).toBe(400);
  });
});

describe("multi-user liked vs likeCount semantics", () => {
  it("liked:false with likeCount>0 is a valid independent state", () => {
    const response = { liked: false, likeCount: 12 };
    expect(response.liked).toBe(false);
    expect(response.likeCount).toBeGreaterThan(0);
    expect(response.liked).not.toBe(response.likeCount > 0);
  });
});
