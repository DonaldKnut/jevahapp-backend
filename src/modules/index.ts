/**
 * Modular route registration.
 * All API routes are grouped by domain; this file mounts them on the Express app.
 * Add new domains under src/modules/<domain>/index.ts and register below.
 */
import type { Application } from "express";
import logger from "../utils/logger";

import * as auth from "./auth";
import * as users from "./users";
import * as media from "./media";
import * as admin from "./admin";
import * as content from "./content";
import * as bible from "./bible";
import * as community from "./community";
import * as location from "./location";
import * as notifications from "./notifications";
import * as ai from "./ai";
import * as engagement from "./engagement";
import * as devotionals from "./devotionals";
import * as games from "./games";
import * as payment from "./payment";
import * as merchandise from "./merchandise";
import * as hymns from "./hymns";
import * as ebooks from "./ebooks";
import * as playlists from "./playlists";
import * as audio from "./audio";
import * as search from "./search";
import * as health from "./health";
import * as metrics from "./metrics";

type ModuleWithMounts = { mounts: Array<{ path: string; router: any }> };
type ModuleWithPath = { path: string; router: any };

function isMountsModule(m: any): m is ModuleWithMounts {
  return Array.isArray(m?.mounts);
}

function isPathModule(m: any): m is ModuleWithPath {
  return typeof m?.path === "string" && m?.router != null;
}

/**
 * Register all module routes on the Express app.
 * Call this from app.ts after global middleware.
 */
export function registerModules(app: Application): void {
  const modules = [
    auth,
    users,
    media,
    admin,
    content,
    bible,
    community,
    location,
    notifications,
    ai,
    engagement,
    devotionals,
    games,
    payment,
    merchandise,
    hymns,
    ebooks,
    playlists,
    audio,
    search,
    health,
    metrics,
  ];

  for (const mod of modules) {
    if (isMountsModule(mod)) {
      for (const { path, router } of mod.mounts) {
        app.use(path, router);
      }
    } else if (isPathModule(mod)) {
      app.use(mod.path, mod.router);
    }
  }

  logger.info("Modules registered", { count: modules.length });
}

export default registerModules;
