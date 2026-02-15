/**
 * Games module
 */
import { Router } from "express";
import gamesRoutes from "../../routes/games.route";

export const path = "/api/games";
export const router: Router = gamesRoutes;

export default { path, router };
