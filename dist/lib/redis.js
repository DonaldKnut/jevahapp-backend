"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
exports.isRedisEnabled = isRedisEnabled;
exports.redisSafe = redisSafe;
const redis_1 = require("@upstash/redis");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Centralized Upstash Redis (REST) client.
 *
 * IMPORTANT:
 * - Redis is an optimization layer only.
 * - If env vars are missing or Redis is down, the app must keep working.
 */
const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
exports.redis = url && token
    ? new redis_1.Redis({
        url,
        token,
    })
    : null;
function isRedisEnabled() {
    return exports.redis !== null;
}
/**
 * Execute Redis code safely (never throws).
 * Use this for all Redis reads/writes in request handlers.
 */
function redisSafe(opName, fn, fallback) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!exports.redis)
            return fallback;
        try {
            return yield fn(exports.redis);
        }
        catch (err) {
            logger_1.default.warn("Redis operation failed (fallback to DB)", {
                op: opName,
                error: err === null || err === void 0 ? void 0 : err.message,
            });
            return fallback;
        }
    });
}
