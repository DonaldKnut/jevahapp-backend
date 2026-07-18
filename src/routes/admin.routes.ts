import { Router } from "express";

/**
 * Legacy admin router — duplicate /users routes removed so they no longer
 * shadow the paginated handlers in adminDashboard.routes.ts.
 * Kept as an empty router for backwards-compatible module mounts.
 */
const router = Router();

export default router;
