/**
 * Content module: interactions, content interactions (like/save), bookmarks
 */
import { Router } from "express";
import interactionRoutes from "../../routes/interaction.routes";
import contentInteractionRoutes from "../../routes/contentInteraction.routes";
import bookmarksRoutes from "../../routes/unifiedBookmark.routes";

export interface Mount {
  path: string;
  router: Router;
}

export const mounts: Mount[] = [
  { path: "/api/interactions", router: interactionRoutes },
  { path: "/api/content", router: contentInteractionRoutes },
  { path: "/api/bookmark", router: bookmarksRoutes },
  { path: "/api/bookmarks", router: bookmarksRoutes },
];

export default { mounts };
