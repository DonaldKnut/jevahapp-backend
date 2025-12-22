"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const rateLimiter_1 = require("../middleware/rateLimiter");
const cache_middleware_1 = require("../middleware/cache.middleware");
const userContent_controller_1 = require("../controllers/userContent.controller");
const router = express_1.default.Router();
/**
 * @route   GET /api/user-content/my-content
 * @desc    Get all authenticated user's uploaded content with engagement metrics
 * @access  Protected (Authenticated users only)
 * @query   { page?: number, limit?: number, sort?: "recent" | "popular", contentType?: "all" | "video" | "audio" | "photo" | "post" }
 * @returns { success: boolean, data: Array<ContentItem>, pagination: object }
 */
router.get("/my-content", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, (0, cache_middleware_1.cacheMiddleware)(120, undefined, { allowAuthenticated: true, varyByUserId: true }), userContent_controller_1.getMyContent);
router.get("/user/tabs", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, (0, cache_middleware_1.cacheMiddleware)(120, undefined, { allowAuthenticated: true, varyByUserId: true }), userContent_controller_1.getProfileTabs);
router.get("/user/photos", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, (0, cache_middleware_1.cacheMiddleware)(120, undefined, { allowAuthenticated: true, varyByUserId: true }), userContent_controller_1.getUserPhotos);
router.get("/user/posts", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, (0, cache_middleware_1.cacheMiddleware)(120, undefined, { allowAuthenticated: true, varyByUserId: true }), userContent_controller_1.getUserPosts);
router.get("/user/videos", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, (0, cache_middleware_1.cacheMiddleware)(120, undefined, { allowAuthenticated: true, varyByUserId: true }), userContent_controller_1.getUserVideos);
router.get("/user/audios", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, (0, cache_middleware_1.cacheMiddleware)(120, undefined, { allowAuthenticated: true, varyByUserId: true }), userContent_controller_1.getUserAudios);
router.get("/user/content/:id", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, (0, cache_middleware_1.cacheMiddleware)(120, undefined, { allowAuthenticated: true }), userContent_controller_1.getUserContentById);
exports.default = router;
