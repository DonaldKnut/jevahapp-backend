import {
  DEFAULT_TRANSLATION_ID,
  shapeCatalogItem,
  shapeVerseJson,
  toPublicTranslationId,
  toStorageTranslationCode,
} from "../bibleTranslations";

describe("bible translation ids", () => {
  it("defaults and normalizes WEB/web", () => {
    expect(DEFAULT_TRANSLATION_ID).toBe("web");
    expect(toPublicTranslationId("WEB")).toBe("web");
    expect(toPublicTranslationId("kjv")).toBe("kjv");
    expect(toStorageTranslationCode("web")).toBe("WEB");
  });

  it("shapes catalog with lowercase id and public-domain WEB", () => {
    const item = shapeCatalogItem({ storedCode: "WEB", verseCount: 31102 });
    expect(item.id).toBe("web");
    expect(item.isDefault).toBe(true);
    expect(item.license).toBe("public-domain");
    expect(item.offline).toBe(false);
    expect(item.packBytes).toBeNull();
    expect(item.abbreviation).toBe("WEB");
  });

  it("marks offline when a pack exists", () => {
    const item = shapeCatalogItem({
      storedCode: "WEB",
      verseCount: 31102,
      packBytes: 4_200_000,
    });
    expect(item.offline).toBe(true);
    expect(item.packBytes).toBe(4_200_000);
  });

  it("never marks licensed translations offline", () => {
    const item = shapeCatalogItem({
      storedCode: "NIV",
      verseCount: 31000,
      packBytes: 4_200_000,
    });
    expect(item.license).toBe("licensed");
    expect(item.offline).toBe(false);
    expect(item.packBytes).toBeNull();
  });

  it("stamps translation on verse JSON", () => {
    const v = shapeVerseJson(
      {
        _id: "abc",
        bookName: "John",
        chapterNumber: 3,
        verseNumber: 16,
        text: "For God so loved the world...",
        translation: "WEB",
      },
      "web"
    );
    expect(v.translation).toBe("web");
    expect(v.bookName).toBe("John");
  });
});
