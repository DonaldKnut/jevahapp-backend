import {
  qualifiesCopyrightFreeView,
  isTransactionUnsupportedError,
} from "../copyright-free/view";

describe("copyright-free view helpers", () => {
  it("qualifies at 3s OR 25% OR complete", () => {
    expect(
      qualifiesCopyrightFreeView({ durationMs: 3101, progressPct: 1 })
    ).toBe(true);
    expect(
      qualifiesCopyrightFreeView({ durationMs: 500, progressPct: 25 })
    ).toBe(true);
    expect(
      qualifiesCopyrightFreeView({
        durationMs: 500,
        progressPct: 1,
        isComplete: true,
      })
    ).toBe(true);
    expect(
      qualifiesCopyrightFreeView({ durationMs: 500, progressPct: 1 })
    ).toBe(false);
  });

  it("treats readPreference transaction errors as unsupported", () => {
    expect(
      isTransactionUnsupportedError({
        message:
          "Read preference in a transaction must be primary, not: primaryPreferred",
      })
    ).toBe(true);
  });
});
