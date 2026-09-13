import { publicSermonFilter } from "../sermon.formatter";

describe("publicSermonFilter", () => {
  it("locks to contentType sermon and catalog visibility", () => {
    const f = publicSermonFilter() as any;
    const serialized = JSON.stringify(f);
    expect(serialized).toContain('"sermon"');
    expect(serialized).toContain('"approved"');
    expect(serialized).toContain("isDefaultContent");
  });

  it("merges extras without dropping contentType", () => {
    const f = publicSermonFilter({ series: "Faith" }) as any;
    expect(JSON.stringify(f)).toContain('"sermon"');
    expect(JSON.stringify(f)).toContain('"Faith"');
  });
});
