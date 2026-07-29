import { JWT_SECRET } from "../../config/tokenConfig";

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined in environment variables");
}

export const JWT_SECRET_ASSERTED: string = JWT_SECRET;

/** Login / refresh reject banned accounts with the same 403 shape as verifyToken */
export class AccountBannedError extends Error {
  banReason: string;
  banUntil: Date | null;

  constructor(
    banReason?: string | null,
    banUntil?: Date | null
  ) {
    super("Account is banned");
    this.name = "AccountBannedError";
    this.banReason = banReason || "Violation of community guidelines";
    this.banUntil = banUntil ?? null;
  }
}

/**
 * If the user is banned and the window has not expired, throw AccountBannedError.
 * If banUntil has passed, clear ban flags (best-effort) and return false.
 */
export async function assertUserNotBanned(user: {
  _id: { toString(): string };
  isBanned?: boolean;
  banUntil?: Date | null;
  banReason?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}): Promise<void> {
  if (!user?.isBanned) return;

  if (user.banUntil && new Date() > new Date(user.banUntil)) {
    try {
      const { User } = await import("../../models/user.model");
      await User.findByIdAndUpdate(user._id, {
        isBanned: false,
        banUntil: undefined,
        banReason: undefined,
      });
      user.isBanned = false;
    } catch {
      // Non-blocking — allow login if window expired
    }
    return;
  }

  throw new AccountBannedError(user.banReason, user.banUntil ?? null);
}

/** Normalize emailed OTP codes (stored uppercase hex) before DB compare */
export function normalizeAuthCode(code: string): string {
  return String(code ?? "").trim().toUpperCase();
}

export function setVerificationFlags(role: string) {
  const verificationFlags = {
    isVerifiedCreator: false,
    isVerifiedVendor: false,
    isVerifiedChurch: false,
  };

  switch (role) {
    case "content_creator":
      verificationFlags.isVerifiedCreator = false;
      break;
    case "vendor":
      verificationFlags.isVerifiedVendor = false;
      break;
    case "church_admin":
      verificationFlags.isVerifiedChurch = false;
      break;
  }

  return verificationFlags;
}
