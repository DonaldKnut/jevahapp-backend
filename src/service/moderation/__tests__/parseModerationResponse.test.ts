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

  it("allows high-confidence video approve only with frames and a spoken Christ/Scripture anchor", () => {
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
        transcript:
          "We thank Jesus Christ for salvation and the Word of God in this sermon today amen amen",
        videoFrames: ["a", "b"],
        thumbnail: "thumb",
      }
    );
    expect(result.requiresReview).toBe(false);
    expect(result.isApproved).toBe(true);
  });

  it("approves a quiet sermon only when they name Jesus", () => {
    const result = parseModerationResponse(
      JSON.stringify({
        isApproved: true,
        confidence: 0.95,
        requiresReview: false,
        reason: "Pastor-led prayer",
        flags: ["sermon"],
      }),
      {
        contentType: "videos",
        title: "Sunday service",
        transcript:
          "Make we pray. Amen. Jesus dey faithful. This ministry walks in grace.",
        videoFrames: ["a", "b"],
        thumbnail: "thumb",
      }
    );
    expect(result.requiresReview).toBe(false);
    expect(result.isApproved).toBe(true);
  });

  it("holds a prayer/amen sermon that never names Jesus", () => {
    const result = parseModerationResponse(
      JSON.stringify({
        isApproved: true,
        confidence: 0.95,
        requiresReview: false,
        reason: "Pastor-led prayer",
        flags: ["sermon"],
      }),
      {
        contentType: "videos",
        title: "Sunday service",
        transcript:
          "Prayer changes things amen. This ministry will walk in grace as we gather today.",
        videoFrames: ["a", "b"],
        thumbnail: "thumb",
      }
    );
    expect(result.requiresReview).toBe(true);
    expect(result.isApproved).toBe(false);
    expect(result.flags).toContain("gemini_approve_needs_spoken_anchor");
  });

  it("holds a pulpit hustle talk with no sermon or prayer in the transcript", () => {
    const result = parseModerationResponse(
      JSON.stringify({
        isApproved: true,
        confidence: 0.95,
        requiresReview: false,
        reason: "Looks like church",
        flags: ["sermon"],
      }),
      {
        contentType: "videos",
        title: "Sunday motivation",
        transcript:
          "Hustle harder. Mindset is everything. Believe in yourself and get the bag.",
        videoFrames: ["a", "b"],
        thumbnail: "thumb",
      }
    );
    expect(result.requiresReview).toBe(true);
    expect(result.isApproved).toBe(false);
    expect(result.flags).toContain("gemini_approve_needs_spoken_anchor");
  });
});
