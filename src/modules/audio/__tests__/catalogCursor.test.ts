import {
  encodeCatalogCursor,
  decodeCatalogCursor,
  catalogCursorFilter,
} from "../catalogCursor";

describe("catalogCursor", () => {
  it("round-trips cursor payload", () => {
    const enc = encodeCatalogCursor({
      t: "2026-07-30T00:00:00.000Z",
      i: "64f000000000000000000001",
    });
    expect(decodeCatalogCursor(enc)).toEqual({
      t: "2026-07-30T00:00:00.000Z",
      i: "64f000000000000000000001",
    });
  });

  it("builds descending filter with ObjectId", () => {
    const f = catalogCursorFilter(
      { t: "2026-07-30T00:00:00.000Z", i: "64f000000000000000000001" },
      "publishedAt",
      "desc"
    );
    expect(f).toBeTruthy();
    expect(JSON.stringify(f)).toContain("$lt");
  });
});
