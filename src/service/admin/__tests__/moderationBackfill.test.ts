import {
  BACKFILL_FILTERS,
  buildBackfillFilter,
  missingModerationStatusFilter,
} from "../moderationBackfill.service";

describe("moderationBackfill", () => {
  it("exposes missing_or_empty filter", () => {
    expect(BACKFILL_FILTERS).toContain("missing_or_empty");
  });

  it("builds a filter that never targets explicit statuses by value", () => {
    const filter = missingModerationStatusFilter() as any;
    expect(filter.$and).toBeDefined();
    const statusClause = filter.$and[0].$or;
    expect(statusClause).toEqual(
      expect.arrayContaining([
        { moderationStatus: { $exists: false } },
        { moderationStatus: null },
        { moderationStatus: "" },
      ])
    );
    // Must not include rejected / under_review / pending as update targets
    const serialized = JSON.stringify(filter);
    expect(serialized).not.toContain('"rejected"');
    expect(serialized).not.toContain('"under_review"');
    expect(serialized).not.toContain('"pending"');
  });

  it("rejects unknown filter names", () => {
    expect(() => buildBackfillFilter("all" as any)).toThrow(/Unsupported filter/);
  });
});
