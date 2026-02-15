/**
 * Auth module: login, register, password reset, verification, avatar
 */
import { Router } from "express";
import authRoutes from "../../routes/auth.route";

export const path = "/api/auth";
export const router: Router = authRoutes;

export default { path, router };
