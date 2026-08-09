/**
 * Public music / artist catalog (Spotify-for-gospel surfaces)
 */
import { Router } from "express";
import {
  getPublicArtistBySlug,
  listPublicArtistTracks,
  browseMusicTracks,
  listPublicArtists,
  recordMusicTrackPlay,
} from "../../controllers/publicMusic.controller";
import {
  getPublicReleaseHandler,
  listPublicArtistReleasesHandler,
} from "../../controllers/creatorReleases.controller";
import {
  toggleLike as toggleLikeCopyrightFreeSongNew,
  recordView as recordViewCopyrightFreeSong,
  shareSong as shareCopyrightFreeSongNew,
  toggleSave as toggleSaveCopyrightFreeSong,
} from "../../controllers/copyrightFreeSong.controller";
import { apiRateLimiter } from "../../middleware/rateLimiter";
import { verifyToken } from "../../middleware/auth.middleware";

export interface Mount {
  path: string;
  router: Router;
}

const artistsRouter = Router();
artistsRouter.get("/", apiRateLimiter, listPublicArtists);
artistsRouter.get(
  "/:slug/releases",
  apiRateLimiter,
  listPublicArtistReleasesHandler
);
artistsRouter.get("/:slug/tracks", apiRateLimiter, listPublicArtistTracks);
artistsRouter.get("/:slug", apiRateLimiter, getPublicArtistBySlug);

const musicRouter = Router();
musicRouter.get("/tracks", apiRateLimiter, browseMusicTracks);
musicRouter.get(
  "/for-you",
  verifyToken,
  apiRateLimiter,
  async (req, res, next) => {
    // Alias → same handler as /api/feed/music-for-you
    try {
      const { getMusicForYou } = await import("../feed/feed.controller");
      return getMusicForYou(req, res);
    } catch (err) {
      return next(err);
    }
  }
);
musicRouter.get(
  "/releases/:idOrSlug",
  apiRateLimiter,
  getPublicReleaseHandler
);
musicRouter.post(
  "/tracks/:songId/like",
  verifyToken,
  apiRateLimiter,
  toggleLikeCopyrightFreeSongNew
);
musicRouter.post(
  "/tracks/:songId/view",
  verifyToken,
  apiRateLimiter,
  recordViewCopyrightFreeSong
);
musicRouter.post(
  "/tracks/:songId/share",
  verifyToken,
  apiRateLimiter,
  shareCopyrightFreeSongNew
);
musicRouter.post(
  "/tracks/:songId/save",
  verifyToken,
  apiRateLimiter,
  toggleSaveCopyrightFreeSong
);
musicRouter.post(
  "/tracks/:songId/play",
  verifyToken,
  apiRateLimiter,
  recordMusicTrackPlay
);

export const mounts: Mount[] = [
  { path: "/api/artists", router: artistsRouter },
  { path: "/api/music", router: musicRouter },
];

export default { mounts };
