import {
  PUBLIC_MEDIA_FILTER,
  isPubliclyVisibleMedia,
} from "../publicMediaVisibility";

describe("publicMediaVisibility contract", () => {
  it("PUBLIC_MEDIA_FILTER requires approved, not-hidden, and live publication", () => {
    expect(PUBLIC_MEDIA_FILTER).toEqual({
      moderationStatus: "approved",
      isHidden: { $ne: true },
      publicationState: {
        $nin: ["draft", "staged", "publishing", "tombstoned"],
      },
    });
  });

  it("isPubliclyVisibleMedia allows approved live (or legacy missing state)", () => {
    expect(
      isPubliclyVisibleMedia({
        moderationStatus: "approved",
        isHidden: false,
      })
    ).toBe(true);
    expect(
      isPubliclyVisibleMedia({
        moderationStatus: "approved",
        isHidden: false,
        publicationState: "live",
      })
    ).toBe(true);
  });

  it("isPubliclyVisibleMedia rejects pending, hidden, and unpublished states", () => {
    expect(
      isPubliclyVisibleMedia({
        moderationStatus: "under_review",
        isHidden: false,
      })
    ).toBe(false);
    expect(
      isPubliclyVisibleMedia({
        moderationStatus: "approved",
        isHidden: true,
      })
    ).toBe(false);
    for (const publicationState of [
      "draft",
      "staged",
      "publishing",
      "tombstoned",
    ]) {
      expect(
        isPubliclyVisibleMedia({
          moderationStatus: "approved",
          isHidden: false,
          publicationState,
        })
      ).toBe(false);
    }
  });

  it("isPubliclyVisibleMedia rejects soft-deleted docs", () => {
    expect(
      isPubliclyVisibleMedia({
        moderationStatus: "approved",
        isHidden: false,
        publicationState: "live",
        deletedAt: new Date(),
      })
    ).toBe(false);
  });
});
