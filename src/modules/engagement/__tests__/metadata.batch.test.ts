import { Types } from "mongoose";

jest.mock("../../../models/media.model", () => ({
  Media: {
    find: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: "id1",
            likeCount: 10,
            shareCount: 2,
            viewCount: 100,
            bookmarkCount: 5,
            commentCount: 3,
          },
        ]),
      }),
    }),
  },
}));

jest.mock("../../../models/interaction.model", () => ({
  Interaction: {
    aggregate: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock("../../../models/like.model", () => ({ Like: { find: jest.fn().mockResolvedValue([]) } }));
jest.mock("../../../models/bookmark.model", () => ({ Bookmark: { find: jest.fn().mockResolvedValue([]) } }));
jest.mock("../../../models/shareEvent.model", () => ({ ShareEvent: { find: jest.fn().mockResolvedValue([]) } }));
jest.mock("../../../models/viewEvent.model", () => ({ ViewEvent: { find: jest.fn().mockResolvedValue([]) } }));
jest.mock("../../../lib/redisCounters", () => ({ getUserLikeState: jest.fn() }));
jest.mock("../../../utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import metadataService from "../metadata/metadata.service";

describe("MetadataService — batch contract", () => {
  it("returns array with expected fields per item", async () => {
    const id = new Types.ObjectId().toString();
    const { Media } = require("../../../models/media.model");
    Media.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { _id: id, likeCount: 10, shareCount: 2, viewCount: 100, bookmarkCount: 5 },
        ]),
      }),
    });

    const result = await metadataService.getBatchContentMetadata(undefined, [id], "media");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id,
      likeCount: 10,
      shareCount: 2,
      viewCount: 100,
      bookmarkCount: 5,
      hasLiked: false,
      hasBookmarked: false,
      hasShared: false,
      hasViewed: false,
    });
  });
});
