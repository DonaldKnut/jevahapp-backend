import { matchModerationBlocklist } from "../moderationBlocklist";

describe("matchModerationBlocklist", () => {
  it("matches strong policy phrases", () => {
    expect(matchModerationBlocklist("Check out this ashawo video")).not.toBeNull();
    expect(matchModerationBlocklist("strip club vibes")).not.toBeNull();
  });

  it("does not reject sermon-style mention of cultural words removed from blocklist", () => {
    expect(matchModerationBlocklist("Pastor warned about yansh culture and modesty")).toBeNull();
    expect(matchModerationBlocklist("We must not celebrate bumbum as Christians")).toBeNull();
  });

  it("matches regex profanity as hard", () => {
    expect(matchModerationBlocklist("this is bullshit content")?.severity).toBe("hard");
  });

  it("marks ambiguous English tokens as soft", () => {
    expect(matchModerationBlocklist("Brother Dick taught Romans")?.severity).toBe("soft");
  });
});