/**
 * Bible module: Bible text/search, bible facts
 */
import { Router } from "express";
import bibleRoutes from "../../routes/bible.routes";
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
