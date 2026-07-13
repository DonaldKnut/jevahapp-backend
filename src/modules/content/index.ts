/**
 * Content module: non-engagement content routes only.
 * Interaction icons (like/save/share/view) live in the engagement module.
 */
import { Router } from "express";

export interface Mount {
  path: string;
  router: Router;
}

export const mounts: Mount[] = [];

export default { mounts };
