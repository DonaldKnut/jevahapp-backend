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
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisRateLimit = redisRateLimit;
const redis_1 = require("./redis");
/**
 * Simple Redis-backed rate limiter (per key, fixed window).
 * Uses atomic INCR and sets EXPIRE on first hit.
 *
 * Redis is optional: if Redis is down, returns allowed=true (do not break UX).
 */
function redisRateLimit(params) {
    return __awaiter(this, void 0, void 0, function* () {
        const { key, limit, windowSeconds } = params;
        return yield (0, redis_1.redisSafe)("rateLimit", (r) => __awaiter(this, void 0, void 0, function* () {
            const current = yield r.incr(key);
            if (current === 1) {
                // First hit in this window → set TTL
                yield r.expire(key, windowSeconds);
            }
            const remaining = Math.max(0, limit - current);
            return { allowed: current <= limit, remaining };
        }), { allowed: true, remaining: limit });
    });
}
