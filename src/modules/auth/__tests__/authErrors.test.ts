import { AuthError, sendAuthError, validationError } from "../authErrors";

describe("auth error contract", () => {
  it("shapes VALIDATION_ERROR with fields", () => {
    const error = validationError("Check the form.", {
      email: "Enter a valid email address.",
    });
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.status).toBe(400);
    expect(error.fields?.email).toMatch(/valid email/i);
  });

  it("sends code + message + fields on the wire", () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    sendAuthError(
      { status } as any,
      new AuthError("EMAIL_TAKEN", "That email already has a Jevah account.", 409, {
        email: "That email already has a Jevah account.",
      })
    );
    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      success: false,
      code: "EMAIL_TAKEN",
      message: "That email already has a Jevah account.",
      fields: { email: "That email already has a Jevah account." },
    });
  });
});
