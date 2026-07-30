/**
 * Public sermons catalog (web /sermons) — Media contentType=sermon
 */
import { Router } from "express";
import {
  listPublicSermons,
  getPublicSermonById,
  listFeaturedSermons,
  listSermonTopics,
} from "../../controllers/sermons.controller";
import { apiRateLimiter } from "../../middleware/rateLimiter";

export interface Mount {
  path: string;
  router: Router;
}

const router = Router();

// Static paths before :id
router.get("/", apiRateLimiter, listPublicSermons);
router.get("/featured", apiRateLimiter, listFeaturedSermons);
router.get("/topics", apiRateLimiter, listSermonTopics);
router.get("/:id", apiRateLimiter, getPublicSermonById);

export const mounts: Mount[] = [{ path: "/api/sermons", router }];

export default { mounts };
