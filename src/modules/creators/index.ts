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
export {
  notifyCreator,
  notifyCreatorSafe,
  notifyMediaModerationOutcomeSafe,
  maybeNotifyViewMilestone,
} from "./creatorNotify.service";
export {
  creatorNotifyCopy,
  viewMilestoneEvent,
  VIEW_MILESTONES,
  BUZZING_THRESHOLD,
} from "./creatorNotify.catalog";
export {
  JEVAH_GOSPEL_STANDARD,
  creatorFacingModerationReason,
} from "./creatorFacingReason";
export type { CreatorNotifyEvent } from "./creatorNotify.catalog";
export default { mounts };
