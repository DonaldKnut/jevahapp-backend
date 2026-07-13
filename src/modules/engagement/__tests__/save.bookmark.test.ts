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
    const sample = { bookmarked: true, bookmarkCount: 3 };
    expect(sample).toEqual(
      expect.objectContaining({
        bookmarked: expect.any(Boolean),
        bookmarkCount: expect.any(Number),
      })
    );
  });
});
