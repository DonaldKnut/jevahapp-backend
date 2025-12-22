"use strict";
// src/service/cache.service.ts
// Redis caching service for improved performance
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheService = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = __importDefault(require("../utils/logger"));
class CacheService {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.counters = {
            hits: 0,
            misses: 0,
            sets: 0,
            dels: 0,
            invalidations: 0,
            errors: 0,
        };
        this.initialize();
    }
    initialize() {
        try {
            const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
            this.client = new ioredis_1.default(redisUrl, {
                maxRetriesPerRequest: 3,
                enableReadyCheck: true,
                lazyConnect: true,
                retryStrategy: (times) => {
                    const delay = Math.min(times * 50, 2000);
                    return delay;
                },
            });
            this.client.on("connect", () => {
                this.isConnected = true;
                logger_1.default.info("✅ Redis connected successfully");
            });
            this.client.on("ready", () => {
                this.isConnected = true;
                logger_1.default.info("✅ Redis ready to accept commands");
            });
            this.client.on("error", (err) => {
                this.isConnected = false;
                logger_1.default.error("❌ Redis error:", err);
            });
            this.client.on("close", () => {
                this.isConnected = false;
                logger_1.default.warn("⚠️  Redis connection closed");
            });
            // Connect lazily
            this.client.connect().catch((err) => {
                logger_1.default.warn("⚠️  Redis connection failed (will retry):", err.message);
                this.isConnected = false;
            });
        }
        catch (error) {
            logger_1.default.error("❌ Failed to initialize Redis:", error);
            this.isConnected = false;
        }
    }
    /**
     * Get value from cache
     */
    get(key) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isConnected || !this.client) {
                return null;
            }
            try {
                const data = yield this.client.get(key);
                if (!data) {
                    this.counters.misses++;
                    return null;
                }
                this.counters.hits++;
                return JSON.parse(data);
            }
            catch (error) {
                this.counters.errors++;
                logger_1.default.error("Cache get error:", { key, error: error.message });
                return null;
            }
        });
    }
    /**
     * Set value in cache with TTL
     */
    set(key_1, value_1) {
        return __awaiter(this, arguments, void 0, function* (key, value, ttl = 3600) {
            if (!this.isConnected || !this.client) {
                return;
            }
            try {
                yield this.client.setex(key, ttl, JSON.stringify(value));
                this.counters.sets++;
            }
            catch (error) {
                this.counters.errors++;
                logger_1.default.error("Cache set error:", { key, error: error.message });
            }
        });
    }
    /**
     * Delete a key from cache
     */
    del(key) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isConnected || !this.client) {
                return;
            }
            try {
                yield this.client.del(key);
                this.counters.dels++;
            }
            catch (error) {
                this.counters.errors++;
                logger_1.default.error("Cache delete error:", { key, error: error.message });
            }
        });
    }
    /**
     * Delete multiple keys matching a pattern
     */
    delPattern(pattern) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, e_1, _b, _c;
            if (!this.isConnected || !this.client) {
                return;
            }
            try {
                // IMPORTANT: Avoid Redis KEYS in production.
                // KEYS is O(N) and can block Redis (causing timeouts / stalls).
                // SCAN is incremental and safe for prod usage.
                const stream = this.client.scanStream({
                    match: pattern,
                    count: 250,
                });
                let deleted = 0;
                try {
                    for (var _d = true, _e = __asyncValues(stream), _f; _f = yield _e.next(), _a = _f.done, !_a; _d = true) {
                        _c = _f.value;
                        _d = false;
                        const keys = _c;
                        if (!Array.isArray(keys) || keys.length === 0)
                            continue;
                        deleted += keys.length;
                        // Pipeline deletes to reduce RTT
                        const pipeline = this.client.pipeline();
                        for (const key of keys)
                            pipeline.del(key);
                        yield pipeline.exec();
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (!_d && !_a && (_b = _e.return)) yield _b.call(_e);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
                if (deleted > 0) {
                    this.counters.invalidations++;
                    logger_1.default.info(`Cache cleared: ${deleted} keys matching pattern "${pattern}"`);
                }
            }
            catch (error) {
                this.counters.errors++;
                logger_1.default.error("Cache delete pattern error:", { pattern, error: error.message });
            }
        });
    }
    /**
     * Get or set pattern - fetch from cache or execute function and cache result
     */
    getOrSet(key_1, fetchFn_1) {
        return __awaiter(this, arguments, void 0, function* (key, fetchFn, ttl = 3600) {
            // Try to get from cache first
            const cached = yield this.get(key);
            if (cached !== null) {
                logger_1.default.debug(`Cache HIT: ${key}`);
                return cached;
            }
            // Cache miss - fetch data
            logger_1.default.debug(`Cache MISS: ${key}`);
            const data = yield fetchFn();
            // Store in cache
            yield this.set(key, data, ttl);
            return data;
        });
    }
    /**
     * Check if Redis is connected
     */
    isReady() {
        return this.isConnected && this.client !== null;
    }
    /**
     * Get cache statistics
     */
    getStats() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isConnected || !this.client) {
                return { connected: false, counters: this.counters };
            }
            try {
                const keys = yield this.client.dbsize();
                return {
                    connected: true,
                    keys,
                    counters: this.counters,
                };
            }
            catch (error) {
                return {
                    connected: true,
                    counters: this.counters,
                };
            }
        });
    }
    /**
     * Clear all cache (use with caution)
     */
    flushAll() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isConnected || !this.client) {
                return;
            }
            try {
                yield this.client.flushall();
                logger_1.default.warn("⚠️  All cache cleared");
            }
            catch (error) {
                logger_1.default.error("Cache flush error:", error);
            }
        });
    }
}
// Export singleton instance
exports.cacheService = new CacheService();
exports.default = exports.cacheService;
