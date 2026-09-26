const {
  resolveBookName,
  parseVerseLine,
  parseVersePerLineText,
  assertProtestantCanon,
  CANONICAL_BOOKS,
} = require("../lib/publicDomainBible");

describe("public-domain Bible parser", () => {
  it("maps Psalm and Song aliases onto Jevah book names", () => {
    expect(resolveBookName("Psalm")).toBe("Psalms");
    expect(resolveBookName("Psalms")).toBe("Psalms");
    expect(resolveBookName("Song of Songs")).toBe("Song of Solomon");
    expect(resolveBookName("1 Corinthians")).toBe("1 Corinthians");
    expect(resolveBookName("Apocalypse")).toBe("Revelation");
    expect(resolveBookName("Canticle of Canticles")).toBe("Song of Solomon");
    expect(resolveBookName("Josue")).toBe("Joshua");
    expect(resolveBookName("PSA")).toBe("Psalms");
    expect(resolveBookName("Gen")).toBe("Genesis");
  });

  it("parses official BSB / eKJV verse-per-line rows", () => {
    const kjv = parseVerseLine(
      "Genesis 1:1 In the beginning God created the heaven and the earth."
    );
    expect(kjv).toEqual({
      bookName: "Genesis",
      chapterNumber: 1,
      verseNumber: 1,
      text: "In the beginning God created the heaven and the earth.",
    });

    const psalm = parseVerseLine(
      "Psalm 23:1 The LORD is my shepherd; I shall not want."
    );
    expect(psalm.bookName).toBe("Psalms");
    expect(psalm.chapterNumber).toBe(23);

    const song = parseVerseLine(
      "Song of Solomon 1:1 The song of songs, which is Solomon's."
    );
    expect(song.bookName).toBe("Song of Solomon");

    const usfm = parseVerseLine("JHN 3:16 For God so loved the world…");
    expect(usfm.bookName).toBe("John");
    expect(usfm.verseNumber).toBe(16);

    const dotted = parseVerseLine(
      "Gen.1:1 In the beginning God created the heaven and the earth."
    );
    expect(dotted.bookName).toBe("Genesis");
  });

  it("skips headers and refuses apocrypha / junk", () => {
    expect(parseVerseLine("Verse Berean Standard Bible")).toBeNull();
    expect(
      parseVerseLine("This text of God's Word has been dedicated to the public domain.")
    ).toBeNull();
    expect(parseVerseLine("Tobit 1:1 The book of the words of Tobit")).toBeNull();
  });

  it("treats BSB empty verse numbers as omissions, not failures", () => {
    const empty = parseVerseLine("Matthew 17:21");
    expect(empty).toEqual({
      bookName: "Matthew",
      chapterNumber: 17,
      verseNumber: 21,
      text: "",
    });
    const { verses, omitted } = parseVersePerLineText(`
Genesis 1:1 In the beginning God created the heavens and the earth.
Matthew 17:21
`);
    expect(verses).toHaveLength(1);
    expect(omitted).toEqual(["Matthew 17:21"]);
  });

  it("dedupes and counts a tiny sample", () => {
    const { verses } = parseVersePerLineText(`
The Holy Bible, Berean Standard Bible
Genesis 1:1 In the beginning God created the heavens and the earth.
Genesis 1:1 In the beginning God created the heavens and the earth.
Psalm 23:1 The LORD is my shepherd; I shall not want.
`);
    expect(verses).toHaveLength(2);
    expect(verses[1].bookName).toBe("Psalms");
  });

  it("rejects a truncated Protestant canon", () => {
    const verses = CANONICAL_BOOKS.map((bookName, i) => ({
      bookName,
      chapterNumber: 1,
      verseNumber: 1,
      text: `verse ${i}`,
    }));
    expect(() => assertProtestantCanon(verses, "KJV")).toThrow(/only 66 verses/);
  });
});
