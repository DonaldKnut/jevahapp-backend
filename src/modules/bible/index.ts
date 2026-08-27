/**
 * Bible module: scripture catalog, verses, search, offline packs.
 * Public URLs unchanged: /api/bible, /api/bible-facts
 */
import { Router } from "express";
import bibleRoutes from "./bible.routes";
import bibleFactsRoutes from "../../routes/bibleFacts.routes";

export interface Mount {
  path: string;
  router: Router;
}

export const mounts: Mount[] = [
  { path: "/api/bible", router: bibleRoutes },
  { path: "/api/bible-facts", router: bibleFactsRoutes },
];

export default { mounts };
export { default as bibleService } from "./bible.service";
