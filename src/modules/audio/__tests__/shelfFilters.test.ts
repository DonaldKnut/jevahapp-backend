import {
  publicCuratedReadyFilter,
  publicArtistReadyFilter,
} from "../track.formatter";

describe("music shelf integrity filters", () => {
  it("curated filter never matches lane=artist", () => {
    const f = publicCuratedReadyFilter() as any;
    expect(JSON.stringify(f)).toContain('"lane":{"$ne":"artist"}');
    const orLane = f.$and.find((c: any) => c.$or && c.$or[0]?.lane === "curated");
    expect(orLane).toBeTruthy();
  });

  it("artist filter requires lane=artist exactly", () => {
    const f = publicArtistReadyFilter() as any;
    expect(f.lane).toBe("artist");
    expect(f.visibility).toBe("published");
    const eq = f.$and.find((c: any) => c.lane?.$eq === "artist");
    expect(eq).toBeTruthy();
  });

  it("artist filter requires approved (or legacy missing) moderation", () => {
    const f = publicArtistReadyFilter() as any;
    const mod = f.$and.find(
      (c: any) =>
        Array.isArray(c.$or) &&
        c.$or.some((x: any) => x.moderationStatus === "approved")
    );
    expect(mod).toBeTruthy();
  });

  it("extra merge does not drop hard lane constraints", () => {
    const f = publicArtistReadyFilter({ genre: "gospel" }) as any;
    expect(f.lane).toBe("artist");
    expect(f.genre).toBe("gospel");
  });
});
