/**
 * Metrics module: internal metrics (protect at infrastructure level)
 */
import { Router } from "express";
import metricsRoutes from "../../routes/metrics.routes";

export const path = "/api/metrics";
export const router: Router = metricsRoutes;

export default { path, router };
