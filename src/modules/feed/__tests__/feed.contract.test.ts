import { FEED_EVENT_TYPES } from "../../../models/feedEvent.model";

describe("feed events contract", () => {
  it("exports expected TikTok ranking event types", () => {
    expect(FEED_EVENT_TYPES).toEqual(
      expect.arrayContaining([
        "impression",
        "watch_time",
        "skip",
        "like",
        "save",
        "share",
      ])
    );
  });
});

describe("for-you response shape (contract)", () => {
  it("documents items + media alias + cursor", () => {
    const sample = {
      success: true,
      data: {
        items: [{ _id: "x", engagementContentType: "media", bookmarkCount: 0 }],
        media: [{ _id: "x", engagementContentType: "media", bookmarkCount: 0 }],
        cursor: "2",
        hasMore: true,
      },
    };
    expect(sample.data.items).toHaveLength(1);
    expect(sample.data.media).toEqual(sample.data.items);
    expect(sample.data.items[0]).toEqual(
      expect.objectContaining({
        engagementContentType: "media",
        bookmarkCount: expect.any(Number),
      })
    );
  });
});
