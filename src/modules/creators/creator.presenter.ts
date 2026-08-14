/**
 * Shared presenter for Artist / Creator profiles (DRY).
 * Single place for FE-facing shape + capability flags (Open/Closed for new nextSteps).
 */
export type CreatorType = "artist" | "minister" | "podcaster";
export type ArtistStatus = "pending" | "active" | "suspended";

export type CreatorNextStep =
  | "verify_email"
  | "apply"
  | "wait_review"
  | "upload_first_track"
  | "manage_catalog"
  | "contact_support";

export interface ArtistCard {
  id: string;
  userId: string | null;
  displayName: string;
  slug: string;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  location: string | null;
  genres: string[];
  creatorTypes: CreatorType[];
  isVerified: boolean;
  status: ArtistStatus;
  socials: Record<string, string>;
  applicationNote: string | null;
  createdAt: string | Date | null;
  updatedAt: string | Date | null;
  reviewedAt: string | Date | null;
  onboardEmailSentAt: string | Date | null;
  followers?: number;
  monthlyListeners?: number;
}

export interface CreatorCapabilities {
  canApply: boolean;
  canEditProfile: boolean;
  canUploadTracks: boolean;
  canPublishTracks: boolean;
  showPendingBanner: boolean;
  showCreatorHub: boolean;
  showPublicProfile: boolean;
  publicProfilePath: string | null;
  nextStep: CreatorNextStep;
  /** Human copy for banners / empty states */
  statusMessage: string;
  emailVerified: boolean;
  needsEmailVerification: boolean;
}

export function shapeArtistCard(doc: any): ArtistCard {
  return {
    id: doc._id?.toString?.() || doc.id,
    userId: doc.userId?.toString?.() || doc.userId || null,
    displayName: doc.displayName,
    slug: doc.slug,
    bio: doc.bio || null,
    avatarUrl: doc.avatarUrl || null,
    bannerUrl: doc.bannerUrl || null,
    location: doc.location || null,
    genres: doc.genres || [],
    creatorTypes: (doc.creatorTypes || ["artist"]) as CreatorType[],
    isVerified: Boolean(doc.isVerified),
    status: (doc.status || "pending") as ArtistStatus,
    socials: doc.socials || {},
    applicationNote: doc.applicationNote || null,
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
    reviewedAt: doc.reviewedAt || null,
    onboardEmailSentAt: doc.onboardEmailSentAt || null,
  };
}

export function buildCreatorCapabilities(
  artist: ArtistCard | null,
  opts: { trackCount?: number; emailVerified?: boolean } = {}
): CreatorCapabilities {
  const emailVerified = opts.emailVerified !== false;

  if (!emailVerified) {
    return {
      canApply: false,
      canEditProfile: false,
      canUploadTracks: false,
      canPublishTracks: false,
      showPendingBanner: false,
      showCreatorHub: Boolean(artist),
      showPublicProfile: false,
      publicProfilePath: null,
      nextStep: "verify_email",
      statusMessage:
        "Verify your email to apply as a creator and receive studio updates. Check your inbox or resend the verification code.",
      emailVerified: false,
      needsEmailVerification: true,
    };
  }

  if (!artist) {
    return {
      canApply: true,
      canEditProfile: false,
      canUploadTracks: false,
      canPublishTracks: false,
      showPendingBanner: false,
      showCreatorHub: false,
      showPublicProfile: false,
      publicProfilePath: null,
      nextStep: "apply",
      statusMessage: "Apply to share gospel music, sermons beds, or podcasts on Jevah.",
      emailVerified: true,
      needsEmailVerification: false,
    };
  }

  if (artist.status === "pending") {
    return {
      canApply: false,
      canEditProfile: true,
      canUploadTracks: false,
      canPublishTracks: false,
      showPendingBanner: true,
      showCreatorHub: true,
      showPublicProfile: false,
      publicProfilePath: null,
      nextStep: "wait_review",
      statusMessage:
        "Your creator application is under review. We’ll notify you when you’re approved.",
      emailVerified: true,
      needsEmailVerification: false,
    };
  }

  if (artist.status === "suspended") {
    return {
      canApply: false,
      canEditProfile: false,
      canUploadTracks: false,
      canPublishTracks: false,
      showPendingBanner: false,
      showCreatorHub: true,
      showPublicProfile: false,
      publicProfilePath: null,
      nextStep: "contact_support",
      statusMessage:
        "Your creator account is suspended. Contact support if you believe this is a mistake.",
      emailVerified: true,
      needsEmailVerification: false,
    };
  }

  const trackCount = opts.trackCount ?? 0;
  const publicPath = `/artists/${artist.slug}`;
  return {
    canApply: false,
    canEditProfile: true,
    canUploadTracks: true,
    canPublishTracks: true,
    showPendingBanner: false,
    showCreatorHub: true,
    showPublicProfile: true,
    publicProfilePath: publicPath,
    nextStep: trackCount > 0 ? "manage_catalog" : "upload_first_track",
    statusMessage: artist.isVerified
      ? "You’re a verified Jevah creator. Upload and publish to the artist catalog."
      : "You’re an active creator. Upload tracks — verification badge may follow.",
    emailVerified: true,
    needsEmailVerification: false,
  };
}

/** Full payload for mobile + web creator hub */
export function shapeCreatorMePayload(
  doc: any | null,
  opts: {
    trackCount?: number;
    emailVerified?: boolean;
    followers?: number;
    monthlyListeners?: number;
  } = {}
) {
  const artist = doc ? shapeArtistCard(doc) : null;
  if (artist) {
    if (opts.followers != null) artist.followers = opts.followers;
    if (opts.monthlyListeners != null) artist.monthlyListeners = opts.monthlyListeners;
  }
  const capabilities = buildCreatorCapabilities(artist, opts);
  return {
    artist,
    capabilities,
    status: artist?.status ?? null,
    canUpload: capabilities.canUploadTracks,
    nextStep: capabilities.nextStep,
    emailVerified: capabilities.emailVerified,
    needsEmailVerification: capabilities.needsEmailVerification,
  };
}
