/**
 * Engagement module: trending, analytics
 */
import { Router } from "express";
import trendingRoutes from "../../routes/trending.routes";
import analyticsRoutes from "../../routes/analytics.routes";

export interface Mount {
  path: string;
  router: Router;
}

export const mounts: Mount[] = [
  { path: "/api/trending", router: trendingRoutes },
  { path: "/api/analytics", router: analyticsRoutes },
];

export default { mounts };
