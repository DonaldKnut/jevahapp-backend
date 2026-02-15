import { Request, Response, NextFunction } from "express";
import { verifyToken } from "./auth.middleware";

/**
 * Optional authentication middleware.
 *
 * - If Authorization: Bearer <token> is present, we verify it and attach req.userId/req.user.
 * - If no Authorization header is present, we proceed as unauthenticated (no 401).
 *
 * Note: We intentionally do NOT attempt cookie-based refresh here, since this is used
 * on public endpoints like metadata where auth is optional and should not mutate session state.
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
  return verifyToken(req, res, next);
}


