import { hasStrongGospelSignal, transcriptHasGospelLexicon } from "../offlineModeration";

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

  it("approves prayer / amen / ministry / grace as Christian body language", () => {
    expect(
      hasStrongGospelSignal({
        contentType: "videos",
        title: "Sunday talk",
        transcript:
          "Prayer changes things amen. This ministry walks in grace every day as we gather.",
        videoFrames: ["frame"],
      })
    ).toBe(true);
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

  it("approves a John 3:16 Scripture reading without saying Jesus", () => {
    const transcript =
      "For God so loved the world that he gave his only begotten Son, that whosoever believeth in him should not perish but have everlasting life. John 3:16";
    expect(transcriptHasGospelLexicon(transcript)).toBe(true);
    expect(
      hasStrongGospelSignal({
        contentType: "videos",
        title: "Bible reading",
        transcript,
        videoFrames: ["frame"],
      })
    ).toBe(true);
  });

  it("approves a hymn to God without saying Jesus", () => {
    const transcript =
      "Amazing grace how sweet the sound. Glory to God forever. Hallelujah we worship the Lord today.";
    expect(transcriptHasGospelLexicon(transcript)).toBe(true);
    expect(
      hasStrongGospelSignal({
        contentType: "videos",
        title: "Choir night",
        transcript,
        videoFrames: ["frame"],
      })
    ).toBe(true);
  });

  it("does not treat hustle talk as gospel", () => {
    expect(
      hasStrongGospelSignal({
        contentType: "videos",
        title: "Sunday motivation",
        transcript:
          "Hustle harder. Mindset is everything. Believe in yourself and get the bag this week.",
        videoFrames: ["frame"],
      })
    ).toBe(false);
    expect(
      transcriptHasGospelLexicon(
        "Hustle harder. Mindset is everything. Believe in yourself and get the bag this week."
      )
    ).toBe(false);
  });
});
