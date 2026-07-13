import { Router } from "express";
import publicRoutes from "./public.routes";
import uploadRoutes from "./upload.routes";
import analyticsRoutes from "./analytics.routes";
import downloadRoutes from "./download.routes";
import livestreamRoutes from "./livestream.routes";
import engagementRoutes from "./engagement.routes";
import crudRoutes from "./crud.routes";

const router = Router();

// Static and scoped routes before crud's /:id catch-all
router.use(publicRoutes);
router.use(uploadRoutes);
router.use(analyticsRoutes);
router.use(downloadRoutes);
router.use(livestreamRoutes);
router.use(engagementRoutes);
router.use(crudRoutes);

export default router;
