import {
  buildArtistOnboardEmailHtml,
  interpolateCreatorTokens,
  resolveCreatorFirstName,
  resolveCreatorWelcomeSubject,
  artistOnboardCtaUrl,
  DEFAULT_STUDIO_URL,
} from "../artistOnboardEmail";

const FORBIDDEN = [
  "Copyright-free",
  "Artists catalog",
  "creator hub",
  "intent → upload",
  "intent -> upload",
  "finalize",
  "Music → Artists",
  "Music -> Artists",
  "upload-intent",
  "PATCH /",
];

describe("creator_welcome_v1", () => {
  it("resolves firstName from user, then display name, then friend", () => {
    expect(resolveCreatorFirstName({ firstName: "Ibrahim Musa" })).toBe(
      "Ibrahim"
    );
    expect(resolveCreatorFirstName({ displayName: "Pastor Adeboye" })).toBe(
      "Pastor"
    );
    expect(resolveCreatorFirstName({})).toBe("friend");
  });

  it("defaults subject and interpolates {{firstName}}", () => {
    expect(resolveCreatorWelcomeSubject(undefined, "Ibrahim")).toBe(
      "Welcome to Jevah, Ibrahim"
    );
    expect(
      resolveCreatorWelcomeSubject("Welcome to Jevah, {{firstName}}", "Ada")
    ).toBe("Welcome to Jevah, Ada");
    expect(
      resolveCreatorWelcomeSubject("Welcome to Jevah, Ibrahim", "Ada")
    ).toBe("Welcome to Jevah, Ibrahim");
  });

  it("interpolates notes per recipient", () => {
    expect(
      interpolateCreatorTokens("Studio is ready, {{firstName}}.", "Ibrahim")
    ).toBe("Studio is ready, Ibrahim.");
  });

  it("points Open Studio at the web Studio URL", () => {
    expect(artistOnboardCtaUrl()).toEqual({
      url: DEFAULT_STUDIO_URL,
      label: "Open Studio",
    });
  });

  it("renders the official letter without engineering copy", () => {
    const html = buildArtistOnboardEmailHtml({
      firstName: "Ibrahim",
    });

    expect(html).toContain("Hi Ibrahim");
    expect(html).toContain("Welcome to Jevah. We’re glad you’re here.");
    expect(html).toContain("Open Studio");
    expect(html).toContain(DEFAULT_STUDIO_URL);
    expect(html).toContain("Create. Connect. Inspire.");
    expect(html).toContain("The Jevah Team");
    expect(html).toContain(
      "https://res.cloudinary.com/bt01nio6/image/upload/v1790381597/jevahha-removebg-preview.png"
    );
    expect(html).not.toMatch(/unsubscribe/i);

    for (const phrase of FORBIDDEN) {
      expect(html.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
  });

  it("omits the optional note when empty and shows it when set", () => {
    const without = buildArtistOnboardEmailHtml({ firstName: "Ibrahim" });
    expect(without).not.toContain("add your first song");

    const withNote = buildArtistOnboardEmailHtml({
      firstName: "Ibrahim",
      optionalNote: "Studio is ready — add your first song when you want.",
    });
    expect(withNote).toContain(
      "Studio is ready — add your first song when you want."
    );
  });
});
