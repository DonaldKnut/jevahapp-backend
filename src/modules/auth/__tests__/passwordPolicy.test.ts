import {
  evaluatePassword,
  assertPasswordPolicy,
  PASSWORD_RULE_MESSAGE,
} from "../passwordPolicy";
import { AuthError } from "../authErrors";

describe("password policy", () => {
  it("accepts 8+ chars with a letter and a number", () => {
    expect(evaluatePassword("Correct1").ok).toBe(true);
    expect(evaluatePassword("Correct-horse-battery-1").ok).toBe(true);
  });

  it("rejects short, letter-only, number-only, and common passwords", () => {
    expect(evaluatePassword("Ab1").ok).toBe(false);
    expect(evaluatePassword("abcdefgh").ok).toBe(false);
    expect(evaluatePassword("12345678").ok).toBe(false);
    expect(evaluatePassword("password").ok).toBe(false);
    expect(evaluatePassword("password1").message).toMatch(/common/i);
  });

  it("rejects passwords that contain the email local part", () => {
    const result = evaluatePassword("grace1234", "grace@ministry.com");
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/email/i);
  });

  it("throws WEAK_PASSWORD with fields.password", () => {
    try {
      assertPasswordPolicy("short");
      throw new Error("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(AuthError);
      expect((error as AuthError).code).toBe("WEAK_PASSWORD");
      expect((error as AuthError).fields?.password).toBe(PASSWORD_RULE_MESSAGE);
    }
  });
});
