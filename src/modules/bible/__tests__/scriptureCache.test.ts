import { scriptureCacheHeaders } from "../scriptureCache.middleware";

function makeRes() {
  const headers: Record<string, string> = {};
  const res: any = {
    statusCode: 200,
    headers,
    setHeader: (k: string, v: string) => {
      headers[k.toLowerCase()] = v;
    },
    getHeader: (k: string) => headers[k.toLowerCase()],
    status: (code: number) => {
      res.statusCode = code;
      return res;
    },
    end: jest.fn(),
    json: jest.fn(),
  };
  return res;
}

describe("scriptureCacheHeaders", () => {
  it("freezes versioned URLs for a year", () => {
    const req: any = { method: "GET", headers: {}, query: { v: "a1b2c3" } };
    const res = makeRes();
    const original = res.json;

    scriptureCacheHeaders()(req, res, () => {});
    res.json({ success: true, data: { verseNumber: 1, text: "In the beginning" } });

    expect(res.getHeader("cache-control")).toBe(
      "public, max-age=31536000, immutable"
    );
    expect(res.getHeader("etag")).toMatch(/^".+"$/);
    expect(original).toHaveBeenCalledTimes(1);
  });

  it("never promises immutability without a version in the URL", () => {
    const res = makeRes();
    scriptureCacheHeaders()(
      { method: "GET", headers: {}, query: {} } as any,
      res,
      () => {}
    );
    res.json({ success: true, data: [] });

    const cacheControl = res.getHeader("cache-control");
    expect(cacheControl).not.toContain("immutable");
    expect(cacheControl).toBe(
      "public, max-age=86400, stale-while-revalidate=604800"
    );
    expect(res.getHeader("etag")).toMatch(/^".+"$/);
  });

  it("treats a blank version as unversioned", () => {
    const res = makeRes();
    scriptureCacheHeaders()(
      { method: "GET", headers: {}, query: { v: "  " } } as any,
      res,
      () => {}
    );
    res.json({ success: true, data: [] });

    expect(res.getHeader("cache-control")).not.toContain("immutable");
  });

  it("returns 304 when If-None-Match matches the body", () => {
    const body = { success: true, data: [1, 2, 3] };

    const first = makeRes();
    scriptureCacheHeaders()(
      { method: "GET", headers: {}, query: {} } as any,
      first,
      () => {}
    );
    first.json(body);
    const etag = first.getHeader("etag");

    const second = makeRes();
    const originalSecond = second.json;
    scriptureCacheHeaders()(
      {
        method: "GET",
        headers: { "if-none-match": `W/${etag}` },
        query: {},
      } as any,
      second,
      () => {}
    );
    second.json(body);

    expect(second.statusCode).toBe(304);
    expect(second.end).toHaveBeenCalled();
    expect(originalSecond).not.toHaveBeenCalled();
  });
});
