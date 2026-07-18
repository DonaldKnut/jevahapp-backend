/**
 * Admin module: dashboard, reports, verification, logs
 */
import { Router } from "express";
import adminDashboardRoutes from "../../routes/adminDashboard.routes";
import logsRoutes from "../../routes/logs.routes";

export interface Mount {
  path: string;
  router: Router;
}

export const mounts: Mount[] = [
  { path: "/api/admin", router: adminDashboardRoutes },
  { path: "/api/logs", router: logsRoutes },
];

export default { mounts };
