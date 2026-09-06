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
