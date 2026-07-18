import { Types } from "mongoose";

describe("SaveService — bookmark contract", () => {
  it("validates ObjectId before toggle", async () => {
    const { UnifiedBookmarkService } = await import("../../../service/unifiedBookmark.service");
    await expect(
      UnifiedBookmarkService.toggleBookmark("bad-id", "also-bad")
    ).rejects.toThrow("Invalid user or media ID");
  });

  it("exports toggleBookmark as a static method", async () => {
    const { UnifiedBookmarkService } = await import("../../../service/unifiedBookmark.service");
    expect(typeof UnifiedBookmarkService.toggleBookmark).toBe("function");
  });

  it("toggle result shape matches frontend contract", () => {
    const sample = {
      contentId: "507f1f77bcf86cd799439011",
      bookmarked: true,
      isBookmarked: true,
      bookmarkCount: 3,
      saves: 3,
    };
    expect(sample).toEqual(
      expect.objectContaining({
        contentId: expect.any(String),
        bookmarked: expect.any(Boolean),
        isBookmarked: expect.any(Boolean),
        bookmarkCount: expect.any(Number),
        saves: expect.any(Number),
      })
    );
  });

  it("maps feed contentType aliases to media", async () => {
    const { mapBookmarkContentType } = await import(
      "../../../service/bookmark/bookmark.toggle"
    );
    expect(mapBookmarkContentType("videos")).toBe("media");
    expect(mapBookmarkContentType("sermon")).toBe("media");
    expect(mapBookmarkContentType("copyright_free_song")).toBe(
      "copyright_free_song"
    );
  });
});
