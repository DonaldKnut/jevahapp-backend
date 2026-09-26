import { hasStrongGospelSignal } from "../offlineModeration";

describe("hasStrongGospelSignal title bypass", () => {
  it("rejects video gospel-title-only even when frames exist", () => {
    expect(
      hasStrongGospelSignal({
        contentType: "videos",
        title: "Jesus Worship Experience",
        description: "party nightclub vibes",
        videoFrames: ["frame"],
      })
    ).toBe(false);
  });

  it("does not treat prayer, amen, ministry, or grace as enough without Jesus", () => {
    expect(
      hasStrongGospelSignal({
        contentType: "videos",
        title: "Sunday talk",
        transcript:
          "Prayer changes things amen. This ministry walks in grace every day as we gather.",
        videoFrames: ["frame"],
      })
    ).toBe(false);
  });

  it("approves Pidgin prayer when they name Jesus", () => {
    expect(
      hasStrongGospelSignal({
        contentType: "videos",
        title: "Morning devotion",
        transcript:
          "Make we pray now. Amen. Jesus dey faithful for this ministry today.",
        videoFrames: ["frame"],
      })
    ).toBe(true);
  });

  it("accepts video when transcript carries gospel evidence", () => {
    expect(
      hasStrongGospelSignal({
        contentType: "videos",
        title: "Sunday clip",
        transcript:
          "We thank Jesus Christ for salvation and the holy spirit in this sermon today amen amen",
        videoFrames: ["frame"],
      })
    ).toBe(true);
  });
});
