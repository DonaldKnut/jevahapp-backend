import { JWT_SECRET } from "../../config/tokenConfig";

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined in environment variables");
}

export const JWT_SECRET_ASSERTED: string = JWT_SECRET;

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
