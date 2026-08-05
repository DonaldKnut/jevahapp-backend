import { Types } from "mongoose";

jest.mock("../../../models/bookmark.model", () => ({
  Bookmark: {
    findOne: jest.fn(),
    findByIdAndDelete: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock("../../../models/media.model", () => ({
  Media: {
    findById: jest.fn(),
    findOne: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

jest.mock("../../audit.service", () => ({
  AuditService: { logMediaInteraction: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock("../../notification.service", () => ({
  NotificationService: {
    notifyContentBookmark: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("../bookmark.query", () => ({
  getBookmarkCount: jest.fn().mockResolvedValue(1),
}));

jest.mock("../../media/feedUserFlags", () => ({
  setFeedUserBookmarkFlag: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../../modules/engagement/shared/contentType.resolver", () => ({
  MEDIA_LIKE_ALIASES: new Set([
    "media",
    "video",
    "videos",
    "audio",
    "music",
    "live",
    "sermon",
    "sermons",
    "teachings",
    "recording",
    "image",
    "images",
    "ebook",
    "ebooks",
    "e-books",
    "books",
    "podcast",
    "podcasts",
  ]),
  normalizeContentType: (t: string) => t,
  resolveBookmarkableMedia: jest.fn(),
}));

import { Bookmark } from "../../../models/bookmark.model";
import { Media } from "../../../models/media.model";
import {
  toggleBookmark,
  BookmarkToggleError,
} from "../bookmark.toggle";
import { getBookmarkCount } from "../bookmark.query";
import { resolveBookmarkableMedia } from "../../../modules/engagement/shared/contentType.resolver";

describe("toggleBookmark pending / under_review", () => {
  const userId = new Types.ObjectId().toString();
  const mediaId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    (getBookmarkCount as jest.Mock).mockResolvedValue(1);
    (Bookmark.findOne as jest.Mock).mockResolvedValue(null);
    (Bookmark.create as jest.Mock).mockResolvedValue({
      _id: new Types.ObjectId(),
    });
    (Media.findByIdAndUpdate as jest.Mock).mockResolvedValue({});
  });

  it.each(["pending", "under_review", "approved"])(
    "returns bookmarked for moderationStatus=%s (processing pending ok)",
    async (moderationStatus) => {
      (resolveBookmarkableMedia as jest.Mock).mockResolvedValue({
        _id: mediaId,
        moderationStatus,
        processingStatus: "pending",
        deletedAt: null,
      });

      const result = await toggleBookmark(userId, mediaId, "media");
      expect(result.bookmarked).toBe(true);
      expect(result.isBookmarked).toBe(true);
      expect(result.bookmarkCount).toBe(1);
      expect(result.saves).toBe(1);
      expect(Bookmark.create).toHaveBeenCalled();
    }
  );

  it("rejects rejected media with BookmarkToggleError 400", async () => {
    (resolveBookmarkableMedia as jest.Mock).mockResolvedValue({
      _id: mediaId,
      moderationStatus: "rejected",
      processingStatus: "ready",
      deletedAt: null,
    });

    await expect(toggleBookmark(userId, mediaId, "media")).rejects.toEqual(
      expect.objectContaining({
        name: "BookmarkToggleError",
        statusCode: 400,
        code: "MEDIA_REJECTED",
      })
    );
    expect(Bookmark.create).not.toHaveBeenCalled();
  });

  it("404 when media missing / soft-deleted", async () => {
    (resolveBookmarkableMedia as jest.Mock).mockResolvedValue(null);
    await expect(toggleBookmark(userId, mediaId, "media")).rejects.toBeInstanceOf(
      BookmarkToggleError
    );
    try {
      await toggleBookmark(userId, mediaId, "media");
    } catch (e: any) {
      expect(e.statusCode).toBe(404);
    }
  });

  it("uses $max floor pipeline when unbookmarking", async () => {
    (resolveBookmarkableMedia as jest.Mock).mockResolvedValue({
      _id: mediaId,
      moderationStatus: "under_review",
      processingStatus: "pending",
    });
    const existingId = new Types.ObjectId();
    (Bookmark.findOne as jest.Mock).mockResolvedValue({ _id: existingId });
    (Bookmark.findByIdAndDelete as jest.Mock).mockResolvedValue({});
    (getBookmarkCount as jest.Mock).mockResolvedValue(0);

    const result = await toggleBookmark(userId, mediaId, "media");
    expect(result.bookmarked).toBe(false);
    expect(Media.findByIdAndUpdate).toHaveBeenCalledWith(
      mediaId,
      expect.arrayContaining([
        expect.objectContaining({
          $set: expect.objectContaining({
            bookmarkCount: expect.objectContaining({ $max: expect.any(Array) }),
          }),
        }),
      ])
    );
  });
});
