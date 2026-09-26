import { normalizePersonName, normalizeRegisterEmail } from "../registerFields";
import { AuthError } from "../authErrors";

describe("register field normalization", () => {
  it("trims names and lowercases email", () => {
    expect(normalizePersonName("  Grace ", "firstName")).toBe("Grace");
    expect(normalizeRegisterEmail("  Grace@Ministry.COM ")).toBe(
      "grace@ministry.com"
    );
  });

  it("rejects empty or overlong names", () => {
    expect(() => normalizePersonName("", "lastName")).toThrow(AuthError);
    expect(() => normalizePersonName("x".repeat(41), "firstName")).toThrow(
      AuthError
    );
  });

  it("rejects invalid email", () => {
    try {
      normalizeRegisterEmail("not-an-email");
      throw new Error("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(AuthError);
      expect((error as AuthError).fields?.email).toBeDefined();
    }
  });
});
