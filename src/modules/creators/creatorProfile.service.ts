import { Types } from "mongoose";
import { Artist } from "../../models/artist.model";
import { CopyrightFreeSong } from "../../models/copyrightFreeSong.model";
import { User } from "../../models/user.model";
import { isAllowedCdnUrl } from "../../service/fileUpload.service";
import { TRACK_GENRES } from "../audio/track.constants";
import { shapeCreatorMePayload } from "./creator.presenter";
import { countArtistFollowers, uniqueListenersSince } from "./creatorAudience.service";

const ALLOWED_GENRES = new Set<string>(TRACK_GENRES);
const SOCIAL_KEYS = [
  "instagram",
  "youtube",
  "spotify",
  "twitter",
  "tiktok",
  "website",
] as const;

export class CreatorProfileError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string
  ) {
    super(message);
    this.name = "CreatorProfileError";
  }
}

function trimStr(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

function httpUrlOrHandle(v: string | null): string | null {
  if (!v) return null;
  if (v.startsWith("@")) return v.slice(0, 120);
  try {
    const u = new URL(v);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return v.slice(0, 300);
  } catch {
    return null;
  }
}

function requireCdnImageUrl(raw: unknown, field: "avatarUrl" | "bannerUrl"): string | undefined {
  if (typeof raw !== "string") return undefined;
  const url = raw.trim();
  if (!url) return undefined;
  if (!isAllowedCdnUrl(url)) {
    throw new CreatorProfileError(
      `${field} must be a Jevah CDN URL — use ${field === "avatarUrl" ? "avatar" : "banner"}/upload-intent`,
      400,
      "INVALID_IMAGE_URL"
    );
  }
  return url.slice(0, 500);
}

export async function loadCreatorMe(userId: string) {
  const user = await User.findById(userId)
    .select("isEmailVerified isBanned followers")
    .lean();
  if (!user) {
    throw new CreatorProfileError("Unauthorized", 401, "AUTHENTICATION_REQUIRED");
  }
  if ((user as any).isBanned) {
    throw new CreatorProfileError("Account is banned", 403, "ACCOUNT_BANNED");
  }

  const doc = await Artist.findOne({ userId }).lean();
  let trackCount = 0;
  let monthlyListeners = 0;
  if (doc) {
    const artistId = (doc as any)._id as Types.ObjectId;
    trackCount = await CopyrightFreeSong.countDocuments({
      artistId,
      lane: "artist",
    });
    monthlyListeners = await uniqueListenersSince(artistId, 28);
  }

  const followers = await countArtistFollowers(userId, (doc as any)?._id);

  return shapeCreatorMePayload(doc as any, {
    trackCount,
    emailVerified: Boolean((user as any).isEmailVerified),
    followers,
    monthlyListeners,
  });
}

export async function patchCreatorMe(userId: string, body: Record<string, unknown>) {
  const user = await User.findById(userId).select("isBanned isEmailVerified").lean();
  if (!user) {
    throw new CreatorProfileError("Unauthorized", 401, "AUTHENTICATION_REQUIRED");
  }
  if ((user as any).isBanned) {
    throw new CreatorProfileError("Account is banned", 403, "ACCOUNT_BANNED");
  }

  const artist = await Artist.findOne({ userId });
  if (!artist) {
    throw new CreatorProfileError(
      "No creator profile yet — apply first",
      404,
      "NOT_A_CREATOR"
    );
  }
  if (artist.status === "suspended") {
    throw new CreatorProfileError(
      "Creator account is suspended",
      403,
      "CREATOR_SUSPENDED"
    );
  }

  if (typeof body.displayName === "string" && body.displayName.trim().length >= 2) {
    artist.displayName = body.displayName.trim().slice(0, 80);
  }
  if (body.bio !== undefined) {
    artist.bio = trimStr(body.bio, 500);
  }
  if (body.location !== undefined) {
    artist.location = trimStr(body.location, 120);
  }
  const nextBanner = requireCdnImageUrl(body.bannerUrl, "bannerUrl");
  if (nextBanner) artist.bannerUrl = nextBanner;
  const nextAvatar = requireCdnImageUrl(body.avatarUrl, "avatarUrl");
  if (nextAvatar) artist.avatarUrl = nextAvatar;
  if (Array.isArray(body.genres)) {
    artist.genres = [
      ...new Set(
        body.genres
          .map((g: unknown) => String(g || "").trim().toLowerCase())
          .filter((g: string) => ALLOWED_GENRES.has(g))
      ),
    ];
  }
  if (body.socials && typeof body.socials === "object") {
    const src = body.socials as Record<string, unknown>;
    const next = { ...(artist.socials || {}) } as Record<string, string>;
    for (const key of SOCIAL_KEYS) {
      if (src[key] === undefined) continue;
      const v = httpUrlOrHandle(trimStr(src[key], 300));
      if (v) next[key] = v;
      else delete next[key];
    }
    artist.socials = next as any;
  }

  await artist.save();

  await User.findByIdAndUpdate(userId, {
    $set: {
      "artistProfile.artistName": artist.displayName,
      "artistProfile.bio": artist.bio,
      "artistProfile.genre": artist.genres,
      location: artist.location || undefined,
      ...(artist.avatarUrl
        ? { avatar: artist.avatarUrl, avatarUpload: artist.avatarUrl }
        : {}),
    },
  }).catch(() => undefined);

  return loadCreatorMe(userId);
}
