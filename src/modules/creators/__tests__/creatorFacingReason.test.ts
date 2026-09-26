import {
  JEVAH_GOSPEL_STANDARD,
  creatorFacingModerationReason,
} from "../creatorFacingReason";

describe("creatorFacingModerationReason", () => {
  it("uses the gospel standard on hold and reject", () => {
    const held = creatorFacingModerationReason({ outcome: "under_review" });
    const rejected = creatorFacingModerationReason({ outcome: "rejected" });
    expect(held).toContain(JEVAH_GOSPEL_STANDARD);
    expect(rejected).toContain(JEVAH_GOSPEL_STANDARD);
    expect(rejected).toMatch(/christ-centered/i);
  });

  it("does not leak guardian or gemini jargon", () => {
    const text = creatorFacingModerationReason({
      outcome: "rejected",
      internalReason:
        "Rejected by Content Guardian — content does not match Christian/gospel platform theme",
      flags: ["content_guardian", "secular_off_theme", "gospel:0.12"],
    });
    expect(text).not.toMatch(/guardian|gemini|gospel:0/i);
    expect(text).toContain(JEVAH_GOSPEL_STANDARD);
  });

  it("names safety without exposing detector flags", () => {
    const text = creatorFacingModerationReason({
      outcome: "rejected",
      flags: ["nsfw_reject"],
      internalReason: "nsfw_reject",
    });
    expect(text).toMatch(/safety standards/i);
    expect(text).toContain(JEVAH_GOSPEL_STANDARD);
    expect(text).not.toMatch(/nsfw_reject/);
  });

  it("keeps a human admin note and appends the standard", () => {
    const text = creatorFacingModerationReason({
      outcome: "rejected",
      adminNotes: "Please upload a sermon or worship video.",
    });
    expect(text).toContain("Please upload a sermon or worship video.");
    expect(text).toContain(JEVAH_GOSPEL_STANDARD);
  });

  it("returns empty on approve", () => {
    expect(creatorFacingModerationReason({ outcome: "approved" })).toBe("");
  });
});
