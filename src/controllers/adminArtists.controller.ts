import { Request, Response } from "express";
import { Types } from "mongoose";
import { Artist, slugifyArtistName } from "../models/artist.model";
import { User } from "../models/user.model";
import { CopyrightFreeSong } from "../models/copyrightFreeSong.model";
import { AuditService } from "../service/audit.service";
import {
  shapeArtistCard,
  shapeCreatorMePayload,
} from "../modules/creators/creator.presenter";
import { TRACK_GENRES } from "../modules/audio/track.constants";
import logger from "../utils/logger";

const CREATOR_TYPES = new Set(["artist", "minister", "podcaster"]);
const ALLOWED_GENRES = new Set<string>(TRACK_GENRES);

function shapeArtist(doc: any) {
  return shapeArtistCard(doc);
}

function trimStr(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

function normalizeSocials(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const src = raw as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const key of ["instagram", "youtube", "spotify", "twitter"] as const) {
    const v = trimStr(src[key], 200);
    if (v) out[key] = v;
  }
  return out;
}

/** Spotify-for-Artists style apply validation (mirrors FE Zod). */
function validateCreatorApply(body: any): {
  ok: true;
  data: {
    displayName: string;
    creatorTypes: string[];
    genres: string[];
    bio: string | null;
    socials: Record<string, string>;
    avatarUrl: string | null;
    applicationNote: string | null;
  };
} | {
  ok: false;
  fieldErrors: Record<string, string>;
  message: string;
} {
  const fieldErrors: Record<string, string> = {};

  const displayName = trimStr(body?.displayName, 80);
  if (!displayName || displayName.length < 2) {
    fieldErrors.displayName = "Display name must be 2–80 characters";
  }

  const rawTypes = Array.isArray(body?.creatorTypes) ? body.creatorTypes : [];
  const creatorTypes = [
    ...new Set(
      rawTypes
        .map((t: unknown) => String(t || "").trim().toLowerCase())
        .filter((t: string) => CREATOR_TYPES.has(t))
    ),
  ];
  if (creatorTypes.length < 1) {
    fieldErrors.creatorTypes = "Select at least one creator type";
  }

  const rawGenres = Array.isArray(body?.genres) ? body.genres : [];
  const genres = [
    ...new Set(
      rawGenres
        .map((g: unknown) => String(g || "").trim().toLowerCase())
        .filter((g: string) => ALLOWED_GENRES.has(g))
    ),
  ];
  if (genres.length < 1) {
    fieldErrors.genres = `Select at least one genre (${TRACK_GENRES.join(", ")})`;
  }

  const bio = trimStr(body?.bio, 500);
  const applicationNote = trimStr(body?.applicationNote, 1000);
  let avatarUrl = trimStr(body?.avatarUrl, 500);
  if (avatarUrl && !/^https?:\/\//i.test(avatarUrl)) {
    fieldErrors.avatarUrl = "Avatar URL must start with http:// or https://";
    avatarUrl = null;
  }

  if (Object.keys(fieldErrors).length) {
    return {
      ok: false,
      fieldErrors,
      message: Object.values(fieldErrors)[0],
    };
  }

  return {
    ok: true,
    data: {
      displayName: displayName!,
      creatorTypes,
      genres,
      bio,
      socials: normalizeSocials(body?.socials),
      avatarUrl,
      applicationNote,
    },
  };
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = slugifyArtistName(base);
  let n = 0;
  while (await Artist.exists({ slug })) {
    n += 1;
    slug = `${slugifyArtistName(base)}-${n}`;
  }
  return slug;
}

/**
 * GET /api/admin/artists
 */
