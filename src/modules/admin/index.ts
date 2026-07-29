/**
 * Admin module: dashboard, reports, verification, logs, public app config
 */
import { Router } from "express";
import adminDashboardRoutes from "../../routes/adminDashboard.routes";
import logsRoutes from "../../routes/logs.routes";
import creatorsRoutes, {
  publicAnnouncementsRouter,
} from "../../routes/creators.routes";
import { getPublicAppConfig } from "../../controllers/adminPlatform.controller";
import { apiRateLimiter } from "../../middleware/rateLimiter";

export interface Mount {
  path: string;
  router: Router;
}

const publicConfigRouter = Router();
publicConfigRouter.get("/config", apiRateLimiter, getPublicAppConfig);
publicConfigRouter.use(publicAnnouncementsRouter);

export const mounts: Mount[] = [
  { path: "/api/admin", router: adminDashboardRoutes },
  { path: "/api/logs", router: logsRoutes },
  { path: "/api/app", router: publicConfigRouter },
  { path: "/api/creators", router: creatorsRoutes },
];

export default { mounts };
