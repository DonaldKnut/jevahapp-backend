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
exports.incrPostCounter = incrPostCounter;
exports.getPostCounter = getPostCounter;
const redis_1 = require("./redis");
/**
 * Fast-changing counters for posts/media.
 * Keys (as requested):
 * - post:{postId}:likes
 * - post:{postId}:views
 * - post:{postId}:comments
 *
 * Redis is an optimization layer only: DB remains source of truth.
 */
function incrPostCounter(params) {
    return __awaiter(this, void 0, void 0, function* () {
        const { postId, field, delta } = params;
        const key = `post:${postId}:${field}`;
        return yield (0, redis_1.redisSafe)("counterIncr", (r) => __awaiter(this, void 0, void 0, function* () {
            const next = yield r.incrby(key, delta);
            return typeof next === "number" ? next : Number(next);
        }), null);
    });
}
function getPostCounter(params) {
    return __awaiter(this, void 0, void 0, function* () {
        const { postId, field } = params;
        const key = `post:${postId}:${field}`;
        return yield (0, redis_1.redisSafe)("counterGet", (r) => __awaiter(this, void 0, void 0, function* () {
            const val = yield r.get(key);
            if (val === null || val === undefined)
                return null;
            return typeof val === "number" ? val : Number(val);
        }), null);
    });
}
