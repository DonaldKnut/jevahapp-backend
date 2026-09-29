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

  it("allows high-confidence video approve with frames and Christian spoken signal", () => {
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

  it("approves a quiet sermon that names Jesus", () => {
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

  it("approves a John 3:16 reading without saying Jesus", () => {
    const result = parseModerationResponse(
      JSON.stringify({
        isApproved: true,
        confidence: 0.95,
        requiresReview: false,
        reason: "Scripture reading",
        flags: ["biblical"],
      }),
      {
        contentType: "videos",
        title: "Bible reading",
        transcript:
          "For God so loved the world that he gave his only begotten Son, that whosoever believeth in him should not perish but have everlasting life. John 3:16",
        videoFrames: ["a", "b"],
        thumbnail: "thumb",
      }
    );
    expect(result.requiresReview).toBe(false);
    expect(result.isApproved).toBe(true);
  });

  it("approves prayer / amen / ministry language without requiring Jesus by name", () => {
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
    expect(result.requiresReview).toBe(false);
    expect(result.isApproved).toBe(true);
  });

  it("approves via description Scripture when STT is empty", () => {
    const result = parseModerationResponse(
      JSON.stringify({
        isApproved: true,
        confidence: 0.95,
        requiresReview: false,
        reason: "Scripture in description",
        flags: ["biblical"],
      }),
      {
        contentType: "videos",
        title: "Bible reading",
        description:
          "Reading John 3:16 — For God so loved the world that he gave his only begotten Son.",
        transcript: "",
        videoFrames: ["a", "b"],
        thumbnail: "thumb",
      }
    );
    expect(result.requiresReview).toBe(false);
    expect(result.isApproved).toBe(true);
    expect(result.flags).toContain("gemini_approve_via_description_body");
  });

  it("approves via frame OCR when STT is empty", () => {
    const result = parseModerationResponse(
      JSON.stringify({
        isApproved: true,
        confidence: 0.95,
        requiresReview: false,
        reason: "Scripture on screen",
        flags: ["biblical"],
      }),
      {
        contentType: "videos",
        title: "Verse slide",
        transcript: "",
        ocrText:
          "John 3:16 For God so loved the world that he gave his only begotten Son",
        videoFrames: ["a", "b"],
        thumbnail: "thumb",
      }
    );
    expect(result.requiresReview).toBe(false);
    expect(result.isApproved).toBe(true);
    expect(result.flags).toContain("gemini_approve_via_frame_ocr");
  });

  it("holds hustle audio even when description quotes Scripture", () => {
    const result = parseModerationResponse(
      JSON.stringify({
        isApproved: true,
        confidence: 0.95,
        requiresReview: false,
        reason: "Looks religious from description",
        flags: ["biblical"],
      }),
      {
        contentType: "videos",
        title: "Sunday",
        description: "John 3:16 reading night",
        transcript:
          "Hustle harder. Mindset is everything. Believe in yourself and get the bag this week team.",
        videoFrames: ["a", "b"],
        thumbnail: "thumb",
      }
    );
    expect(result.requiresReview).toBe(true);
    expect(result.isApproved).toBe(false);
  });
});
