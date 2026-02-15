/**
 * Community module: community modules, comments
 */
import { Router } from "express";
import communityRoutes from "../../routes/community.routes";
import commentRoutes from "../../routes/comment.route";

export interface Mount {
  path: string;
  router: Router;
}

export const mounts: Mount[] = [
  { path: "/api/community", router: communityRoutes },
  { path: "/api/comments", router: commentRoutes },
];

export default { mounts };
