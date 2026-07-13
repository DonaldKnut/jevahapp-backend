import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";

/**
 * Logs deprecation warnings and sets standard deprecation headers.
 * Use before legacy shims that forward to the engagement module.
 */
export function deprecatedEndpoint(successorPath: string, sunset?: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    logger.warn("Deprecated API endpoint called", {
      method: req.method,
      path: req.originalUrl,
      successor: successorPath,
      userId: req.userId,
      ip: req.ip,
    });

    res.setHeader("Deprecation", "true");
    res.setHeader("Link", `<${successorPath}>; rel="successor-version"`);
    if (sunset) {
      res.setHeader("Sunset", sunset);
    }
    res.setHeader("X-API-Warn", `Use ${successorPath} instead`);

    next();
  };
}
