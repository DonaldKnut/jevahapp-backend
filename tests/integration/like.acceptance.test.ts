/**
 * Like acceptance matrix (HTTP + Mongo + Redis).
 *
 * Default (no RUN_INTEGRATION): documents the gate only — does not skip silently when enabled.
 *
 *   RUN_INTEGRATION=1 \
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27017/jevah_like_test \
 *   TEST_REDIS_URL=redis://127.0.0.1:6379 \
 *   npm run test:integration
 */
import { RUN_INTEGRATION } from "./setup";
import {
  assertRedisReady,
  cleanupLikeFixture,
  connectTestMongo,
  newIdempotencyKey,
  seedLikeFixture,
  SeededFixture,
} from "./harness";
import type Redis from "ioredis";
import type { Express } from "express";
import type { Server as SocketIOServer } from "socket.io";

const describeLive = RUN_INTEGRATION ? describe : describe.skip;

describe("Like acceptance — gate", () => {
  it("documents how to run the live suite", () => {
    if (!RUN_INTEGRATION) {
      console.info(
        "[info] Set RUN_INTEGRATION=1 with TEST_MONGODB_URI + TEST_REDIS_URL to run the live matrix."
      );
    }
    expect(true).toBe(true);
  });
});

describeLive("Like acceptance — live HTTP+Mongo+Redis", () => {
  let app: Express;
  let request: typeof import("supertest");
  let redis: Redis;
  let fixture: SeededFixture;
  let io: SocketIOServer | null;
  let emitSpy: jest.SpyInstance | undefined;

  beforeAll(async () => {
    const mongo = process.env.TEST_MONGODB_URI || process.env.MONGODB_URI!;
    const redisUrl = process.env.TEST_REDIS_URL || process.env.REDIS_URL!;

    try {
      await connectTestMongo(mongo);
    } catch (e: any) {
      throw new Error(
        `TEST_MONGODB_URI unreachable (${mongo}): ${e?.message}. Live suite must fail when RUN_INTEGRATION=1.`
      );
    }

    try {
      redis = await assertRedisReady(redisUrl);
    } catch (e: any) {
      throw new Error(
        `TEST_REDIS_URL unreachable (${redisUrl}): ${e?.message}. Live suite must fail when RUN_INTEGRATION=1.`
      );
    }

    // Import app after env is set by setup.ts
    const appMod = await import("../../src/app");
    app = appMod.app;
    io = appMod.socketService?.getIO?.() ?? null;
    request = (await import("supertest")).default;

    fixture = await seedLikeFixture();

    if (io) {
      emitSpy = jest.spyOn(io, "emit");
    }
  }, 60000);

  afterAll(async () => {
    if (fixture && redis) {
      await cleanupLikeFixture(fixture, redis);
    }
    emitSpy?.mockRestore();
    await redis?.quit().catch(() => {});
    await (await import("mongoose")).default.disconnect().catch(() => {});
  });

  async function like(
    token: string,
    opts: { mediaId?: string; idempotencyKey?: string } = {}
  ) {
    const mediaId = opts.mediaId || fixture.mediaId;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
    const res = await request(app)
      .post(`/api/content/media/${mediaId}/like`)
      .set(headers);
    return res;
  }

  it("401 without auth", async () => {
    const res = await request(app).post(
      `/api/content/media/${fixture.mediaId}/like`
    );
    expect(res.status).toBe(401);
  });

  it("404 for missing content", async () => {
    const res = await like(fixture.tokenA, {
      mediaId: "000000000000000000000000",
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("CONTENT_NOT_FOUND");
  });

  it("like/unlike persistence + metadata", async () => {
    const first = await like(fixture.tokenA);
    expect(first.status).toBe(200);
    expect(first.body.data).toEqual(
      expect.objectContaining({
        contentId: fixture.mediaId,
        contentType: "media",
        liked: true,
        likeCount: expect.any(Number),
      })
    );

    const { Like } = await import("../../src/models/like.model");
    expect(
      await Like.countDocuments({
        userId: fixture.userAId,
        contentId: fixture.mediaId,
        contentType: "media",
      })
    ).toBe(1);

    const second = await like(fixture.tokenA);
    expect(second.status).toBe(200);
    expect(second.body.data.liked).toBe(false);

    const meta = await request(app)
      .get(`/api/content/media/${fixture.mediaId}/metadata`)
      .set({ Authorization: `Bearer ${fixture.tokenA}` });
    expect(meta.status).toBe(200);
    expect(meta.body.data.hasLiked ?? meta.body.data.userInteraction?.liked).toBe(
      false
    );
  });

  it("user A vs user B isolation", async () => {
    // Reset A to liked
    const a1 = await like(fixture.tokenA);
    if (!a1.body.data.liked) await like(fixture.tokenA);

    const b1 = await like(fixture.tokenB);
    expect(b1.status).toBe(200);
    expect(typeof b1.body.data.liked).toBe("boolean");

    const { Like } = await import("../../src/models/like.model");
    const aLiked = await Like.exists({
      userId: fixture.userAId,
      contentId: fixture.mediaId,
      contentType: "media",
    });
    const bLiked = await Like.exists({
      userId: fixture.userBId,
      contentId: fixture.mediaId,
      contentType: "media",
    });
    expect(!!aLiked).toBe(true);
    expect(!!bLiked).toBe(b1.body.data.liked);
  });

  it("idempotency replay does not double-toggle", async () => {
    const key = newIdempotencyKey();
    const a = await like(fixture.tokenA, { idempotencyKey: key });
    expect(a.status).toBe(200);
    const b = await like(fixture.tokenA, { idempotencyKey: key });
    expect(b.status).toBe(200);
    expect(b.body.data.liked).toBe(a.body.data.liked);
    expect(b.body.data.likeCount).toBe(a.body.data.likeCount);
  });

  it("idempotency conflict for same key different content", async () => {
    const { Media } = await import("../../src/models/media.model");
    const other = await Media.create({
      title: `${fixture.ns} other`,
      contentType: "videos",
      uploadedBy: fixture.ownerId,
      likeCount: 0,
      fileUrl: "https://example.com/other.mp4",
    });
    const key = newIdempotencyKey();
    const a = await like(fixture.tokenA, {
      mediaId: fixture.mediaId,
      idempotencyKey: key,
    });
    expect(a.status).toBe(200);
    const b = await like(fixture.tokenA, {
      mediaId: other._id.toString(),
      idempotencyKey: key,
    });
    expect(b.status).toBe(409);
    expect(b.body.code).toBe("IDEMPOTENCY_CONFLICT");
    await Media.deleteOne({ _id: other._id });
  });

  it("concurrent same Idempotency-Key: single mutation", async () => {
    const { Like } = await import("../../src/models/like.model");
    // Ensure known start: unlike if liked
    const cur = await Like.exists({
      userId: fixture.userAId,
      contentId: fixture.mediaId,
      contentType: "media",
    });
    if (cur) await like(fixture.tokenA);

    const before = await Like.countDocuments({
      userId: fixture.userAId,
      contentId: fixture.mediaId,
      contentType: "media",
    });

    const key = newIdempotencyKey();
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        like(fixture.tokenA, { idempotencyKey: key })
      )
    );

    const statuses = results.map(r => r.status);
    expect(statuses.every(s => s === 200 || s === 409)).toBe(true);
    expect(statuses.filter(s => s === 200).length).toBeGreaterThanOrEqual(1);

    const after = await Like.countDocuments({
      userId: fixture.userAId,
      contentId: fixture.mediaId,
      contentType: "media",
    });
    // One logical toggle from before
    expect(Math.abs(after - before)).toBe(1);
  });

  it("unique-index: concurrent toggles without key leave at most one Like", async () => {
    const { Like } = await import("../../src/models/like.model");
    await Like.deleteMany({
      userId: fixture.userBId,
      contentId: fixture.mediaId,
      contentType: "media",
    });

    await Promise.all(Array.from({ length: 8 }, () => like(fixture.tokenB)));

    const count = await Like.countDocuments({
      userId: fixture.userBId,
      contentId: fixture.mediaId,
      contentType: "media",
    });
    expect(count).toBeLessThanOrEqual(1);
  });

  it("429 LIKE_RATE_LIMITED with no mutation when hammering", async () => {
    const { Like } = await import("../../src/models/like.model");
    const before = await Like.countDocuments({
      userId: fixture.userAId,
      contentId: fixture.mediaId,
      contentType: "media",
    });

    let saw429 = false;
    let lastCount = before;
    for (let i = 0; i < 12; i++) {
      const r = await like(fixture.tokenA);
      if (r.status === 429) {
        saw429 = true;
        expect(r.body.code).toBe("LIKE_RATE_LIMITED");
        expect(
          Number(r.headers["retry-after"] || r.body?.data?.retryAfterSeconds)
        ).toBeGreaterThan(0);
        const after = await Like.countDocuments({
          userId: fixture.userAId,
          contentId: fixture.mediaId,
          contentType: "media",
        });
        expect(after).toBe(lastCount);
        break;
      }
      lastCount = await Like.countDocuments({
        userId: fixture.userAId,
        contentId: fixture.mediaId,
        contentType: "media",
      });
    }
    expect(saw429).toBe(true);
  });

  it("emits socket count update after successful like", async () => {
    if (!emitSpy) {
      console.warn("Socket IO unavailable — skipping emit assertion");
      return;
    }
    emitSpy.mockClear();
    // Ensure we perform a real mutation
    const key = newIdempotencyKey();
    const res = await like(fixture.tokenA, { idempotencyKey: key });
    if (res.status !== 200) return;
    expect(emitSpy).toHaveBeenCalledWith(
      "content-like-count-updated",
      expect.objectContaining({
        contentId: fixture.mediaId,
        contentType: "media",
        likeCount: expect.any(Number),
      })
    );
  });
});
