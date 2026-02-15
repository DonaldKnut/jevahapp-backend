/**
 * Search module: unified search
 */
import { Router } from "express";
import searchRoutes from "../../routes/search.route";

export const path = "/api/search";
export const router: Router = searchRoutes;

export default { path, router };
