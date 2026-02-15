/**
 * Merchandise module
 */
import { Router } from "express";
import merchandiseRoutes from "../../routes/merchandise.route";

export const path = "/api/merchandise";
export const router: Router = merchandiseRoutes;

export default { path, router };
