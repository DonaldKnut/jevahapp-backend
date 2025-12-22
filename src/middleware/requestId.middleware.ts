import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

declare global {
  // eslint-disable-next-line no-var
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

/**
 * Attach a request ID to every request.
 * - Accepts upstream IDs (load balancer / CDN) if provided
 * - Adds `X-Request-Id` response header for client-side debugging
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const incoming =
    (req.headers["x-request-id"] as string | undefined) ||
    (req.headers["cf-ray"] as string | undefined) ||
    undefined;

  const requestId = incoming || randomUUID();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
}

