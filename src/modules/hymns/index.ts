/**
 * Hymns module
 */
import { Router } from "express";
import hymnsRoutes from "../../routes/hymns.routes";

export const path = "/api/hymns";
export const router: Router = hymnsRoutes;

export default { path, router };
