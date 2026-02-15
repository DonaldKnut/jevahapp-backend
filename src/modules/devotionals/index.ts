/**
 * Devotionals module
 */
import { Router } from "express";
import devotionalsRoutes from "../../routes/devotionals.routes";

export const path = "/api/devotionals";
export const router: Router = devotionalsRoutes;

export default { path, router };
