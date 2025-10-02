import express from "express";
import { apiRateLimiter } from "../middleware/rateLimiter";
import { suggestPlaces, getChurchById } from "../controllers/places.controller";

const router = express.Router();

// Public suggestions (rate limited)
router.get("/places/suggest", apiRateLimiter, suggestPlaces);

// Public church detail
router.get("/churches/:id", apiRateLimiter, getChurchById);

export default router;

