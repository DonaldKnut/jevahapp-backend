import { Types } from "mongoose";
import { User } from "../../../models/user.model";
import { getCommentEditWindowMs, editComment } from "../comments/comment.edit";
import * as commentRepositoryModule from "../comments/comment.repository";
import * as notifyModule from "../comments/comment.notify";
import * as mediaModule from "../comments/comment.media";
import * as mentionsModule from "../comments/comment.mentions";

jest.mock("../comments/comment.version", () => ({
  bumpCommentsVersion: jest.fn(),
}));

describe("comment.edit", () => {
  const userId = new Types.ObjectId().toString();
  const commentId = new Types.ObjectId().toString();
  const mediaId = new Types.ObjectId();
  let savedWindow: string | undefined;

  beforeEach(() => {
    savedWindow = process.env.COMMENT_EDIT_WINDOW_MS;
  });

  afterEach(() => {
    if (savedWindow === undefined) delete process.env.COMMENT_EDIT_WINDOW_MS;
    else process.env.COMMENT_EDIT_WINDOW_MS = savedWindow;
    jest.restoreAllMocks();
  });

  it("getCommentEditWindowMs defaults to 24h", () => {
    delete process.env.COMMENT_EDIT_WINDOW_MS;
    expect(getCommentEditWindowMs()).toBe(24 * 60 * 60 * 1000);
  });

  it("getCommentEditWindowMs=0 means unlimited", () => {
    process.env.COMMENT_EDIT_WINDOW_MS = "0";
    expect(getCommentEditWindowMs()).toBe(0);
  });

  it("rejects edit outside window", async () => {
    process.env.COMMENT_EDIT_WINDOW_MS = "1000";
    jest.spyOn(commentRepositoryModule.commentRepository, "findComment").mockResolvedValue({
      _id: commentId,
      interactionType: "comment",
      user: { toString: () => userId },
      media: mediaId,
      content: "old",
      imageUrl: null,
      mentions: [],
      createdAt: new Date(Date.now() - 60_000),
    } as any);

    await expect(
      editComment(commentId, userId, { content: "new" })
    ).rejects.toMatchObject({ code: "COMMENT_EDIT_WINDOW_EXPIRED" });
  });

  it("clears image and deletes R2 object", async () => {
    process.env.COMMENT_EDIT_WINDOW_MS = "0";
    const previous = "https://pub-test.r2.dev/jevah/comments/old.jpg";
    jest.spyOn(commentRepositoryModule.commentRepository, "findComment").mockResolvedValue({
      _id: commentId,
      interactionType: "comment",
      user: { toString: () => userId },
      media: mediaId,
      content: "keep",
      imageUrl: previous,
      mentions: [],
      createdAt: new Date(),
    } as any);
    jest
      .spyOn(commentRepositoryModule.commentRepository, "updateCommentFields")
      .mockResolvedValue({} as any);
    jest.spyOn(commentRepositoryModule.commentRepository, "findById").mockReturnValue({
      populate: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: commentId,
          content: "keep",
          imageUrl: null,
          user: { _id: userId, firstName: "A", lastName: "B" },
          createdAt: new Date(),
        }),
      }),
    } as any);
    const del = jest
      .spyOn(mediaModule, "deleteCommentImageFromR2")
      .mockResolvedValue(undefined);

    const out = await editComment(commentId, userId, { clearImage: true });
    expect(del).toHaveBeenCalledWith(previous);
    expect(out.imageUrl).toBeNull();
  });

  it("rejects non-CDN imageUrl", async () => {
    process.env.COMMENT_EDIT_WINDOW_MS = "0";
    process.env.NODE_ENV = "development";
    process.env.R2_PUBLIC_DEV_URL = "https://pub-test.r2.dev";
    delete process.env.R2_CUSTOM_DOMAIN;
    delete process.env.R2_PUBLIC_KEY_PREFIX;

    jest.spyOn(commentRepositoryModule.commentRepository, "findComment").mockResolvedValue({
      _id: commentId,
      interactionType: "comment",
      user: { toString: () => userId },
      media: mediaId,
      content: "keep",
      imageUrl: null,
      mentions: [],
      createdAt: new Date(),
    } as any);

    await expect(
      editComment(commentId, userId, {
        imageUrl: "https://evil.example/hotlink.jpg",
      })
    ).rejects.toMatchObject({ code: "INVALID_IMAGE_URL" });
  });

  it("notifies only newly mentioned users on edit", async () => {
    process.env.COMMENT_EDIT_WINDOW_MS = "0";
    const oldMention = new Types.ObjectId();
    const newMention = new Types.ObjectId();
    jest.spyOn(commentRepositoryModule.commentRepository, "findComment").mockResolvedValue({
      _id: commentId,
      interactionType: "comment",
      user: { toString: () => userId },
      media: mediaId,
      content: "hi",
      imageUrl: null,
      mentions: [{ userId: oldMention }],
      createdAt: new Date(),
    } as any);
    jest
      .spyOn(commentRepositoryModule.commentRepository, "updateCommentFields")
      .mockResolvedValue({} as any);
    jest.spyOn(commentRepositoryModule.commentRepository, "findById").mockReturnValue({
      populate: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: commentId,
          content: "hi @new",
          mentions: [{ userId: oldMention }, { userId: newMention }],
          user: { _id: userId, firstName: "A", lastName: "B" },
          createdAt: new Date(),
        }),
      }),
    } as any);
    jest.spyOn(mentionsModule, "resolveMentions").mockResolvedValue([
      { userId: oldMention },
      { userId: newMention },
    ]);
    const notify = jest
      .spyOn(notifyModule, "notifyMentions")
      .mockImplementation(() => undefined);

    await editComment(commentId, userId, {
      content: "hi @new",
      mentions: [
        { userId: oldMention.toString() },
        { userId: newMention.toString() },
      ],
    });

    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        mentions: [{ userId: newMention }],
      })
    );
  });
});

describe("resolveMentions — drop unknown", () => {
  afterEach(() => jest.restoreAllMocks());

  it("skips missing users", async () => {
    const known = new Types.ObjectId();
    jest.spyOn(User, "findById").mockImplementation((id: any) => {
      return {
        select: () => ({
          lean: async () =>
            String(id) === known.toString()
              ? { _id: known, firstName: "Known", lastName: "User" }
              : null,
        }),
      } as any;
    });

    const { resolveMentions } = await import("../comments/comment.mentions");
    const out = await resolveMentions([
      { userId: known.toString() },
      { userId: new Types.ObjectId().toString() },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].userId.toString()).toBe(known.toString());
  });
});
