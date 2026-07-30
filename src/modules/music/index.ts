/**
 * Public music / artist catalog (Spotify-for-gospel surfaces)
 */
import { Router } from "express";
import {
  getPublicArtistBySlug,
  listPublicArtistTracks,
  browseMusicTracks,
} from "../../controllers/publicMusic.controller";
import { apiRateLimiter } from "../../middleware/rateLimiter";

export interface Mount {
  path: string;
  router: Router;
}

const artistsRouter = Router();
artistsRouter.get("/:slug/tracks", apiRateLimiter, listPublicArtistTracks);
artistsRouter.get("/:slug", apiRateLimiter, getPublicArtistBySlug);

const musicRouter = Router();
musicRouter.get("/tracks", apiRateLimiter, browseMusicTracks);

export const mounts: Mount[] = [
  { path: "/api/artists", router: artistsRouter },
  { path: "/api/music", router: musicRouter },
];

export default { mounts };
