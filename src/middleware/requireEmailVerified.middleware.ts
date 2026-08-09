import { Request, Response, NextFunction } from "express";
import { User } from "../models/user.model";

/**
 * Requires User.isEmailVerified. Use on creator apply / studio writes.
 * Admin ops email / marketing / onboard are NOT gated — admins can always reach artists.
 */
export async function requireEmailVerified(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
        code: "AUTHENTICATION_REQUIRED",
      });
      return;
    }

    const user = await User.findById(userId).select("isEmailVerified email").lean();
    if (!user) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
        code: "AUTHENTICATION_REQUIRED",
      });
      return;
    }

    if (!(user as any).isEmailVerified) {
      res.status(403).json({
        success: false,
        message:
          "Verify your email before continuing as a creator. Check your inbox or use resend verification.",
        code: "EMAIL_NOT_VERIFIED",
        data: {
          email: (user as any).email || null,
          needsEmailVerification: true,
        },
      });
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
}
