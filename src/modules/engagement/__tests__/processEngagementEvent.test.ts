import { processEngagementEvent } from "../../../lib/processEngagementEvent";

jest.mock("../../../models/analyticsEvent.model", () => ({
  AnalyticsEvent: { create: jest.fn().mockResolvedValue({}) },
}));

jest.mock("../../../models/media.model", () => ({
  Media: { findByIdAndUpdate: jest.fn().mockResolvedValue({}) },
}));

import { Media } from "../../../models/media.model";

describe("processEngagementEvent — count safety", () => {
  beforeEach(() => jest.clearAllMocks());

  it("clamps negative likeCount before syncing Media.totalLikes", async () => {
    await processEngagementEvent("content.like_toggled", {
      contentId: "507f1f77bcf86cd799439011",
      contentType: "media",
      likeCount: -2,
      liked: false,
      userId: "507f1f77bcf86cd799439012",
    });

    expect(Media.findByIdAndUpdate).toHaveBeenCalledWith(
      "507f1f77bcf86cd799439011",
      { $set: { totalLikes: 0 } }
    );
  });
});
