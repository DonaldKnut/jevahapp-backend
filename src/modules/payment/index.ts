/**
 * Payment module
 */
import { Router } from "express";
import paymentRoutes from "../../routes/payment.route";

export const path = "/api/payment";
export const router: Router = paymentRoutes;

export default { path, router };
