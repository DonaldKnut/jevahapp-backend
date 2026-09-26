import { heardTrackDecision } from "../trackReview.service";

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

  it("sends off-theme and gray tracks to admin, not auto-reject", () => {
    expect(heardTrackDecision(["secular_entertainment"], "reject")).toBe(
      "under_review"
    );
    expect(heardTrackDecision(["gray_zone"], "review")).toBe("under_review");
  });
});
