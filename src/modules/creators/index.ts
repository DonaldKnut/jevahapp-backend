/**
 * Creators module: Studio desk (profile, tracks, releases, analytics).
 * Public URL unchanged: /api/creators
 */
import { Router } from "express";
import creatorsRoutes, {
  publicAnnouncementsRouter,
} from "./creators.routes";

export interface Mount {
  path: string;
  router: Router;
}

export const mounts: Mount[] = [
  { path: "/api/creators", router: creatorsRoutes },
];

export { publicAnnouncementsRouter };
export default { mounts };