export const listAdminArtists = async (req: Request, res: Response) => {
  try {
    const page = Math.max(parseInt(String(req.query.page || "1"), 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit || "20"), 10) || 20, 1),
      100
    );
    const status = String(req.query.status || "").trim();
    const search = String(req.query.search || "").trim();
    const query: Record<string, unknown> = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { displayName: new RegExp(search, "i") },
        { slug: new RegExp(search, "i") },
      ];
    }
    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      Artist.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Artist.countDocuments(query),
    ]);
    res.status(200).json({
      success: true,
      data: {
        items: rows.map(shapeArtist),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (error: any) {
    logger.error("List artists error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to list artists" });
  }
};

/**
 * POST /api/admin/artists — register / stub artist (admin)
 */
export const createAdminArtist = async (req: Request, res: Response) => {
  try {
    const adminId = req.userId;
    const {
      displayName,
      userId,
      bio,
      genres,
      creatorTypes,
      socials,
      status,
      isVerified,
      avatarUrl,
    } = req.body || {};

    if (!displayName?.trim()) {
      res.status(400).json({ success: false, message: "displayName is required" });
      return;
    }

    if (userId && !Types.ObjectId.isValid(userId)) {
      res.status(400).json({ success: false, message: "Invalid userId" });
      return;
    }

    const slug = await uniqueSlug(displayName);
    const doc = await Artist.create({
      displayName: displayName.trim(),
      slug,
      userId: userId || null,
      bio: bio || null,
      genres: Array.isArray(genres) ? genres : [],
      creatorTypes: Array.isArray(creatorTypes) ? creatorTypes : ["artist"],
      socials: socials || {},
      status: status || "active",
      isVerified: Boolean(isVerified),
      avatarUrl: avatarUrl || null,
      reviewedByAdminId: adminId || null,
      reviewedAt: new Date(),
    });

    if (userId && (status === "active" || !status)) {
      await User.findByIdAndUpdate(userId, {
        $set: {
          role: "artist",
          isVerifiedArtist: Boolean(isVerified),
          "artistProfile.artistName": displayName.trim(),
          "artistProfile.isVerifiedArtist": Boolean(isVerified),
        },
      });
    }

    if (adminId) {
      await AuditService.logAdminAction(adminId, "create_artist", doc._id.toString(), {
        displayName,
        status: doc.status,
      });
    }

    res.status(201).json({ success: true, data: shapeArtist(doc) });
  } catch (error: any) {
    logger.error("Create artist error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to create artist" });
  }
};

/**
 * PATCH /api/admin/artists/:id
 */
export const patchAdminArtist = async (req: Request, res: Response) => {
  try {
    const adminId = req.userId;
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid artist id" });
      return;
    }
    const artist = await Artist.findById(id);
    if (!artist) {
      res.status(404).json({ success: false, message: "Artist not found" });
      return;
    }

    const body = req.body || {};
    if (typeof body.displayName === "string" && body.displayName.trim()) {
      artist.displayName = body.displayName.trim();
    }
    if (typeof body.bio === "string") artist.bio = body.bio;
    if (typeof body.avatarUrl === "string") artist.avatarUrl = body.avatarUrl;
    if (Array.isArray(body.genres)) artist.genres = body.genres;
    if (Array.isArray(body.creatorTypes)) artist.creatorTypes = body.creatorTypes;
    if (body.socials && typeof body.socials === "object") {
      artist.socials = { ...(artist.socials || {}), ...body.socials };
    }
    if (typeof body.isVerified === "boolean") {
      artist.isVerified = body.isVerified;
    }
    if (["pending", "active", "suspended"].includes(body.status)) {
      artist.status = body.status;
      artist.reviewedByAdminId = adminId
        ? new Types.ObjectId(adminId)
        : artist.reviewedByAdminId;
      artist.reviewedAt = new Date();
    }

    await artist.save();

    if (artist.userId && (body.status === "active" || body.isVerified != null)) {
      const userPatch: Record<string, unknown> = {
        isVerifiedArtist: artist.isVerified,
        "artistProfile.artistName": artist.displayName,
        "artistProfile.isVerifiedArtist": artist.isVerified,
      };
      if (artist.status === "active") {
        userPatch.role = "artist";
      }
      await User.findByIdAndUpdate(artist.userId, { $set: userPatch });
    }

    let onboardEmail: Record<string, unknown> | undefined;
    const shouldSendOnboard =
      body.sendOnboardEmail === true || body.sendOnboardEmail === "true";
    if (shouldSendOnboard && artist.userId) {
      const { sendArtistOnboardCampaign } = await import(
        "../service/artistOnboardEmail.service"
      );
      if (!adminId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }
      onboardEmail = await sendArtistOnboardCampaign({
        adminId,
        segment: "artistIds",
        artistIds: [id],
        message:
          typeof body.onboardMessage === "string"
            ? body.onboardMessage
            : undefined,
        subject:
          typeof body.onboardSubject === "string"
            ? body.onboardSubject
            : undefined,
        dryRun: false,
      });
      artist.onboardEmailSentAt = new Date();
    }

    if (adminId) {
      await AuditService.logAdminAction(adminId, "update_artist", id, {
        status: artist.status,
        isVerified: artist.isVerified,
        sendOnboardEmail: shouldSendOnboard,
      });
    }

    const justActivated = body.status === "active";
    const needsOnboardReminder =
      justActivated && !artist.onboardEmailSentAt && !shouldSendOnboard;

    res.status(200).json({
      success: true,
      data: shapeArtist(artist),
      ...(onboardEmail ? { onboardEmail } : {}),
      ...(needsOnboardReminder
        ? {
            reminders: [
              {
                id: "send_artist_onboard_email",
                severity: "high",
                title: "Send onboard email",
                message:
                  "Artist activated. Send them the creator onboard email so they know how to upload to Music → Artists.",
                action: {
                  method: "POST",
                  path: "/api/admin/email/artist-onboard",
                  bodyHint: {
                    segment: "artistIds",
                    artistIds: [id],
                    dryRun: false,
                  },
                },
              },
            ],
          }
        : {}),
    });
  } catch (error: any) {
    logger.error("Patch artist error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to update artist" });
  }
};

