import { gunzipSync } from "zlib";

jest.mock("../../../service/fileUpload.service", () => ({
  __esModule: true,
  default: {
    getObjectBuffer: jest.fn(),
    uploadObjectExact: jest.fn(),
  },
  isAllowedCdnUrl: (url: string) =>
    /^https:\/\/(cdn\.example|cdn\.jevahapp\.com|[a-z0-9.-]+\.r2\.dev)\//i.test(
      url
    ),
}));

import {
  assertPackDownloadAllowed,
  BIBLE_PACK_SCHEMA,
  buildBiblePackJson,
  gzipPack,
  LITE_PACK_MAX_BYTES,
  parsePackManifest,
  type BiblePackManifest,
} from "../biblePack";

describe("bible pack builder", () => {
  const json = buildBiblePackJson({
    translationId: "WEB",
    packVersion: 1,
    books: [
      {
        name: "Genesis",
        abbreviation: "Gen",
        testament: "old",
        chapters: 50,
      },
      {
        name: "John",
        abbreviation: "Jhn",
        testament: "new",
        chapters: 21,
      },
    ],
    verses: [
      {
        bookName: "Genesis",
        chapterNumber: 1,
        verseNumber: 2,
        text: "Now the earth was formless and empty.",
      },
      {
        bookName: "Genesis",
        chapterNumber: 1,
        verseNumber: 1,
        text: "In the beginning God created the heavens and the earth.",
      },
      {
        bookName: "John",
        chapterNumber: 3,
        verseNumber: 16,
        text: "For God so loved the world...",
      },
    ],
  });

  it("emits jevah-bible-pack-v1 with lowercase translationId", () => {
    expect(json.schema).toBe(BIBLE_PACK_SCHEMA);
    expect(json.translationId).toBe("web");
    expect(json.packVersion).toBe(1);
    expect(json.books[0]).toMatchObject({
      id: "GEN",
      name: "Genesis",
      testament: "old",
      chapterCount: 1,
      verseCount: 2,
    });
    expect(json.books[1].testament).toBe("new");
    expect(json.chapters["Genesis:1"].map(r => r.v)).toEqual([1, 2]);
    expect(json.chapters["John:3"][0].t).toContain("loved");
  });

  it("gzips and hashes uncompressed JSON", () => {
    const { gzip, uncompressed, contentHash } = gzipPack(json);
    expect(contentHash).toMatch(/^sha256-[a-f0-9]{64}$/);
    expect(JSON.parse(gunzipSync(gzip).toString("utf8")).schema).toBe(
      BIBLE_PACK_SCHEMA
    );
    expect(uncompressed.length).toBeGreaterThan(gzip.length);
  });
});

describe("pack download gate", () => {
  const manifest: BiblePackManifest = {
    translationId: "web",
    packVersion: 1,
    contentHash: "sha256-abc",
    bytes: 100,
    encoding: "gzip-json",
    schema: BIBLE_PACK_SCHEMA,
    packUrl: "https://cdn.example/web.json.gz",
    license: "public-domain",
    updatedAt: "2026-08-16T00:00:00.000Z",
  };

  it("404s when the pack is missing", () => {
    const gate = assertPackDownloadAllowed("web", null, false);
    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.status).toBe(404);
      expect(gate.body.error).toBe("Pack unavailable");
    }
  });

  it("403s licensed translations even if a file exists", () => {
    const gate = assertPackDownloadAllowed("niv", manifest, false);
    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.status).toBe(403);
      expect(gate.body.error).toBe("Translation requires license");
    }
  });

  it("400s lite clients when gzip exceeds 12MB", () => {
    const gate = assertPackDownloadAllowed(
      "web",
      { ...manifest, bytes: LITE_PACK_MAX_BYTES + 1 },
      true
    );
    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.status).toBe(400);
      expect(gate.body.error).toBe("Pack too large for lite");
    }
  });

  it("allows a public-domain pack", () => {
    expect(assertPackDownloadAllowed("web", manifest, false)).toEqual({
      ok: true,
    });
  });

  it("404s an off-CDN packUrl (no open redirect)", () => {
    const gate = assertPackDownloadAllowed(
      "web",
      { ...manifest, packUrl: "https://evil.example/pack.gz" },
      false
    );
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.status).toBe(404);
  });
});

describe("parsePackManifest", () => {
  const valid = {
    schema: BIBLE_PACK_SCHEMA,
    encoding: "gzip-json",
    translationId: "web",
    packVersion: 1,
    bytes: 100,
    contentHash:
      "sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    packUrl: "https://cdn.example/bible/packs/web/v1.json.gz",
    license: "public-domain",
    updatedAt: "2026-08-16T00:00:00.000Z",
  };

  it("accepts a well-formed public-domain manifest", () => {
    expect(parsePackManifest(valid)?.translationId).toBe("web");
  });

  it("rejects a short hash, licensed id, or foreign host", () => {
    expect(parsePackManifest({ ...valid, contentHash: "sha256-abc" })).toBeNull();
    expect(parsePackManifest({ ...valid, translationId: "niv" })).toBeNull();
    expect(
      parsePackManifest({ ...valid, packUrl: "https://evil.example/x.gz" })
    ).toBeNull();
  });
});
