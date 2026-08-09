import {
  diversifyByField,
  rankItemsLocally,
  scoreRankableItem,
} from "../score";
import type { UserAffinity } from "../userAffinity";

function emptyAffinity(overrides: Partial<UserAffinity> = {}): UserAffinity {
  return {
    likedContentIds: new Set(),
    skippedContentIds: new Set(),
    watchedContentIds: new Set(),
    preferredContentTypes: new Map(),
    preferredGenres: new Map(),
    preferredArtistIds: new Set(),
    preferredTopics: new Map(),
    ...overrides,
  };
}

describe("feed ranker score", () => {
  it("boosts preferred genre and artist", () => {
    const affinity = emptyAffinity({
      preferredGenres: new Map([["gospel", 2]]),
      preferredArtistIds: new Set(["artist1"]),
    });
    const impressed = new Set<string>();
    const a = scoreRankableItem(
      {
        id: "a",
        genre: "gospel",
        artistId: "artist1",
        likeCount: 5,
        createdAt: new Date(),
      },
      { impressed, affinity, exploreNoise: 0 }
    );
    const b = scoreRankableItem(
      {
        id: "b",
        genre: "secular",
        likeCount: 5,
        createdAt: new Date(),
      },
      { impressed, affinity, exploreNoise: 0 }
    );
    expect(a).toBeGreaterThan(b);
  });

  it("demotes impressed and skipped", () => {
    const affinity = emptyAffinity({
      skippedContentIds: new Set(["skip1"]),
    });
    const impressed = new Set(["imp1"]);
    const base = {
      likeCount: 50,
      viewCount: 100,
      createdAt: new Date(),
    };
    const skipped = scoreRankableItem(
      { id: "skip1", ...base },
      { impressed: new Set(), affinity, exploreNoise: 0 }
    );
    const seen = scoreRankableItem(
      { id: "imp1", ...base },
      { impressed, affinity: emptyAffinity(), exploreNoise: 0 }
    );
    const fresh = scoreRankableItem(
      { id: "fresh", ...base },
      { impressed: new Set(), affinity: emptyAffinity(), exploreNoise: 0 }
    );
    expect(fresh).toBeGreaterThan(seen);
    expect(fresh).toBeGreaterThan(skipped);
  });

  it("ranks and diversifies content types", () => {
    const affinity = emptyAffinity();
    const impressed = new Set<string>();
    const items = [
      { id: "1", contentType: "videos", likeCount: 100, createdAt: new Date() },
      { id: "2", contentType: "videos", likeCount: 90, createdAt: new Date() },
      { id: "3", contentType: "videos", likeCount: 80, createdAt: new Date() },
      { id: "4", contentType: "music", likeCount: 10, createdAt: new Date() },
    ];
    const ranked = rankItemsLocally(items, {
      impressed,
      affinity,
      exploreNoise: 0,
    });
    const diversified = diversifyByField(ranked, "contentType", 4);
    const firstThreeTypes = diversified.slice(0, 3).map(i => i.contentType);
    expect(firstThreeTypes.filter(t => t === "videos").length).toBeLessThan(3);
  });
});
