"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBullConnection = createBullConnection;
const ioredis_1 = __importDefault(require("ioredis"));
/**
 * Shared Redis connection for BullMQ.
 * BullMQ requires a real ioredis connection (not node-redis v4 client).
 */
function createBullConnection() {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    return new ioredis_1.default(redisUrl, {
        maxRetriesPerRequest: null, // BullMQ recommendation
        enableReadyCheck: false, // BullMQ recommendation
    });
}
