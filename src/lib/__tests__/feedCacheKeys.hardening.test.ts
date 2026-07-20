import { feedCacheHash, feedGlobalKey, FEED_CACHE_SCHEMA } from "../../lib/cacheKeys";
import { PUBLIC_MEDIA_FILTER } from "../../lib/publicMediaVisibility";

describe("feed cache key hardening", () => {
  it("uses collision-safe sha256 hashes of canonical query", () => {
    const a = feedCacheHash({ page: 1, limit: 20, contentType: "videos" });
    const b = feedCacheHash({ contentType: "videos", limit: 20, page: 1 });
    expect(a).toBe(b);
    // SHA-256 digest as base64url is 43 chars (no padding)
    expect(a).toHaveLength(43);
    expect(a).not.toContain("=");
    expect(a).not.toContain("+");
    expect(a).not.toContain("/");
  });

  it("scopes global keys by schema + generation", () => {
    const key = feedGlobalKey("abc", 7);
    expect(key).toContain(FEED_CACHE_SCHEMA);
    expect(key).toContain(":7:");
    expect(key).toContain("abc");
  });

  it("public media filter requires approved", () => {
    expect(PUBLIC_MEDIA_FILTER.moderationStatus).toBe("approved");
  });
});
