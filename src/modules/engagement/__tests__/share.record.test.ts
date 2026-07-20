import { Types } from "mongoose";
import * as contentTypeResolver from "../shared/contentType.resolver";
import { ShareEvent } from "../../../models/shareEvent.model";
import { Media } from "../../../models/media.model";

jest.mock("../../../lib/engagementEvents", () => ({
  publishEngagementEvent: jest.fn(),
}));

jest.mock("../../../lib/redisCounters", () => ({
  setPostCounter: jest.fn().mockResolvedValue(undefined),
}));

import shareService from "../share/share.service";

describe("ShareService — recording", () => {
  const userId = new Types.ObjectId().toString();
  const contentId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.spyOn(contentTypeResolver, "verifyContentExists").mockResolvedValue(true);
    jest.spyOn(ShareEvent, "findOne").mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      }),
    } as any);
    jest.spyOn(ShareEvent, "create").mockResolvedValue([{ _id: "se1" }] as any);
    jest.spyOn(Media, "startSession").mockResolvedValue({
      withTransaction: jest.fn(async (fn: () => Promise<void>) => fn()),
      endSession: jest.fn(),
    } as any);
    jest.spyOn(Media, "findById").mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ shareCount: 4 }),
      }),
    } as any);
    jest.spyOn(Media, "findByIdAndUpdate").mockResolvedValue({ shareCount: 4 } as any);
  });

  afterEach(() => jest.restoreAllMocks());

  it("records share and returns count", async () => {
    const result = await shareService.shareContent(userId, contentId, "media", "whatsapp");
    expect(result.shared).toBe(true);
    expect(result.shareCount).toBe(4);
    expect(ShareEvent.create).toHaveBeenCalled();
  });
});
