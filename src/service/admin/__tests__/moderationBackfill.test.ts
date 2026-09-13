import {
  BACKFILL_FILTERS,
  buildBackfillFilter,
  missingModerationStatusFilter,
} from "../moderationBackfill.service";

describe("moderationBackfill", () => {
  it("exposes missing_or_empty filter", () => {
    expect(BACKFILL_FILTERS).toContain("missing_or_empty");
  });

  it("builds a filter that never sets rejected or under_review", () => {
    const filter = missingModerationStatusFilter() as any;
    expect(filter.$and).toBeDefined();
    const serialized = JSON.stringify(filter);
    expect(serialized).toContain("isDefaultContent");
    expect(serialized).toContain("$nin");
    expect(serialized).toContain("moderationStatus");
  });

  it("rejects unknown filter names", () => {
    expect(() => buildBackfillFilter("all" as any)).toThrow(/Unsupported filter/);
  });
});
