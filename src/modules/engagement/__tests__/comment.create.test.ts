import { Types } from "mongoose";
import { Media } from "../../../models/media.model";
import * as commentRepositoryModule from "../comments/comment.repository";

jest.mock("../../../lib/engagementEvents", () => ({
  publishEngagementEvent: jest.fn(),
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
    jest.spyOn(commentRepositoryModule.commentRepository, "incrementReplyCount").mockResolvedValue(undefined);
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
});