/**
 * PATCH /api/admin/artists/:id/verification
 */
export const verifyAdminArtist = async (req: Request, res: Response) => {
  req.body = { ...(req.body || {}), isVerified: Boolean(req.body?.isVerified) };
  if (req.body.isVerified === true && !req.body.status) {
    req.body.status = "active";
  }
  return patchAdminArtist(req, res);
};

/**
 * POST /api/creators/apply — authenticated user applies to become artist/minister/podcaster
 */
export const applyAsCreator = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const existing = await Artist.findOne({ userId });
    if (existing) {
      const trackCount = await CopyrightFreeSong.countDocuments({
        artistId: existing._id,
        lane: "artist",
      });
      res.status(200).json({
        success: true,
        data: shapeCreatorMePayload(existing, { trackCount }),
        message: "Application already exists",
      });
      return;
    }

    const parsed = validateCreatorApply(req.body || {});
    if (!parsed.ok) {
      res.status(400).json({
        success: false,
        message: parsed.message,
        code: "VALIDATION_ERROR",
        fieldErrors: parsed.fieldErrors,
      });
      return;
    }

    const { displayName, creatorTypes, genres, bio, socials, avatarUrl, applicationNote } =
      parsed.data;

    const slug = await uniqueSlug(displayName);
    const doc = await Artist.create({
      userId,
      displayName,
      slug,
      bio,
      genres,
      creatorTypes,
      socials,
      applicationNote,
      avatarUrl,
      status: "pending",
      isVerified: false,
    });

    res.status(201).json({
      success: true,
      data: shapeCreatorMePayload(doc, { trackCount: 0 }),
      message:
        "Application received. You can upload to the artist catalog after an admin activates your profile.",
    });
  } catch (error: any) {
    logger.error("Creator apply error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to submit application" });
  }
};

/**
 * GET /api/creators/me — current user's artist/creator application
 */
export const getMyCreatorProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const doc = await Artist.findOne({ userId }).lean();
    let trackCount = 0;
    if (doc) {
      trackCount = await CopyrightFreeSong.countDocuments({
        artistId: (doc as any)._id,
        lane: "artist",
      });
    }
    res.status(200).json({
      success: true,
      data: shapeCreatorMePayload(doc as any, { trackCount }),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Failed to load creator profile" });
  }
};
