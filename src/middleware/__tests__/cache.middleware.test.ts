jest.mock("../../service/cache.service", () => ({
  __esModule: true,
  default: {
    isReady: jest.fn(() => true),
    get: jest.fn(async () => null),
    set: jest.fn(async () => undefined),
  },
}));

import { cacheMiddleware } from "../cache.middleware";
import cacheService from "../../service/cache.service";

const cache = cacheService as unknown as {
  isReady: jest.Mock;
  get: jest.Mock;
  set: jest.Mock;
};

function makeReq(overrides: Record<string, any> = {}) {
  return {
    method: "GET",
    originalUrl: "/api/bible/packs?translation=web",
    query: { translation: "web" },
    headers: {},
    ...overrides,
  } as any;
}

function makeRes() {
  const headers: Record<string, string> = {};
  const res: any = {
    statusCode: 200,
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

/** The middleware is async; awaiting it covers both the hit and miss paths. */
async function run(mw: any, req: any, res: any) {
  await mw(req, res, () => {});
}

describe("cacheMiddleware", () => {
  beforeEach(() => {
    cache.isReady.mockReturnValue(true);
    cache.get.mockResolvedValue(null);
    cache.set.mockReset();
    cache.set.mockResolvedValue(undefined);
  });

  it("does not cache non-2xx bodies", async () => {
    const res = makeRes();
    await run(cacheMiddleware(60), makeReq(), res);

    res.status(404).json({ success: false, error: "Pack unavailable" });

    expect(cache.set).not.toHaveBeenCalled();
    expect(res.getHeader("cache-control")).toBe("no-store");
    expect(res.getHeader("x-cache")).toBe("BYPASS");
  });

  it("caches successful bodies", async () => {
    const res = makeRes();
    await run(cacheMiddleware(60), makeReq(), res);

    res.json({ success: true, data: { translation: "web" } });

    expect(cache.set).toHaveBeenCalledTimes(1);
    expect(res.getHeader("x-cache")).toBe("MISS");
  });

  it("keys and varies by the requested headers", async () => {
    const lite = makeRes();
    await run(
      cacheMiddleware(60, undefined, { varyByHeaders: ["X-Jevah-Client"] }),
      makeReq({ headers: { "x-jevah-client": "lite" } }),
      lite
    );
    lite.json({ success: true, data: "lite" });
    const liteKey = cache.set.mock.calls[0][0];

    cache.set.mockReset();
    cache.set.mockResolvedValue(undefined);

    const full = makeRes();
    await run(
      cacheMiddleware(60, undefined, { varyByHeaders: ["X-Jevah-Client"] }),
      makeReq(),
      full
    );
    full.json({ success: true, data: "full" });
    const fullKey = cache.set.mock.calls[0][0];

    expect(liteKey).not.toBe(fullKey);
    expect(lite.getHeader("vary")).toBe("Accept-Encoding, X-Jevah-Client");
  });

  it("replays hits as 200", async () => {
    cache.get.mockResolvedValue({ success: true, data: "cached" });
    const res = makeRes();
    res.statusCode = 500;

    await run(cacheMiddleware(60), makeReq(), res);

    expect(res.statusCode).toBe(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: "cached" });
  });
});
