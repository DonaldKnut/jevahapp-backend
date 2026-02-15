/**
 * Location module: location, places, churches admin
 */
import { Router } from "express";
import locationRoutes from "../../routes/location.routes";
import placesRoutes from "../../routes/places.routes";
import churchesAdminRoutes from "../../routes/churches.admin.routes";

export interface Mount {
  path: string;
  router: Router;
}

export const mounts: Mount[] = [
  { path: "/api/location", router: locationRoutes },
  { path: "/api", router: placesRoutes },
  { path: "/api", router: churchesAdminRoutes },
];

export default { mounts };
