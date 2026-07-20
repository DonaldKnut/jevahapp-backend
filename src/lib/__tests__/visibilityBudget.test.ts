import { PUBLIC_MEDIA_FILTER, isPubliclyVisibleMedia } from "../../lib/publicMediaVisibility";

describe("visibility and AI budget ops", () => {
  it("keeps unpublished media out of public filters", () => {
    expect(PUBLIC_MEDIA_FILTER).toMatchObject({
      moderationStatus: "approved",
      isHidden: { $ne: true },
    });
    expect(
      isPubliclyVisibleMedia({
        moderationStatus: "pending",
        isHidden: true,
      })
    ).toBe(false);
  });

  it("tracks AI budget counters", async () => {
    const { recordAiUsage, getAiBudgetSnapshot, canSpendAiBudget } = await import(
      "../../service/moderation/aiBudget.service"
    );
    await recordAiUsage({ outcome: "quarantine", inputTokens: 100, outputTokens: 20 });
    const snap = await getAiBudgetSnapshot();
    expect(snap.quarantines).toBeGreaterThanOrEqual(1);
    expect(typeof (await canSpendAiBudget())).toBe("boolean");
    expect(snap.limits.maxRequests).toBeGreaterThan(0);
  });
});
