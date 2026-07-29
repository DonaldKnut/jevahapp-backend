/**
 * Unit tests for public R2 URL helpers (CDN prefix + allowlist).
 */
describe("fileUpload R2 public URL helpers", () => {
  const keys = [
    "R2_PUBLIC_KEY_PREFIX",
    "R2_CUSTOM_DOMAIN",
    "R2_PUBLIC_DEV_URL",
    "R2_ALLOWED_CDN_HOSTS",
    "NODE_ENV",
  ] as const;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of keys) saved[k] = process.env[k];
    jest.resetModules();
  });

  afterEach(() => {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  function load() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("../../../service/fileUpload.service") as typeof import("../../../service/fileUpload.service");
  }

  it("toPublicR2Url prefixes jevah on r2.dev when prefix unset", () => {
    delete process.env.R2_PUBLIC_KEY_PREFIX;
    delete process.env.R2_CUSTOM_DOMAIN;
    process.env.NODE_ENV = "development";
    process.env.R2_PUBLIC_DEV_URL =
      "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev";

    const { toPublicR2Url, getR2PublicKeyPrefix } = load();
    expect(getR2PublicKeyPrefix()).toBe("jevah");
    expect(toPublicR2Url("comments/x.jpg")).toBe(
      "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/comments/x.jpg"
    );
  });

  it("custom domain defaults to no prefix (avoid double-break prod)", () => {
    delete process.env.R2_PUBLIC_KEY_PREFIX;
    process.env.R2_CUSTOM_DOMAIN = "media.jevahapp.com";
    process.env.NODE_ENV = "production";

    const { toPublicR2Url, getR2PublicKeyPrefix } = load();
    expect(getR2PublicKeyPrefix()).toBe("");
    expect(toPublicR2Url("comments/x.jpg")).toBe(
      "https://media.jevahapp.com/comments/x.jpg"
    );
  });

  it("explicit empty R2_PUBLIC_KEY_PREFIX disables prefix", () => {
    process.env.R2_PUBLIC_KEY_PREFIX = "";
    delete process.env.R2_CUSTOM_DOMAIN;
    process.env.NODE_ENV = "development";
    process.env.R2_PUBLIC_DEV_URL = "https://pub-test.r2.dev";

    const { toPublicR2Url } = load();
    expect(toPublicR2Url("comments/x.jpg")).toBe(
      "https://pub-test.r2.dev/comments/x.jpg"
    );
  });

  it("ensurePublicR2Url heals bare /comments/ on r2.dev", () => {
    delete process.env.R2_PUBLIC_KEY_PREFIX;
    delete process.env.R2_CUSTOM_DOMAIN;
    process.env.NODE_ENV = "development";
    process.env.R2_PUBLIC_DEV_URL = "https://pub-test.r2.dev";

    const { ensurePublicR2Url } = load();
    expect(ensurePublicR2Url("https://pub-test.r2.dev/comments/a.jpg")).toBe(
      "https://pub-test.r2.dev/jevah/comments/a.jpg"
    );
  });

  it("isAllowedCdnUrl rejects arbitrary https hosts", () => {
    delete process.env.R2_PUBLIC_KEY_PREFIX;
    delete process.env.R2_CUSTOM_DOMAIN;
    process.env.NODE_ENV = "development";
    process.env.R2_PUBLIC_DEV_URL = "https://pub-test.r2.dev";

    const { isAllowedCdnUrl } = load();
    expect(isAllowedCdnUrl("https://evil.example/x.jpg")).toBe(false);
    expect(
      isAllowedCdnUrl("https://pub-test.r2.dev/jevah/comments/x.jpg")
    ).toBe(true);
    expect(isAllowedCdnUrl("https://other.r2.dev/anything")).toBe(true);
  });

  it("objectKeyFromPublicUrl strips public prefix", () => {
    process.env.R2_PUBLIC_KEY_PREFIX = "jevah";
    delete process.env.R2_CUSTOM_DOMAIN;
    process.env.NODE_ENV = "development";
    process.env.R2_PUBLIC_DEV_URL = "https://pub-test.r2.dev";

    const { objectKeyFromPublicUrl } = load();
    expect(
      objectKeyFromPublicUrl("https://pub-test.r2.dev/jevah/comments/x.jpg")
    ).toBe("comments/x.jpg");
  });
});
