import { Request, Response, NextFunction } from "express";
import { verifyToken } from "./auth.middleware";
import logger from "../utils/logger";

/**
 * Optional authentication middleware.
 *
 * - Bearer present + valid → attach req.userId / req.user
 * - No Bearer → continue as guest
 * - Bearer present but invalid/expired/banned → continue as guest (public reads
 *   like comments/metadata must not 401)
 */
export async function verifyTokenOptional(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  let settled = false;

  const clearUser = () => {
    delete (req as any).userId;
    delete (req as any).user;
    delete (req as any).userRole;
  };

  const softRes = {
    status(code: number) {
      return {
        json(body: unknown) {
          if (settled) return res;
          if (code === 401 || code === 403) {
            clearUser();
            settled = true;
            logger.debug("Optional auth failed; continuing as guest", {
              status: code,
              path: req.path,
              message: (body as any)?.message,
            });
            next();
            return softRes;
          }
          settled = true;
          return res.status(code).json(body);
        },
      };
    },
    clearCookie: (...args: Parameters<Response["clearCookie"]>) =>
      res.clearCookie(...args),
    setHeader: (...args: Parameters<Response["setHeader"]>) =>
      res.setHeader(...args),
  } as unknown as Response;

  try {
    await verifyToken(req, softRes, () => {
      if (!settled) {
        settled = true;
        next();
      }
    });
  } catch (err: any) {
    clearUser();
    if (!settled) {
      settled = true;
      logger.debug("Optional auth threw; continuing as guest", {
        error: err?.message,
        path: req.path,
      });
      next();
    }
  }
}
