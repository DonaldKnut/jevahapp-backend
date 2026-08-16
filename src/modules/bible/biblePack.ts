import { createHash } from "crypto";
import { gzipSync } from "zlib";
import fileUploadService, {
  isAllowedCdnUrl,
} from "../../service/fileUpload.service";
import {
  isLicensedTranslation,
  toPublicTranslationId,
  type TranslationLicense,
} from "./bibleTranslations";

export const BIBLE_PACK_SCHEMA = "jevah-bible-pack-v1" as const;
export const LITE_PACK_MAX_BYTES = 12 * 1024 * 1024;
const MANIFEST_MAX_BYTES = 64 * 1024;
const PACK_BYTES_HARD_MAX = 32 * 1024 * 1024;

export type BiblePackManifest = {
  translationId: string;
  packVersion: number;
  contentHash: string;
  bytes: number;
  encoding: "gzip-json";
  schema: typeof BIBLE_PACK_SCHEMA;
  packUrl: string;
  license: TranslationLicense;
  updatedAt: string;
};

export type BiblePackBook = {
  id: string;
  name: string;
  testament: "old" | "new";
  chapterCount: number;
  verseCount: number;
};

export type BiblePackJson = {
  schema: typeof BIBLE_PACK_SCHEMA;
  translationId: string;
  packVersion: number;
  books: BiblePackBook[];
  chapters: Record<string, Array<{ v: number; t: string }>>;
};

const manifestCache = new Map<
  string,
  { at: number; manifest: BiblePackManifest | null }
>();
const MANIFEST_CACHE_MS = 10 * 60 * 1000;

export function packObjectKey(translationId: string, version: number): string {
  return `bible/packs/${toPublicTranslationId(translationId)}/v${version}.json.gz`;
}

export function packManifestKey(translationId: string): string {
  return `bible/packs/${toPublicTranslationId(translationId)}/manifest.json`;
}

export function bookCanonicalId(abbreviation: string, name: string): string {
  const raw = String(abbreviation || name || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
  return raw.slice(0, 6) || "UNK";
}

export function buildBiblePackJson(input: {
  translationId: string;
  packVersion: number;
  books: Array<{
    name: string;
    abbreviation?: string;
    testament?: string;
    chapters?: number;
  }>;
  verses: Array<{
    bookName: string;
    chapterNumber: number;
    verseNumber: number;
    text: string;
  }>;
}): BiblePackJson {
  const translationId = toPublicTranslationId(input.translationId);
  const chapters: BiblePackJson["chapters"] = {};
  const verseCountByBook = new Map<string, number>();
  const chapterSetByBook = new Map<string, Set<number>>();

  for (const verse of input.verses) {
    const bookName = String(verse.bookName || "").trim();
    if (!bookName) continue;
    const key = `${bookName}:${verse.chapterNumber}`;
    if (!chapters[key]) chapters[key] = [];
    chapters[key].push({
      v: Number(verse.verseNumber),
      t: String(verse.text || ""),
    });
    verseCountByBook.set(bookName, (verseCountByBook.get(bookName) || 0) + 1);
    if (!chapterSetByBook.has(bookName)) chapterSetByBook.set(bookName, new Set());
    chapterSetByBook.get(bookName)!.add(Number(verse.chapterNumber));
  }

  for (const rows of Object.values(chapters)) {
    rows.sort((a, b) => a.v - b.v);
  }

  const books: BiblePackBook[] = input.books.map(b => {
    const name = String(b.name || "").trim();
    const chapterCount =
      chapterSetByBook.get(name)?.size || Number(b.chapters || 0);
    return {
      id: bookCanonicalId(b.abbreviation || "", name),
      name,
      testament: b.testament === "new" ? "new" : "old",
      chapterCount,
      verseCount: verseCountByBook.get(name) || 0,
    };
  });

  const named = new Set(books.map(b => b.name));
  for (const name of verseCountByBook.keys()) {
    if (named.has(name)) continue;
    books.push({
      id: bookCanonicalId("", name),
      name,
      testament: "old",
      chapterCount: chapterSetByBook.get(name)?.size || 0,
      verseCount: verseCountByBook.get(name) || 0,
    });
  }

  return {
    schema: BIBLE_PACK_SCHEMA,
    translationId,
    packVersion: input.packVersion,
    books,
    chapters,
  };
}

export function gzipPack(json: BiblePackJson): {
  uncompressed: Buffer;
  gzip: Buffer;
  contentHash: string;
} {
  const uncompressed = Buffer.from(JSON.stringify(json), "utf8");
  const gzip = gzipSync(uncompressed, { level: 9 });
  const contentHash = `sha256-${createHash("sha256").update(uncompressed).digest("hex")}`;
  return { uncompressed, gzip, contentHash };
}

export function parsePackManifest(raw: unknown): BiblePackManifest | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.schema !== BIBLE_PACK_SCHEMA || o.encoding !== "gzip-json") return null;
  const packUrl = String(o.packUrl || "");
  if (!isAllowedCdnUrl(packUrl)) return null;
  const packVersion = Number(o.packVersion);
  if (!Number.isInteger(packVersion) || packVersion < 1) return null;
  const bytes = Number(o.bytes);
  if (!Number.isFinite(bytes) || bytes < 1 || bytes > PACK_BYTES_HARD_MAX) {
    return null;
  }
  const contentHash = String(o.contentHash || "");
  if (!/^sha256-[a-f0-9]{64}$/.test(contentHash)) return null;
  const translationId = toPublicTranslationId(String(o.translationId || ""));
  if (!translationId || isLicensedTranslation(translationId)) return null;
  const license: TranslationLicense =
    o.license === "permissive" ? "permissive" : "public-domain";
  return {
    translationId,
    packVersion,
    contentHash,
    bytes,
    encoding: "gzip-json",
    schema: BIBLE_PACK_SCHEMA,
    packUrl,
    license,
    updatedAt: String(o.updatedAt || ""),
  };
}

