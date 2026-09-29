/** Bump when legal copy changes so stored attestations stay dated. */
export const ARTIST_UPLOAD_POLICY_VERSION = "jevah-rights-v1";

export const ARTIST_RIGHTS_COPY =
  "I confirm I wrote, performed, or hold a license to distribute this recording on Jevah. I will not upload another artist’s song.";

export const ARTIST_GOSPEL_COPY =
  "I confirm this recording is worship, Scripture, or teaching centered on Jesus Christ.";

export const ARTIST_RIGHTS_TYPES = [
  "original",
  "licensed",
  "public_domain",
] as const;

export type ArtistRightsType = (typeof ARTIST_RIGHTS_TYPES)[number];

export type ArtistTrackAttestation = {
  rightsAttested: true;
  gospelAttested: true;
  rightsType: ArtistRightsType;
  policyVersion: string;
  attestedAt: Date;
  attestedByUserId: string;
  licenseNote: string | null;
};

export type ArtistRightsParseError = {
  ok: false;
  status: 400;
  code:
    | "RIGHTS_ATTESTATION_REQUIRED"
    | "GOSPEL_ATTESTATION_REQUIRED"
    | "INVALID_RIGHTS_TYPE"
    | "LICENSE_NOTE_REQUIRED";
  message: string;
};

export type ArtistRightsParseOk = {
  ok: true;
  copyrightStatus: "original" | "licensed" | "copyright_free";
  licenseNote: string | null;
  attestation: ArtistTrackAttestation;
};

export function artistUploadPolicy() {
  return {
    version: ARTIST_UPLOAD_POLICY_VERSION,
    rightsCopy: ARTIST_RIGHTS_COPY,
    gospelCopy: ARTIST_GOSPEL_COPY,
    rightsTypes: [...ARTIST_RIGHTS_TYPES],
    required: ["rightsAttested", "gospelAttested", "rightsType"] as const,
  };
}

function isTruthyFlag(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

function copyrightStatusFromRights(
  rightsType: ArtistRightsType
): "original" | "licensed" | "copyright_free" {
  if (rightsType === "licensed") return "licensed";
  if (rightsType === "public_domain") return "copyright_free";
  return "original";
}

export function parseArtistTrackRights(input: {
  userId: string;
  rightsAttested?: unknown;
  gospelAttested?: unknown;
  rightsType?: unknown;
  licenseNote?: unknown;
}): ArtistRightsParseOk | ArtistRightsParseError {
  if (!isTruthyFlag(input.rightsAttested)) {
    return {
      ok: false,
      status: 400,
      code: "RIGHTS_ATTESTATION_REQUIRED",
      message: `${ARTIST_RIGHTS_COPY} Check the rights box to continue.`,
    };
  }
  if (!isTruthyFlag(input.gospelAttested)) {
    return {
      ok: false,
      status: 400,
      code: "GOSPEL_ATTESTATION_REQUIRED",
      message: `${ARTIST_GOSPEL_COPY} Check the gospel box to continue.`,
    };
  }

  const rawType = String(input.rightsType || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  const rightsType = ARTIST_RIGHTS_TYPES.find(t => t === rawType);
  if (!rightsType) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_RIGHTS_TYPE",
      message:
        "Choose how you have the right to upload: original, licensed, or public_domain.",
    };
  }

  const licenseNote =
    typeof input.licenseNote === "string" && input.licenseNote.trim()
      ? input.licenseNote.trim().slice(0, 500)
      : null;

  if (rightsType === "licensed" && !licenseNote) {
    return {
      ok: false,
      status: 400,
      code: "LICENSE_NOTE_REQUIRED",
      message:
        "Licensed uploads need a short note (who licensed it, or the license name).",
    };
  }

  return {
    ok: true,
    copyrightStatus: copyrightStatusFromRights(rightsType),
    licenseNote,
    attestation: {
      rightsAttested: true,
      gospelAttested: true,
      rightsType,
      policyVersion: ARTIST_UPLOAD_POLICY_VERSION,
      attestedAt: new Date(),
      attestedByUserId: input.userId,
      licenseNote,
    },
  };
}
