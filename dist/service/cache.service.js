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
                    return null;
                }
                return JSON.parse(data);
            }
            catch (error) {
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
            }
            catch (error) {
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
            }
            catch (error) {
                logger_1.default.error("Cache delete error:", { key, error: error.message });
            }
        });
    }
    /**
     * Delete multiple keys matching a pattern
     */
    delPattern(pattern) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isConnected || !this.client) {
                return;
            }
            try {
                const keys = yield this.client.keys(pattern);
                if (keys.length > 0) {
                    yield this.client.del(...keys);
                    logger_1.default.info(`Cache cleared: ${keys.length} keys matching pattern "${pattern}"`);
                }
            }
            catch (error) {
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
                return { connected: false };
            }
            try {
                const keys = yield this.client.dbsize();
                return {
                    connected: true,
                    keys,
                };
            }
            catch (error) {
                return {
                    connected: true,
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
