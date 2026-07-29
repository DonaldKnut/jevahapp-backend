/**
 * Engagement module: likes, saves, shares, views, metadata, comments
 *
 * Mount ownership (single source of truth for interaction-icon APIs):
 * - /api/content      → contentRouter  (canonical like/share/view/metadata/comments)
 * - /api/bookmark(s)  → saveRouter
 * - /api/interactions → legacyRouter  (comment reaction/delete aliases, DMs, share URLs)
 * - /api/trending, /api/analytics — pulled in for historical mount grouping
 *
 * Media FE fallbacks (GET/POST comments) live under /api/media via
 * routes/media/engagement.routes.ts → bindMediaCommentShims (same handlers).
 * Community legacy /api/comments is separate and deprecated.
 */
import { Router } from "express";
import trendingRoutes from "../../routes/trending.routes";
import analyticsRoutes from "../../routes/analytics.routes";
import { contentRouter, saveRouter, legacyRouter } from "./routes";

export interface Mount {
  path: string;
  router: Router;
}

export const mounts: Mount[] = [
  { path: "/api/content", router: contentRouter },
  { path: "/api/bookmark", router: saveRouter },
  { path: "/api/bookmarks", router: saveRouter },
  { path: "/api/interactions", router: legacyRouter },
  { path: "/api/trending", router: trendingRoutes },
  { path: "/api/analytics", router: analyticsRoutes },
];

export default { mounts };

export { default as likeService } from "./like/like.service";
export { default as shareService } from "./share/share.service";
export { default as viewService } from "./view/view.service";
export { UnifiedBookmarkService as saveService } from "./save/save.service";
export { default as commentService } from "./comments/comment.service";
export { default as metadataService } from "./metadata/metadata.service";