export async function loadPackManifest(
  translationId: string
): Promise<BiblePackManifest | null> {
  const id = toPublicTranslationId(translationId);
  const cached = manifestCache.get(id);
  const now = Date.now();
  if (cached && now - cached.at < MANIFEST_CACHE_MS) {
    return cached.manifest;
  }
  try {
    const buf = await fileUploadService.getObjectBuffer(packManifestKey(id), {
      maxBytes: MANIFEST_MAX_BYTES,
    });
    if (!buf) {
      manifestCache.set(id, { at: now, manifest: null });
      return null;
    }
    const parsed = parsePackManifest(JSON.parse(buf.toString("utf8")));
    manifestCache.set(id, { at: now, manifest: parsed });
    return parsed;
  } catch {
    manifestCache.set(id, { at: now, manifest: null });
    return null;
  }
}

export function clearPackManifestCache(): void {
  manifestCache.clear();
}

export async function publishPackToR2(input: {
  translationId: string;
  packVersion: number;
  gzip: Buffer;
  contentHash: string;
  license: TranslationLicense;
}): Promise<BiblePackManifest> {
  const id = toPublicTranslationId(input.translationId);
  if (input.gzip.length > LITE_PACK_MAX_BYTES) {
    throw new Error(
      `Pack gzip ${input.gzip.length} bytes exceeds ${LITE_PACK_MAX_BYTES} (Lite max)`
    );
  }
  const key = packObjectKey(id, input.packVersion);
  const uploaded = await fileUploadService.uploadObjectExact(
    key,
    input.gzip,
    "application/gzip",
    "public, max-age=31536000, immutable"
  );
  const manifest: BiblePackManifest = {
    translationId: id,
    packVersion: input.packVersion,
    contentHash: input.contentHash,
    bytes: input.gzip.length,
    encoding: "gzip-json",
    schema: BIBLE_PACK_SCHEMA,
    packUrl: uploaded.secure_url,
    license: input.license,
    updatedAt: new Date().toISOString(),
  };
  await fileUploadService.uploadObjectExact(
    packManifestKey(id),
    Buffer.from(JSON.stringify(manifest), "utf8"),
    "application/json",
    "public, max-age=300"
  );
  manifestCache.set(id, { at: Date.now(), manifest });
  return manifest;
}

export function licenseDeniedBody() {
  return {
    success: false,
    error: "Translation requires license",
    message: "Translation requires license",
    code: "TRANSLATION_LICENSED",
  };
}

export function packTooLargeForLiteBody() {
  return {
    success: false,
    error: "Pack too large for lite",
    message: "Pack too large for lite",
    code: "PACK_TOO_LARGE_LITE",
  };
}

export function assertPackDownloadAllowed(
  translationId: string,
  manifest: BiblePackManifest | null,
  isLite: boolean
): { ok: true } | { ok: false; status: number; body: Record<string, unknown> } {
  if (isLicensedTranslation(translationId)) {
    return { ok: false, status: 403, body: licenseDeniedBody() };
  }
  if (!manifest || !isAllowedCdnUrl(manifest.packUrl)) {
    return {
      ok: false,
      status: 404,
      body: {
        success: false,
        error: "Pack unavailable",
        message: "Pack unavailable",
        code: "PACK_UNAVAILABLE",
      },
    };
  }
  if (isLite && manifest.bytes > LITE_PACK_MAX_BYTES) {
    return { ok: false, status: 400, body: packTooLargeForLiteBody() };
  }
  return { ok: true };
}
