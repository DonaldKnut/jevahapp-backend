import { mediaContentTypeQuery } from "../mediaContentTypeQuery";

describe("mediaContentTypeQuery", () => {
  it("returns null for ALL / empty", () => {
    expect(mediaContentTypeQuery("ALL")).toBeNull();
    expect(mediaContentTypeQuery("")).toBeNull();
    expect(mediaContentTypeQuery(undefined)).toBeNull();
  });

  it("aliases ebook/books and sermon/sermons", () => {
    expect(mediaContentTypeQuery("ebook")).toEqual({
      contentType: { $in: ["ebook", "books"] },
    });
    expect(mediaContentTypeQuery("books")).toEqual({
      contentType: { $in: ["ebook", "books"] },
    });
    expect(mediaContentTypeQuery("sermons")).toEqual({ contentType: "sermon" });
  });
});
