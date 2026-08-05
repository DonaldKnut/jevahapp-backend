/**
 * Regression cover for the 2026-08-05 outage: every browser request returned
 * 500 because the origin callback was invoked with an Error.
 */
describe("CORS policy", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  function loadPolicy(env: Record<string, string | undefined> = {}) {
    Object.assign(process.env, env);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("../cors.config");
  }

  describe("isOriginAllowed with no env configured in production", () => {
    const productionEnv = {
      NODE_ENV: "production",
      ALLOWED_ORIGINS: undefined,
      FRONTEND_URL: undefined,
      ALLOW_DEV_CORS: undefined,
    };

    it.each([
      ["https://www.jevahapp.com"],
      ["https://jevahapp.com"],
      ["https://admin.jevahapp.com"],
    ])("allows product origin %s", origin => {
      const { isOriginAllowed } = loadPolicy(productionEnv);
      expect(isOriginAllowed(origin)).toBe(true);
    });

    it("allows requests with no Origin (curl, native mobile)", () => {
      const { isOriginAllowed } = loadPolicy(productionEnv);
      expect(isOriginAllowed(undefined)).toBe(true);
    });

    it("denies an unknown origin instead of throwing", () => {
      const { isOriginAllowed } = loadPolicy(productionEnv);
      expect(isOriginAllowed("https://example.com")).toBe(false);
    });
  });

  it("allows local Vite dev origin", () => {
    const { isOriginAllowed } = loadPolicy({ NODE_ENV: "development" });
    expect(isOriginAllowed("http://localhost:5173")).toBe(true);
  });

  it("honours ALLOWED_ORIGINS entries", () => {
    const { isOriginAllowed } = loadPolicy({
      NODE_ENV: "production",
      ALLOWED_ORIGINS: "https://partner.example.org , https://other.test",
    });
    expect(isOriginAllowed("https://partner.example.org")).toBe(true);
    expect(isOriginAllowed("https://other.test")).toBe(true);
  });

  describe("corsOptions.origin callback", () => {
    it("never passes an Error for a denied origin", () => {
      const { corsOptions } = loadPolicy({
        NODE_ENV: "production",
        ALLOW_DEV_CORS: undefined,
      });
      const callback = jest.fn();

      (corsOptions.origin as any)("https://example.com", callback);

      expect(callback).toHaveBeenCalledWith(null, false);
      expect(callback.mock.calls[0][0]).toBeNull();
    });

    it("allows a product origin", () => {
      const { corsOptions } = loadPolicy({ NODE_ENV: "production" });
      const callback = jest.fn();

      (corsOptions.origin as any)("https://www.jevahapp.com", callback);

      expect(callback).toHaveBeenCalledWith(null, true);
    });

    it("answers preflight with 204", () => {
      const { corsOptions } = loadPolicy({ NODE_ENV: "production" });
      expect(corsOptions.optionsSuccessStatus).toBe(204);
    });
  });
});
