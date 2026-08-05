/**
 * Guardian client circuit / config smoke (no live server required).
 */
import {
  isGuardianConfigured,
  isGuardianCircuitOpen,
} from "../guardianClient";

describe("guardianClient config", () => {
  const prev = process.env.CONTENT_GUARDIAN_URL;

  afterEach(() => {
    if (prev === undefined) delete process.env.CONTENT_GUARDIAN_URL;
    else process.env.CONTENT_GUARDIAN_URL = prev;
  });

  it("reports not configured when URL missing", () => {
    delete process.env.CONTENT_GUARDIAN_URL;
    expect(isGuardianConfigured()).toBe(false);
  });

  it("reports configured when URL set", () => {
    process.env.CONTENT_GUARDIAN_URL = "http://127.0.0.1:8091";
    expect(isGuardianConfigured()).toBe(true);
  });

  it("circuit starts closed", () => {
    expect(isGuardianCircuitOpen()).toBe(false);
  });
});
