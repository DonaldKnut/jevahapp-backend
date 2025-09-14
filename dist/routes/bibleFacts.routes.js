"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bibleFacts_controller_1 = require("../controllers/bibleFacts.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
// import { requireRole } from "../middleware/role.middleware";
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = (0, express_1.Router)();
// Public endpoints
// GET /api/bible-facts/random - Get a random Bible fact
router.get("/random", rateLimiter_1.apiRateLimiter, bibleFacts_controller_1.getRandomBibleFact);
// GET /api/bible-facts/daily - Get daily Bible fact
router.get("/daily", rateLimiter_1.apiRateLimiter, bibleFacts_controller_1.getDailyBibleFact);
// GET /api/bible-facts/category/:category - Get Bible facts by category
router.get("/category/:category", rateLimiter_1.apiRateLimiter, bibleFacts_controller_1.getBibleFactsByCategory);
// GET /api/bible-facts/difficulty/:difficulty - Get Bible facts by difficulty
router.get("/difficulty/:difficulty", rateLimiter_1.apiRateLimiter, bibleFacts_controller_1.getBibleFactsByDifficulty);
// GET /api/bible-facts/search - Search Bible facts by tags
router.get("/search", rateLimiter_1.apiRateLimiter, bibleFacts_controller_1.searchBibleFactsByTags);
// User endpoints
// GET /api/bible-facts/personalized - Get personalized Bible fact for user
router.get("/personalized", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, bibleFacts_controller_1.getPersonalizedBibleFact);
// Admin endpoints
// GET /api/bible-facts/stats - Get Bible facts statistics
router.get("/stats", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, bibleFacts_controller_1.getBibleFactsStats);
// POST /api/bible-facts - Create a new Bible fact
router.post("/", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, bibleFacts_controller_1.createBibleFact);
exports.default = router;
