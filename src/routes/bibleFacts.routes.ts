import { Router } from "express";
import {
  getRandomBibleFact,
  getPersonalizedBibleFact,
  getBibleFactsByCategory,
  getBibleFactsByDifficulty,
  searchBibleFactsByTags,
  getDailyBibleFact,
  getBibleFactsStats,
  createBibleFact,
} from "../controllers/bibleFacts.controller";
import { verifyToken } from "../middleware/auth.middleware";
// import { requireRole } from "../middleware/role.middleware";
import { apiRateLimiter } from "../middleware/rateLimiter";

const router = Router();

// Public endpoints
// GET /api/bible-facts/random - Get a random Bible fact
router.get("/random", apiRateLimiter, getRandomBibleFact);

// GET /api/bible-facts/daily - Get daily Bible fact
router.get("/daily", apiRateLimiter, getDailyBibleFact);

// GET /api/bible-facts/category/:category - Get Bible facts by category
router.get("/category/:category", apiRateLimiter, getBibleFactsByCategory);

// GET /api/bible-facts/difficulty/:difficulty - Get Bible facts by difficulty
router.get(
  "/difficulty/:difficulty",
  apiRateLimiter,
  getBibleFactsByDifficulty
);

// GET /api/bible-facts/search - Search Bible facts by tags
router.get("/search", apiRateLimiter, searchBibleFactsByTags);

// User endpoints
// GET /api/bible-facts/personalized - Get personalized Bible fact for user
router.get(
  "/personalized",
  verifyToken,
  apiRateLimiter,
  getPersonalizedBibleFact
);

// Admin endpoints
// GET /api/bible-facts/stats - Get Bible facts statistics
router.get("/stats", verifyToken, apiRateLimiter, getBibleFactsStats);

// POST /api/bible-facts - Create a new Bible fact
router.post("/", verifyToken, apiRateLimiter, createBibleFact);

export default router;
