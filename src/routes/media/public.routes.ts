import { Router } from "express";
import {
  getPublicMedia,
  getPublicAllContent,
  getPublicMediaByIdentifier,
  searchPublicMedia,
  getDefaultContent,
  getOnboardingContent,
} from "../../controllers/media.controller";
import { verifyToken } from "../../middleware/auth.middleware";
import { verifyTokenOptional } from "../../middleware/optionalAuth.middleware";
import { apiRateLimiter } from "../../middleware/rateLimiter";
import { cacheMiddleware } from "../../middleware/cache.middleware";

const router = Router();

/**
 * @route   GET /api/media/public
 * @desc    Retrieve all media items with optional filters (PUBLIC - no authentication required)
 * @access  Public (No authentication required)
 * @query   { search?: string, contentType?: string, category?: string, topics?: string, sort?: string, page?: string, limit?: string, creator?: string, duration?: "short" | "medium" | "long", startDate?: string, endDate?: string }
 * @returns { success: boolean, media: object[], pagination: { page: number, limit: number, total: number, pages: number } }
 */
router.get(
  "/public",
  apiRateLimiter,
  cacheMiddleware(30),
  getPublicMedia
);

/**
 * @route   GET /api/media/public/all-content
 * @desc    Global feed: ALL content on the platform (everyone's uploads), same as /api/media/all-content. Recency-ordered; new uploads appear when approved/live. No filter by uploader.
 * @access  Public (optional Bearer — when present, overlays hasLiked / hasBookmarked)
 * @query   { page?, limit?, contentType?, category?, minViews?, minLikes?, dateFrom?, dateTo?, search?, sort? (default: "createdAt"), order? (default: "desc"), mood? }
 * @returns { success: boolean, data: { media: object[], pagination }, recommendations?: object }
 */
router.get(
  "/public/all-content",
  apiRateLimiter,
  verifyTokenOptional,
  // Shared feed list is cached inside the controller (generation + SWR).
  // Do not wrap with cacheMiddleware — that would freeze count overlays.
  getPublicAllContent
);

/**
 * @route   GET /api/media/public/search
 * @desc    Search media items by title, type, category, topics, etc. (PUBLIC - no authentication required)
 * @access  Public (No authentication required)
 * @query   { search?: string, contentType?: string, category?: string, topics?: string, sort?: string, page?: string, limit?: string, creator?: string, duration?: "short" | "medium" | "long", startDate?: string, endDate?: string }
 * @returns { success: boolean, message: string, media: object[], pagination: { page: number, limit: number, total: number, pages: number } }
 */
router.get(
  "/public/search",
  apiRateLimiter,
  cacheMiddleware(15),
  searchPublicMedia
);

/**
 * @route   GET /api/media/public/:id
 * @desc    Retrieve a single media item by its identifier (PUBLIC - no authentication required)
 * @access  Public (No authentication required)
 * @param   { id: string } - MongoDB ObjectId of the media item
 * @returns { success: boolean, media: object }
 */
router.get(
  "/public/:id",
  apiRateLimiter,
  cacheMiddleware(120),
  getPublicMediaByIdentifier
);

/**
 * @route   GET /api/media/default
 * @desc    Get default/onboarding content for new users (PUBLIC - no authentication required)
 * @access  Public (No authentication required)
 * @query   { contentType?: string, limit?: string }
 * @returns { success: boolean, data: { total: number, grouped: object, all: object[] } }
 */
router.get(
  "/default",
  apiRateLimiter,
  cacheMiddleware(600),
  getDefaultContent
);

/**
 * @route   GET /api/media/onboarding
 * @desc    Get curated onboarding content experience for new users
 * @access  Protected (Authenticated users only)
 * @returns { success: boolean, data: { welcome: object, quickStart: object, featured: object, devotionals: object } }
 */
router.get("/onboarding", verifyToken, apiRateLimiter, getOnboardingContent);

export default router;
