/**
 * Ebooks module: catalog at /api/ebooks, TTS at /api/ebooks and /api/tts
 */
import { Router } from "express";
import ebookRoutes from "../../routes/ebook.routes";
import { listPublicEbooks } from "../../controllers/ebook.controller";
import { apiRateLimiter } from "../../middleware/rateLimiter";

export interface Mount {
  path: string;
  router: Router;
}

const catalog = Router();
catalog.get("/", apiRateLimiter, listPublicEbooks);

export const mounts: Mount[] = [
  { path: "/api/ebooks", router: catalog },
  { path: "/api/ebooks", router: ebookRoutes },
  { path: "/api/tts", router: ebookRoutes },
];

export default { mounts };
