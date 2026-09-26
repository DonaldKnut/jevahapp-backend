import { registerNextStep, resolveAuthNextStep } from "../nextStep";

describe("auth nextStep", () => {
  it("sends unverified users to verify_email", () => {
    expect(registerNextStep(false)).toBe("verify_email");
    expect(resolveAuthNextStep({ isEmailVerified: false })).toBe("verify_email");
  });

  it("sends creator-web verified users to apply", () => {
    expect(registerNextStep(true)).toBe("apply");
    expect(
      resolveAuthNextStep({
        isEmailVerified: true,
        source: "creators_web",
      })
    ).toBe("apply");
  });

  it("sends pending / active / banned artists to the right desk", () => {
    expect(
      resolveAuthNextStep({
        isEmailVerified: true,
        artistStatus: "pending",
      })
    ).toBe("wait_review");
    expect(
      resolveAuthNextStep({
        isEmailVerified: true,
        artistStatus: "active",
      })
    ).toBe("studio");
    expect(
      resolveAuthNextStep({
        isEmailVerified: true,
        isBanned: true,
      })
    ).toBe("contact_support");
    expect(
      resolveAuthNextStep({
        isEmailVerified: true,
        artistStatus: "rejected",
      })
    ).toBe("apply");
  });
});

