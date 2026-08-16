/**
 * Bible translation identity for catalog + ?translation= (Phase 1).
 * Storage stays uppercase (WEB); public ids are lowercase (web).
 */
export const DEFAULT_TRANSLATION_ID = "web";

export type TranslationLicense = "public-domain" | "permissive" | "licensed";

export type TranslationCatalogItem = {
  id: string;
  abbreviation: string;
  name: string;
  language: string;
  languageName: string;
  license: TranslationLicense;
  offline: boolean;
  packBytes: number | null;
  verseCount: number;
  isDefault: boolean;
  /** Legacy alias for old { code, name, count } clients */
  code: string;
  count: number;
};

export class UnknownTranslationError extends Error {
  constructor(id: string) {
    super("Unknown translation");
    this.name = "UnknownTranslationError";
    this.message = "Unknown translation";
    (this as any).status = 404;
    (this as any).code = "UNKNOWN_TRANSLATION";
    (this as any).translationId = id;
  }
}

const META: Record<
  string,
  {
    abbreviation: string;
    name: string;
    language: string;
    languageName: string;
    license: TranslationLicense;
  }
> = {
  web: {
    abbreviation: "WEB",
    name: "World English Bible",
    language: "en",
    languageName: "English",
    license: "public-domain",
  },
  kjv: {
    abbreviation: "KJV",
    name: "King James Version",
    language: "en",
    languageName: "English",
    license: "public-domain",
  },
  asv: {
    abbreviation: "ASV",
    name: "American Standard Version",
    language: "en",
    languageName: "English",
    license: "public-domain",
  },
  darby: {
    abbreviation: "DARBY",
    name: "Darby Translation",
    language: "en",
    languageName: "English",
    license: "public-domain",
  },
  ylt: {
    abbreviation: "YLT",
    name: "Young's Literal Translation",
    language: "en",
    languageName: "English",
    license: "public-domain",
  },
  niv: {
    abbreviation: "NIV",
    name: "New International Version",
    language: "en",
    languageName: "English",
    license: "licensed",
  },
  esv: {
    abbreviation: "ESV",
    name: "English Standard Version",
    language: "en",
    languageName: "English",
    license: "licensed",
  },
  nlt: {
    abbreviation: "NLT",
    name: "New Living Translation",
    language: "en",
    languageName: "English",
    license: "licensed",
  },
  amp: {
    abbreviation: "AMP",
    name: "Amplified Bible",
    language: "en",
    languageName: "English",
    license: "licensed",
  },
  nasb: {
    abbreviation: "NASB",
    name: "New American Standard Bible",
    language: "en",
    languageName: "English",
    license: "licensed",
  },
};

/** Public id (`web`) from query or stored `WEB`. */
export function toPublicTranslationId(raw?: string | null): string {
  const t = String(raw || DEFAULT_TRANSLATION_ID)
    .trim()
    .toLowerCase();
  return t || DEFAULT_TRANSLATION_ID;
}

/** Mongo storage code (`WEB`). */
export function toStorageTranslationCode(raw?: string | null): string {
  return toPublicTranslationId(raw).toUpperCase();
}

export function getTranslationMeta(id: string) {
  const publicId = toPublicTranslationId(id);
  return (
    META[publicId] || {
      abbreviation: publicId.toUpperCase(),
      name: publicId.toUpperCase(),
      language: "en",
      languageName: "English",
      license: "licensed" as TranslationLicense,
    }
  );
}

export function isLicensedTranslation(id: string): boolean {
  const publicId = toPublicTranslationId(id);
  return META[publicId]?.license === "licensed";
}

export function shapeCatalogItem(input: {
  storedCode: string;
  verseCount: number;
  packBytes?: number | null;
}): TranslationCatalogItem {
  const id = toPublicTranslationId(input.storedCode);
  const meta = getTranslationMeta(id);
  const licensed = meta.license === "licensed";
  const packBytes =
    licensed || input.packBytes == null || input.packBytes <= 0
      ? null
      : input.packBytes;
  return {
    id,
    abbreviation: meta.abbreviation,
    name: meta.name,
    language: meta.language,
    languageName: meta.languageName,
    license: meta.license,
    offline: packBytes != null,
    packBytes,
    verseCount: input.verseCount,
    isDefault: id === DEFAULT_TRANSLATION_ID,
    code: toStorageTranslationCode(id),
    count: input.verseCount,
  };
}

export function shapeVerseJson(doc: any, translationId?: string) {
  if (!doc) return doc;
  const id = toPublicTranslationId(translationId || doc.translation);
  return {
    _id: doc._id,
    bookName: doc.bookName,
    chapterNumber: doc.chapterNumber,
    verseNumber: doc.verseNumber,
    text: doc.text,
    translation: id,
  };
}

export function unknownTranslationBody() {
  return {
    success: false,
    error: "Unknown translation",
    message: "Unknown translation",
    code: "UNKNOWN_TRANSLATION",
  };
}

export function packUnavailableBody() {
  return {
    success: false,
    error: "Pack unavailable",
    message: "Pack unavailable",
    code: "PACK_UNAVAILABLE",
  };
}
