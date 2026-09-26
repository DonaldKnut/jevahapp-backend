import {
  BUZZING_THRESHOLD,
  creatorNotifyCopy,
  viewMilestoneEvent,
} from "../creatorNotify.catalog";
import { JEVAH_GOSPEL_STANDARD } from "../creatorFacingReason";

describe("creator notify catalog", () => {
  it("covers apply, moderation, report, and music states", () => {
    expect(creatorNotifyCopy("application_received").subject).toMatch(
      /application/i
    );
    expect(creatorNotifyCopy("application_accepted").ctaPath).toBe(
      "/creators/studio"
    );
    expect(
      creatorNotifyCopy("media_rejected", {
        contentTitle: "Sunday sermon",
        reason: JEVAH_GOSPEL_STANDARD,
      }).inboxMessage
    ).toContain(JEVAH_GOSPEL_STANDARD);
    expect(
      creatorNotifyCopy("media_under_review", { contentTitle: "Sunday sermon" })
        .reasonHighlight
    ).toBe(JEVAH_GOSPEL_STANDARD);
    expect(
      creatorNotifyCopy("media_approved", { contentTitle: "Sunday sermon" })
        .subject
    ).toMatch(/Sunday sermon/);
    expect(
      creatorNotifyCopy("media_reported", { contentTitle: "Clip" }).inboxType
    ).toBe("content_report");
    expect(
      creatorNotifyCopy("music_approved", { contentTitle: "New single" }).subject
    ).toMatch(/New single/);
  });

  it("fires view milestones and buzzing at 1000", () => {
    expect(viewMilestoneEvent(99)).toBeNull();
    expect(viewMilestoneEvent(100)).toBe("view_milestone");
    expect(viewMilestoneEvent(BUZZING_THRESHOLD)).toBe("buzzing");
    expect(viewMilestoneEvent(5000)).toBe("view_milestone");
  });
});
