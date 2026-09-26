import { AuthError } from "./authErrors";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "password12",
  "password123",
  "12345678",
  "123456789",
  "1234567890",
  "qwerty123",
  "qwerty12",
  "letmein1",
  "welcome1",
  "jevah123",
  "jevahapp",
  "admin123",
  "passw0rd",
]);

export const PASSWORD_RULE_MESSAGE =
  "Use at least 8 characters with a letter and a number.";

export interface PasswordPolicyResult {
  ok: boolean;
  message?: string;
}

/**
 * Shared password policy for web + mobile register / reset / change.
 * Login does not re-check this so existing accounts keep working.
 */
export function evaluatePassword(
  password: string,
  email?: string
): PasswordPolicyResult {
  const value = String(password ?? "");

  if (value.length < PASSWORD_MIN_LENGTH || value.length > PASSWORD_MAX_LENGTH) {
    return { ok: false, message: PASSWORD_RULE_MESSAGE };
  }

  if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) {
    return { ok: false, message: PASSWORD_RULE_MESSAGE };
  }

  if (COMMON_PASSWORDS.has(value.toLowerCase())) {
    return { ok: false, message: "Choose a less common password." };
  }

  const local = String(email || "")
    .split("@")[0]
    ?.trim()
    .toLowerCase();
  if (local && local.length >= 3 && value.toLowerCase().includes(local)) {
    return {
      ok: false,
      message: "Password cannot contain the email username.",
    };
  }

  return { ok: true };
}

export function assertPasswordPolicy(password: string, email?: string): void {
  const result = evaluatePassword(password, email);
  if (!result.ok) {
    throw new AuthError(
      "WEAK_PASSWORD",
      result.message || PASSWORD_RULE_MESSAGE,
      400,
      { password: result.message || PASSWORD_RULE_MESSAGE }
    );
  }
}
