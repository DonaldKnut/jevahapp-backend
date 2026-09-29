import {
  heardTrackDecision,
  creatorTrackHoldForAdmin,
} from "../trackReview.service";

describe("heardTrackDecision", () => {
  it("approves only a clear heard gospel pass", () => {
    expect(heardTrackDecision(["strong_gospel_text"], "approve")).toBe(
      "approved"
    );
  });

  it("rejects safety failures after hearing the track", () => {
    expect(heardTrackDecision(["nsfw_reject"], "reject")).toBe("rejected");
    expect(heardTrackDecision(["drugs_reject"], "reject")).toBe("rejected");
  });

  it("rejects heard off-theme tracks and holds only gray", () => {
    expect(heardTrackDecision(["secular_entertainment"], "reject")).toBe(
      "rejected"
    );
    expect(heardTrackDecision(["gray_zone"], "review")).toBe("under_review");
  });

  it("never auto-publishes creator songs — admin must hear", () => {
    expect(creatorTrackHoldForAdmin("approved")).toBe("under_review");
    expect(creatorTrackHoldForAdmin("under_review")).toBe("under_review");
    expect(creatorTrackHoldForAdmin("rejected")).toBe("rejected");
  });
});
