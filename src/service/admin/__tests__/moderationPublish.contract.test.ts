import { isPubliclyVisibleMedia } from "../../../lib/publicMediaVisibility";

describe("admin moderation status → feed visibility", () => {
  it("treats approved + live + not hidden as publicly visible", () => {
    expect(
      isPubliclyVisibleMedia({
        moderationStatus: "approved",
        isHidden: false,
        publicationState: "live",
      })
    ).toBe(true);
  });

  it("hides approved-but-still-publishing media from public feed", () => {
    expect(
      isPubliclyVisibleMedia({
        moderationStatus: "approved",
        isHidden: true,
        publicationState: "publishing",
      })
    ).toBe(false);
  });

  it("hides rejected / tombstoned media", () => {
    expect(
      isPubliclyVisibleMedia({
        moderationStatus: "rejected",
        isHidden: true,
        publicationState: "tombstoned",
      })
    ).toBe(false);
  });
});
