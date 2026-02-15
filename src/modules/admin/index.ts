/**
 * Admin module: admin actions, dashboard, logs
 */
import { Router } from "express";
import adminRoutes from "../../routes/admin.routes";
import adminDashboardRoutes from "../../routes/adminDashboard.routes";
import logsRoutes from "../../routes/logs.routes";

export interface Mount {
  path: string;
  router: Router;
}

export const mounts: Mount[] = [
  { path: "/api/admin", router: adminRoutes },
  { path: "/api/admin", router: adminDashboardRoutes },
  { path: "/api/logs", router: logsRoutes },
];

export default { mounts };
