/**
 * Ebooks module: ebooks, TTS (mounted at /api/ebooks and /api/tts)
 */
import { Router } from "express";
import ebookRoutes from "../../routes/ebook.routes";

export interface Mount {
  path: string;
  router: Router;
}

export const mounts: Mount[] = [
  { path: "/api/ebooks", router: ebookRoutes },
  { path: "/api/tts", router: ebookRoutes },
];

export default { mounts };
