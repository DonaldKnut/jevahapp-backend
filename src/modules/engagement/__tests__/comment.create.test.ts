import { Types } from "mongoose";
import { Media } from "../../../models/media.model";
import * as commentRepositoryModule from "../comments/comment.repository";
import * as commentRealtime from "../comments/comment.realtime";

jest.mock("../../../lib/engagementEvents", () => ({
  publishEngagementEvent: jest.fn(),
}));

jest.mock("../../../lib/redisCounters", () => ({
  setPostCounter: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../comments/comment.version", () => ({
  bumpCommentsVersion: jest.fn(),
  getCommentsVersion: jest.fn().mockResolvedValue(0),
}));

jest.mock("../../../service/notification.service", () => ({
  NotificationService: {
    notifyContentComment: jest.fn().mockResolvedValue(undefined),
    notifyCommentReply: jest.fn().mockResolvedValue(undefined),
  },
}));

import commentService from "../comments/comment.service";

describe("CommentService — create contract", () => {
  const userId = new Types.ObjectId().toString();
  const contentId = new Types.ObjectId().toString();
  const commentId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.spyOn(Media, "startSession").mockResolvedValue({
      withTransaction: jest.fn(async (fn: () => Promise<unknown>) => fn()),
      endSession: jest.fn(),
    } as any);
    jest.spyOn(Media, "findByIdAndUpdate").mockResolvedValue({ commentCount: 1 } as any);
    jest.spyOn(Media, "findById").mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          likeCount: 2,
          shareCount: 0,
          viewCount: 10,
          commentCount: 1,
          uploadedBy: new Types.ObjectId(),
          title: "Test",
        }),
      }),
    } as any);
    jest.spyOn(commentRepositoryModule.commentRepository, "create").mockResolvedValue({
      _id: commentId,
      content: "Amen!",
      createdAt: new Date(),
    } as any);
    jest.spyOn(commentRepositoryModule.commentRepository, "findById").mockReturnValue({
      populate: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: commentId,
          content: "Amen!",
          createdAt: new Date(),
          user: { _id: userId, firstName: "Test", lastName: "User" },
        }),
      }),
    } as any);
    jest
      .spyOn(commentRepositoryModule.commentRepository, "incrementReplyCount")
      .mockResolvedValue(undefined);
    jest.spyOn(commentRealtime, "emitCommentRoomEvents").mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it("returns formatted comment shape", async () => {
    const result = await commentService.addComment(userId, contentId, "media", "Amen!");
    expect(result).toMatchObject({
      content: "Amen!",
      authorId: userId,
      likesCount: 0,
    });
  });

  it("emits room fan-out after commit", async () => {
    await commentService.addComment(userId, contentId, "media", "Amen!");
    expect(commentRealtime.emitCommentRoomEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        contentId,
        contentType: "media",
        commentCount: 1,
      })
    );
  });
});
