import { Request, Response, NextFunction } from "express";
import { getPlatformConfig } from "../service/admin/platformConfig.service";
import logger from "../utils/logger";

/**
 * Block registration when disabled or in maintenance.
 * Mount on POST /api/auth/register* before controllers.
 */
export async function requireRegistrationEnabled(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const cfg = await getPlatformConfig();
    if (cfg.maintenanceMode) {
      res.status(503).json({
        success: false,
        message: cfg.maintenanceMessage || "Service temporarily unavailable",
        code: "MAINTENANCE_MODE",
      });
      return;
    }
    if (!cfg.registrationEnabled) {
      res.status(403).json({
        success: false,
        message: "New registrations are temporarily disabled",
        code: "REGISTRATION_DISABLED",
      });
      return;
    }
    next();
  } catch (error: any) {
    logger.warn("Platform gate (registration) failed open", {
      error: error?.message,
    });
    next();
  }
}

/**
 * Block media uploads when disabled or in maintenance.
 * Mount on upload / staging intent routes.
 */
export async function requireUploadsEnabled(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const cfg = await getPlatformConfig();
    if (cfg.maintenanceMode) {
      res.status(503).json({
        success: false,
        message: cfg.maintenanceMessage || "Service temporarily unavailable",
        code: "MAINTENANCE_MODE",
      });
      return;
    }
    if (!cfg.uploadsEnabled) {
      res.status(403).json({
        success: false,
        message: "Uploads are temporarily disabled",
        code: "UPLOADS_DISABLED",
      });
      return;
    }
    next();
  } catch (error: any) {
    logger.warn("Platform gate (uploads) failed open", {
      error: error?.message,
    });
    next();
  }
}

/**
 * Optional soft gate for authenticated app traffic during maintenance.
 * Admins bypass. Use on optional public surfaces if desired later.
 */
export async function requireNotInMaintenance(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (req.userRole === "admin" || (req as any).user?.role === "admin") {
      next();
      return;
    }
    const cfg = await getPlatformConfig();
    if (cfg.maintenanceMode) {
      res.status(503).json({
        success: false,
        message: cfg.maintenanceMessage || "Service temporarily unavailable",
        code: "MAINTENANCE_MODE",
        data: {
          maintenanceMode: true,
          maintenanceMessage: cfg.maintenanceMessage,
        },
      });
      return;
    }
    next();
  } catch (error: any) {
    logger.warn("Platform gate (maintenance) failed open", {
      error: error?.message,
    });
    next();
  }
}
