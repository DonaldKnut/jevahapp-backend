/**
 * Users module: user CRUD, profile settings, user profiles, user content
 */
import { Router } from "express";
import userRoutes from "../../routes/user.route";
import profileSettingsRoutes from "../../routes/profileSettings.routes";
import userProfileRoutes from "../../routes/userProfile.routes";
import userContentRoutes from "../../routes/userContent.routes";

export interface Mount {
  path: string;
  router: Router;
}

export const mounts: Mount[] = [
  { path: "/api/users", router: userRoutes },
  { path: "/api/user/profile", router: profileSettingsRoutes },
  { path: "/api/user-profiles", router: userProfileRoutes },
  { path: "/api", router: userContentRoutes },
];

export default { mounts };
