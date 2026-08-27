/**
 * Modular route registration.
 *
 * Target layout (colocate as you touch a feature — do not rewrite the repo):
 *   src/modules/<domain>/
 *     index.ts          mounts: [{ path: "/api/...", router }]
 *     *.routes.ts
 *     *.controller.ts
 *     *.service.ts
 *     __tests__/
 *
 * Public URL paths never change. Old files under src/routes|controllers|service
 * may re-export from here until the next edit in that domain.
 * Gold examples: modules/bible, modules/engagement, modules/creators.
 */
import type { Application } from "express";
import logger from "../utils/logger";

import * as auth from "./auth";
import * as users from "./users";
import * as media from "./media";
import * as admin from "./admin";
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
import * as music from "./music";
import * as creators from "./creators";
import * as sermons from "./sermons";
import * as search from "./search";
import * as feed from "./feed";
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
    music,
    creators,
    sermons,
    search,
    feed,
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
