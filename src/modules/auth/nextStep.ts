export type AuthNextStep =
  | "verify_email"
  | "apply"
  | "wait_review"
  | "studio"
  | "home"
  | "contact_support";

export interface NextStepInput {
  isEmailVerified?: boolean;
  isBanned?: boolean;
  isVerifiedArtist?: boolean;
  isVerifiedCreator?: boolean;
  role?: string;
  artistStatus?: "pending" | "active" | "suspended" | "rejected" | null;
  source?: string | null;
}

/**
 * Identity-level next step. Creator studio details still live on GET /api/creators/me.
 */
export function resolveAuthNextStep(input: NextStepInput): AuthNextStep {
  if (input.isBanned) return "contact_support";
  if (!input.isEmailVerified) return "verify_email";

  if (input.artistStatus === "suspended") return "contact_support";
  if (input.artistStatus === "rejected") return "apply";
  if (input.artistStatus === "pending") return "wait_review";
  if (
    input.artistStatus === "active" ||
    input.isVerifiedArtist ||
    input.isVerifiedCreator ||
    input.role === "artist"
  ) {
    return "studio";
  }

  if (input.source === "creators_web") return "apply";
  return "home";
}

export function registerNextStep(isEmailVerified: boolean): AuthNextStep {
  return isEmailVerified ? "apply" : "verify_email";
}
