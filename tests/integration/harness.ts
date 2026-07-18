import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import Redis from "ioredis";

export type SeededFixture = {
  ownerId: string;
  userAId: string;
  userBId: string;
  mediaId: string;
  tokenA: string;
  tokenB: string;
  ns: string;
};

export async function connectTestMongo(uri: string): Promise<void> {
  mongoose.set("bufferCommands", false);
  await mongoose.connect(uri);
}

export async function assertRedisReady(url: string): Promise<Redis> {
  const r = new Redis(url, {
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
    lazyConnect: true,
  });
  await r.connect();
  const pong = await r.ping();
  if (pong !== "PONG") {
    throw new Error(`Redis ping failed: ${pong}`);
  }
  return r;
}

export async function seedLikeFixture(): Promise<SeededFixture> {
  const { User } = await import("../../src/models/user.model");
  const { Media } = await import("../../src/models/media.model");
  const { Like } = await import("../../src/models/like.model");

  await Like.syncIndexes();

  const ns = `it_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const owner = await User.create({
    email: `${ns}_owner@test.local`,
    provider: "email",
    firstName: "Owner",
    role: "content_creator",
  });
  const userA = await User.create({
    email: `${ns}_a@test.local`,
    provider: "email",
    firstName: "UserA",
    role: "learner",
  });
  const userB = await User.create({
    email: `${ns}_b@test.local`,
    provider: "email",
    firstName: "UserB",
    role: "learner",
  });

  const media = await Media.create({
    title: `${ns} media`,
    contentType: "videos",
    uploadedBy: owner._id,
    likeCount: 0,
    fileUrl: "https://example.com/video.mp4",
  });

  const secret = process.env.JWT_SECRET!;
  const tokenA = jwt.sign({ userId: userA._id.toString() }, secret, {
    expiresIn: "1h",
  });
  const tokenB = jwt.sign({ userId: userB._id.toString() }, secret, {
    expiresIn: "1h",
  });

  return {
    ownerId: owner._id.toString(),
    userAId: userA._id.toString(),
    userBId: userB._id.toString(),
    mediaId: media._id.toString(),
    tokenA,
    tokenB,
    ns,
  };
}

export async function cleanupLikeFixture(
  fixture: SeededFixture,
  redis: Redis
): Promise<void> {
  const { User } = await import("../../src/models/user.model");
  const { Media } = await import("../../src/models/media.model");
  const { Like } = await import("../../src/models/like.model");
  const { Notification } = await import("../../src/models/notification.model");

  const ids = [fixture.ownerId, fixture.userAId, fixture.userBId];
  await Like.deleteMany({
    contentId: new mongoose.Types.ObjectId(fixture.mediaId),
  });
  await Media.deleteOne({ _id: fixture.mediaId });
  await User.deleteMany({ _id: { $in: ids } });
  await Notification.deleteMany({
    relatedId: new mongoose.Types.ObjectId(fixture.mediaId),
  });

  const patterns = [
    `idem:${fixture.userAId}:*`,
    `idem:${fixture.userBId}:*`,
    `like:${fixture.userAId}*`,
    `like:${fixture.userBId}*`,
    `content:media:${fixture.mediaId}:likeCount`,
    `post:${fixture.mediaId}:likes`,
    `user:${fixture.userAId}:like:*`,
    `user:${fixture.userBId}:like:*`,
  ];
  for (const pattern of patterns) {
    if (pattern.includes("*")) {
      const keys = await redis.keys(pattern);
      if (keys.length) await redis.del(...keys);
    } else {
      await redis.del(pattern);
    }
  }
}

export function newIdempotencyKey(): string {
  return randomUUID();
}
