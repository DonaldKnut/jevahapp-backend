/**
 * Master / super-admin account.
 * Frontend allowlist should match MASTER_ADMIN_EMAIL (default support@jevahapp.com).
 */
export const MASTER_ADMIN_EMAIL = (
  process.env.SUPER_ADMIN_EMAIL ||
  process.env.MASTER_ADMIN_EMAIL ||
  "support@jevahapp.com"
)
  .trim()
  .toLowerCase();

export function normalizeEmail(email?: string | null): string {
  return (email || "").trim().toLowerCase();
}

export function isMasterAdminEmail(email?: string | null): boolean {
  const normalized = normalizeEmail(email);
  return Boolean(normalized) && normalized === MASTER_ADMIN_EMAIL;
}

export function isMasterAdminUser(user?: {
  email?: string | null;
} | null): boolean {
  return isMasterAdminEmail(user?.email);
}
