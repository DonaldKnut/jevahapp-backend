/**
 * Live integration matrix for delete / playlist / notifications (JEV-001/002/008/010).
 *
 *   RUN_INTEGRATION=1 \
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27017/jevah_qa_test \
 *   TEST_REDIS_URL=redis://127.0.0.1:6379 \
 *   npm run test:integration -- --testPathPattern=jevQa
 */
import { RUN_INTEGRATION } from "./setup";
import {
  assertRedisReady,
  connectTestMongo,
} from "./harness";
import type Redis from "ioredis";
import type { Express } from "express";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import mongoose from "mongoose";

const describeLive = RUN_INTEGRATION ? describe : describe.skip;

describe("JEV QA acceptance — gate", () => {
  it("documents how to run the live suite", () => {
    if (!RUN_INTEGRATION) {
      console.info(
        "[info] Set RUN_INTEGRATION=1 with TEST_MONGODB_URI + TEST_REDIS_URL for live JEV QA."
      );
    }
    expect(true).toBe(true);
  });
});

describeLive("JEV QA — delete / playlist / notifications", () => {
  let app: Express;
  let request: typeof import("supertest");
  let redis: Redis;
  let ownerToken: string;
  let otherToken: string;
  let ownerId: string;
  let otherId: string;
  let mediaId: string;
  let underReviewId: string;
  let playlistId: string;
  let songId: string;
  let ns: string;

  beforeAll(async () => {
    const mongo = process.env.TEST_MONGODB_URI || process.env.MONGODB_URI!;
    const redisUrl = process.env.TEST_REDIS_URL || process.env.REDIS_URL!;
    await connectTestMongo(mongo);
    redis = await assertRedisReady(redisUrl);

    const appMod = await import("../../src/app");
    app = appMod.app;
    request = (await import("supertest")).default;

    const { User } = await import("../../src/models/user.model");
    const { Media } = await import("../../src/models/media.model");
    const { Playlist } = await import("../../src/models/playlist.model");
    const { CopyrightFreeSong } = await import(
      "../../src/models/copyrightFreeSong.model"
    );
    const { Notification } = await import("../../src/models/notification.model");

    ns = `jevqa_${Date.now()}_${randomUUID().slice(0, 6)}`;
    const owner = await User.create({
      email: `${ns}_owner@test.local`,
      provider: "email",
      firstName: "Owner",
      role: "content_creator",
    });
    const other = await User.create({
      email: `${ns}_other@test.local`,
      provider: "email",
      firstName: "Other",
      role: "learner",
    });
    ownerId = owner._id.toString();
    otherId = other._id.toString();
    const secret = process.env.JWT_SECRET!;
    ownerToken = jwt.sign({ userId: ownerId }, secret, { expiresIn: "1h" });
    otherToken = jwt.sign({ userId: otherId }, secret, { expiresIn: "1h" });

    const media = await Media.create({
      title: `${ns} approved`,
      contentType: "videos",
      uploadedBy: owner._id,
      fileUrl: "https://example.com/a.mp4",
      thumbnailUrl: "https://example.com/a.jpg",
      moderationStatus: "approved",
    });
    mediaId = media._id.toString();

    const under = await Media.create({
      title: `${ns} under review`,
      contentType: "videos",
      uploadedBy: owner._id,
      fileUrl: "https://example.com/b.mp4",
      thumbnailUrl: "https://example.com/b.jpg",
      moderationStatus: "under_review",
    });
    underReviewId = under._id.toString();

    const song = await CopyrightFreeSong.create({
      title: `${ns} song`,
      singer: "Test",
      fileUrl: "https://example.com/song.mp3",
      uploadedBy: owner._id,
      processing: { status: "ready" },
    });
    songId = song._id.toString();

    const playlist = await Playlist.create({
      name: `${ns} playlist`,
      userId: owner._id,
      tracks: [],
      totalTracks: 0,
    });
    playlistId = playlist._id.toString();

    await Notification.create([
      {
        user: owner._id,
        title: "n1",
        message: "unread",
        type: "system",
        isRead: false,
      },
      {
        user: owner._id,
        title: "n2",
        message: "read",
        type: "system",
        isRead: true,
      },
    ]);
  }, 90000);

  afterAll(async () => {
    try {
      const { User } = await import("../../src/models/user.model");
      const { Media } = await import("../../src/models/media.model");
      const { Playlist } = await import("../../src/models/playlist.model");
      const { CopyrightFreeSong } = await import(
        "../../src/models/copyrightFreeSong.model"
      );
      const { Notification } = await import("../../src/models/notification.model");
      await Media.deleteMany({
        _id: {
          $in: [mediaId, underReviewId].filter(Boolean).map(
            id => new mongoose.Types.ObjectId(id)
          ),
        },
      });
      if (playlistId)
        await Playlist.deleteOne({ _id: playlistId });
      if (songId) await CopyrightFreeSong.deleteOne({ _id: songId });
      await User.deleteMany({
        _id: { $in: [ownerId, otherId].filter(Boolean) },
      });
      await Notification.deleteMany({
        user: { $in: [ownerId].filter(Boolean) },
      });
    } catch {
      // ignore cleanup errors
    }
    try {
      await redis?.quit();
    } catch {
      /* ignore */
    }
    try {
      await mongoose.disconnect();
    } catch {
      /* ignore */
    }
  });

  it("owner can delete under_review media; other user gets 403", async () => {
    const forbidden = await request(app)
      .delete(`/api/media/${underReviewId}`)
      .set("Authorization", `Bearer ${otherToken}`);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.code).toBe("FORBIDDEN");

    const ok = await request(app)
      .delete(`/api/media/${underReviewId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(ok.status).toBe(200);
    expect(ok.body.success).toBe(true);
  });

  it("unauthenticated delete returns 401", async () => {
    const res = await request(app).delete(`/api/media/${mediaId}`);
    expect(res.status).toBe(401);
  });

  it("add song then get playlist returns the track", async () => {
    const add = await request(app)
      .post(`/api/audio/playlists/${playlistId}/songs`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ songId });
    expect(add.status).toBe(200);
    expect(add.body.success).toBe(true);
    expect(add.body.data?.tracks?.length).toBeGreaterThanOrEqual(1);

    const again = await request(app)
      .post(`/api/audio/playlists/${playlistId}/songs`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ songId });
    expect(again.status).toBe(200);
    expect(again.body.alreadyExists).toBe(true);
    expect(again.body.data?.tracks?.length).toBeGreaterThanOrEqual(1);

    const get = await request(app)
      .get(`/api/playlists/${playlistId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(get.status).toBe(200);
    expect(get.body.data?.tracks?.length).toBeGreaterThanOrEqual(1);
  });

  it("unread-count matches list unreadCount and stats.unread", async () => {
    const list = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(list.status).toBe(200);
    const unreadFromList = list.body.data?.unreadCount;

    const badge = await request(app)
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(badge.status).toBe(200);
    expect(badge.body.data?.unreadCount).toBe(unreadFromList);

    const stats = await request(app)
      .get("/api/notifications/stats")
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(stats.status).toBe(200);
    expect(stats.body.data?.unread).toBe(unreadFromList);
  });
});
