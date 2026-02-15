/**
 * Media module: media CRUD, upload, reports, playback session, enhanced media
 */
import { Router } from "express";
import mediaRoutes from "../../routes/media.route";
import mediaReportRoutes from "../../routes/mediaReport.route";
import playbackSessionRoutes from "../../routes/playbackSession.route";
import enhancedMediaRoutes from "../../routes/enhancedMedia.route";

export interface Mount {
  path: string;
  router: Router;
}

export const mounts: Mount[] = [
  { path: "/api/media", router: mediaRoutes },
  { path: "/api/media", router: mediaReportRoutes },
  { path: "/api/media", router: playbackSessionRoutes },
  { path: "/api/enhanced-media", router: enhancedMediaRoutes },
];

export default { mounts };
