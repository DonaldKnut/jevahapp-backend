import { publicSermonFilter } from "../sermon.formatter";

describe("publicSermonFilter", () => {
  it("locks to contentType sermon and approved visibility", () => {
    const f = publicSermonFilter() as any;
    expect(f.contentType).toBe("sermon");
    expect(f.moderationStatus).toBe("approved");
    expect(f.isHidden).toEqual({ $ne: true });
  });

  it("merges extras without dropping contentType", () => {
    const f = publicSermonFilter({ series: "Faith" }) as any;
    expect(f.contentType).toBe("sermon");
    expect(f.series).toBe("Faith");
  });
});
