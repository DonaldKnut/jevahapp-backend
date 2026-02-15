/**
 * Playlists module
 */
import { Router } from "express";
import playlistRoutes from "../../routes/playlist.route";

export const path = "/api/playlists";
export const router: Router = playlistRoutes;

export default { path, router };
