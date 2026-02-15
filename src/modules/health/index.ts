/**
 * Health module: health check (routes live inside the module)
 */
import { Router } from "express";
import healthRoutes from "./routes";

export const path = "/api/health";
export const router: Router = healthRoutes;

export default { path, router };
