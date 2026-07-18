import {
  normalizeContentType,
  isUniversalLikeContentType,
} from "../shared/contentType.resolver";

describe("normalizeContentType — feed aliases", () => {
  it.each([
    ["media", "media"],
    ["video", "media"],
    ["videos", "media"],
    ["audio", "media"],
    ["music", "media"],
    ["live", "media"],
    ["sermon", "media"],
    ["sermons", "media"],
    ["teachings", "media"],
    ["ebook", "media"],
    ["podcast", "media"],
    ["Videos", "media"],
  ])("maps %s → %s", (input, expected) => {
    expect(normalizeContentType(input)).toBe(expected);
  });

  it("keeps exact devotional / artist / merch", () => {
    expect(normalizeContentType("devotional")).toBe("devotional");
    expect(normalizeContentType("artist")).toBe("artist");
    expect(normalizeContentType("merch")).toBe("merch");
  });

  it("accepts feed aliases as universal like types", () => {
    expect(isUniversalLikeContentType("videos")).toBe(true);
    expect(isUniversalLikeContentType("sermon")).toBe(true);
    expect(isUniversalLikeContentType("teachings")).toBe(true);
    expect(isUniversalLikeContentType("junk")).toBe(false);
  });
});
