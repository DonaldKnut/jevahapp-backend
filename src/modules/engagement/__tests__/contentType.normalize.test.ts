import {
  normalizeContentType,
  isUniversalLikeContentType,
  isCommentableContentType,
  assertCommentableContentType,
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

describe("isCommentableContentType / assertCommentableContentType", () => {
  it.each(["media", "video", "audio", "sermon", "ebook", "podcast", "devotional"])(
    "accepts %s",
    (t) => {
      expect(isCommentableContentType(t)).toBe(true);
    }
  );

  it("rejects unsupported types", () => {
    expect(isCommentableContentType("artist")).toBe(false);
    expect(isCommentableContentType("merch")).toBe(false);
    expect(isCommentableContentType("junk")).toBe(false);
    expect(isCommentableContentType(undefined)).toBe(false);
  });

  it("assert returns media | devotional", () => {
    expect(assertCommentableContentType("video")).toBe("media");
    expect(assertCommentableContentType("sermon")).toBe("media");
    expect(assertCommentableContentType("devotional")).toBe("devotional");
  });

  it("assert throws on unsupported", () => {
    expect(() => assertCommentableContentType("artist")).toThrow(/not supported/i);
  });
});
