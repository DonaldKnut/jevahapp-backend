import { Router } from "express";
import copyrightFreeRoutes from "./copyrightFree.routes";
import playlistRoutes from "./playlist.routes";
import playbackRoutes from "./playback.routes";

const router = Router();

router.use(copyrightFreeRoutes);
router.use(playlistRoutes);
router.use(playbackRoutes);

export default router;
