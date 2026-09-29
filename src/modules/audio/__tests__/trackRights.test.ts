import { parseArtistTrackRights } from "../trackRights";

describe("parseArtistTrackRights", () => {
  const base = { userId: "507f1f77bcf86cd799439011" };

  it("requires both checkboxes and a rights type", () => {
    expect(parseArtistTrackRights(base).ok).toBe(false);
    expect(
      parseArtistTrackRights({ ...base, rightsAttested: true }).ok
    ).toBe(false);
    expect(
      parseArtistTrackRights({
        ...base,
        rightsAttested: true,
        gospelAttested: true,
      }).ok
    ).toBe(false);
  });

  it("accepts original with both attestations", () => {
    const parsed = parseArtistTrackRights({
      ...base,
      rightsAttested: true,
      gospelAttested: true,
      rightsType: "original",
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.copyrightStatus).toBe("original");
      expect(parsed.attestation.policyVersion).toBe("jevah-rights-v1");
    }
  });

  it("requires a license note when rightsType is licensed", () => {
    const missing = parseArtistTrackRights({
      ...base,
      rightsAttested: true,
      gospelAttested: true,
      rightsType: "licensed",
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.code).toBe("LICENSE_NOTE_REQUIRED");

    const ok = parseArtistTrackRights({
      ...base,
      rightsAttested: true,
      gospelAttested: true,
      rightsType: "licensed",
      licenseNote: "Label license 2026",
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.copyrightStatus).toBe("licensed");
  });
});
