import cacheService from "../cache.service";
import { CACHE_TTL, feedUserPattern, FEED_GLOBAL_PATTERN, authUserKey } from "../../lib/cacheKeys";

const store = new Map<string, string>();

jest.mock("../../lib/redisClient", () => {
  const client = {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    dbsize: jest.fn(),
    flushall: jest.fn(),
    pipeline: jest.fn(),
    scanStream: jest.fn(),
  };
  return {
    redisClient: client,
    isRedisConnected: jest.fn(() => true),
  };
});

const { redisClient, isRedisConnected } = require("../../lib/redisClient");

function wireMocks() {
  (isRedisConnected as jest.Mock).mockReturnValue(true);
  (redisClient.get as jest.Mock).mockImplementation(async (key: string) => store.get(key) ?? null);
  (redisClient.setex as jest.Mock).mockImplementation(
    async (key: string, _ttl: number, value: string) => {
      store.set(key, value);
      return "OK";
    }
  );
  (redisClient.del as jest.Mock).mockImplementation(async (...keys: string[]) => {
    let n = 0;
    for (const k of keys) {
      if (store.delete(k)) n++;
    }
    return n;
  });
  (redisClient.exists as jest.Mock).mockImplementation(async (key: string) =>
    store.has(key) ? 1 : 0
  );
  (redisClient.dbsize as jest.Mock).mockImplementation(async () => store.size);
  (redisClient.flushall as jest.Mock).mockImplementation(async () => {
    store.clear();
    return "OK";
  });
  (redisClient.pipeline as jest.Mock).mockImplementation(() => {
    const ops: string[] = [];
    return {
      del: (key: string) => {
        ops.push(key);
      },
      exec: async () => {
        for (const k of ops) store.delete(k);
        return [];
      },
    };
  });
  (redisClient.scanStream as jest.Mock).mockImplementation(({ match }: { match: string }) => {
    const prefix = match.replace(/\*$/, "");
    const keys = [...store.keys()].filter((k) =>
      match.endsWith("*") ? k.startsWith(prefix) : k === match
    );
    return {
      async *[Symbol.asyncIterator]() {
        if (keys.length) yield keys;
      },
    };
  });
}

describe("CacheService", () => {
  beforeEach(() => {
    store.clear();
    wireMocks();
  });

  it("getJSON/setJSON round-trip", async () => {
    await cacheService.setJSON("k1", { a: 1 }, CACHE_TTL.feed);
    await expect(cacheService.getJSON<{ a: number }>("k1")).resolves.toEqual({ a: 1 });
    await expect(cacheService.exists("k1")).resolves.toBe(true);
  });

  it("delPattern removes matching keys via SCAN", async () => {
    await cacheService.setJSON("feed:user:u1:aaa", { media: [] }, 60);
    await cacheService.setJSON("feed:user:u1:bbb", { media: [] }, 60);
    await cacheService.setJSON("feed:user:u2:ccc", { media: [] }, 60);
    await cacheService.delPattern(feedUserPattern("u1"));
    await expect(cacheService.getJSON("feed:user:u1:aaa")).resolves.toBeNull();
    await expect(cacheService.getJSON("feed:user:u1:bbb")).resolves.toBeNull();
    await expect(cacheService.getJSON("feed:user:u2:ccc")).resolves.toEqual({ media: [] });
  });

  it("delPattern clears global feed keys", async () => {
    await cacheService.setJSON("feed:global:xyz", { media: [1] }, 60);
    await cacheService.delPattern(FEED_GLOBAL_PATTERN);
    await expect(cacheService.getJSON("feed:global:xyz")).resolves.toBeNull();
  });

  it("flushAll is blocked outside test/dev without ALLOW_REDIS_FLUSH", async () => {
    const prev = process.env.NODE_ENV;
    const prevAllow = process.env.ALLOW_REDIS_FLUSH;
    process.env.NODE_ENV = "production";
    delete process.env.ALLOW_REDIS_FLUSH;
    await expect(cacheService.flushAll()).rejects.toThrow(/disabled/);
    process.env.NODE_ENV = prev;
    if (prevAllow !== undefined) process.env.ALLOW_REDIS_FLUSH = prevAllow;
  });

  it("authUserKey helper", () => {
    expect(authUserKey("abc")).toBe("auth:user:abc");
  });
});
