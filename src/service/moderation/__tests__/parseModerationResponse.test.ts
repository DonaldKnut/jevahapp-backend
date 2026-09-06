import { parseModerationResponse } from "../parseModerationResponse";

describe("parseModerationResponse video title bypass", () => {
  it("does not auto-clear review for videos based on gospel flags alone", () => {
    const result = parseModerationResponse(
      JSON.stringify({
        isApproved: true,
        confidence: 0.92,
        requiresReview: true,
        reason: "Title mentions Jesus",
        flags: ["gospel", "christian"],
      }),
      {
        contentType: "videos",
        title: "Jesus Worship Night",
        videoFrames: ["frame1"],
      }
    );
    expect(result.requiresReview).toBe(true);
    expect(result.isApproved).toBe(false);
  });

  it("quarantines videos with no frame/thumbnail evidence even if model approves", () => {
    const result = parseModerationResponse(
      JSON.stringify({
        isApproved: true,
        confidence: 0.99,
        requiresReview: false,
        reason: "Gospel title",
        flags: ["gospel"],
      }),
      {
        contentType: "videos",
        title: "Jesus is Lord",
      }
    );
    expect(result.requiresReview).toBe(true);
    expect(result.isApproved).toBe(false);
    expect(result.flags).toContain("video_missing_visual_evidence");
  });

  it("allows high-confidence video approve only when frames exist and model did not request review", () => {
    const result = parseModerationResponse(
      JSON.stringify({
        isApproved: true,
        confidence: 0.95,
        requiresReview: false,
        reason: "Church sermon with scripture",
        flags: ["sermon", "biblical"],
      }),
      {
        contentType: "videos",
        title: "Sunday Service",
        videoFrames: ["a", "b"],
        thumbnail: "thumb",
      }
    );
    expect(result.requiresReview).toBe(false);
    expect(result.isApproved).toBe(true);
  });
});
