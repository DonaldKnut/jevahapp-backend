import { Types } from "mongoose";

jest.mock("../../../models/bookmark.model", () => ({
  Bookmark: {
    startSession: jest.fn(),
    findOne: jest.fn(),
    findByIdAndDelete: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock("../../../models/media.model", () => ({
  Media: {
    findById: jest.fn(),
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
  getBookmarkCount: jest.fn().mockResolvedValue(0),
}));

jest.mock("../../../lib/invalidateFeedCaches", () => ({
  invalidateFeedCaches: jest.fn().mockResolvedValue(undefined),
}));

import { Bookmark } from "../../../models/bookmark.model";
import { Media } from "../../../models/media.model";
import { toggleBookmark } from "../bookmark.toggle";
import { getBookmarkCount } from "../bookmark.query";

describe("toggleBookmark counter floor", () => {
  const userId = new Types.ObjectId().toString();
  const mediaId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    (Media.findById as jest.Mock).mockReturnValue({
      select: () => ({ lean: () => Promise.resolve({ _id: mediaId }) }),
    });
    (getBookmarkCount as jest.Mock).mockResolvedValue(0);

    const session = {
      withTransaction: async (fn: () => Promise<void>) => fn(),
      endSession: jest.fn(),
    };
    (Bookmark.startSession as jest.Mock).mockResolvedValue(session);
  });

  it("uses $max floor pipeline when unbookmarking", async () => {
    const existingId = new Types.ObjectId();
    (Bookmark.findOne as jest.Mock).mockReturnValue({
      session: () =>
        Promise.resolve({
          _id: existingId,
        }),
    });
    (Bookmark.findByIdAndDelete as jest.Mock).mockResolvedValue({});
    (Media.findByIdAndUpdate as jest.Mock).mockResolvedValue({});

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
      ]),
      expect.anything()
    );
  });
});
