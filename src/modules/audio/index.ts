/**
 * Audio module: copyright-free audio, playback
 */
import { Router } from "express";
import audioRoutes from "../../routes/audio.route";

export const path = "/api/audio";
export const router: Router = audioRoutes;

export default { path, router };
