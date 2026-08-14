import { createHash } from "crypto";
import { canonicalizeCacheParts, feedCacheHash, feedGlobalKey } from "../cacheKeys";

describe("cacheKeys", () => {
  it("feedCacheHash is collision-safe SHA-256 and order-independent", () => {
    const a = feedCacheHash({ page: 1, limit: 20, sort: "createdAt" });
    const b = feedCacheHash({ sort: "createdAt", limit: 20, page: 1 });
    const c = feedCacheHash({ page: 2, limit: 20, sort: "createdAt" });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toHaveLength(43); // base64url sha256
    expect(a).toBe(
      createHash("sha256").update(canonicalizeCacheParts({ page: 1, limit: 20, sort: "createdAt" })).digest("base64url")
    );
  });

  it("feedGlobalKey is generation-scoped", () => {
    expect(feedGlobalKey("abc", 3)).toBe("feed:global:v3:3:abc");
  });
});
