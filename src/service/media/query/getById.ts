import { Media } from "../../../models/media.model";
import { Types } from "mongoose";
import { enrichMediaPlaybackFields } from "../playbackFields";

export async function getMediaByIdentifier(mediaIdentifier: string, options: { actingUserId?: string; userRole?: string } = {}) {
  if (!Types.ObjectId.isValid(mediaIdentifier)) {
    throw new Error("Invalid media identifier");
  }

  const media = await Media.findById(mediaIdentifier)
    .select(
      "title description contentType category fileUrl playbackUrl hlsUrl thumbnailUrl coverImageUrl topics uploadedBy duration fileSize width height bitrate createdAt updatedAt isDownloadable downloadUrl shareUrl viewThreshold moderationStatus isHidden processing processingMetadata"
    )
    .populate("uploadedBy", "firstName lastName avatar");
  if (!media) {
    throw new Error("Media not found");
  }

  // Security check: If not approved and not admin/uploader, don't return media
  const uploaderId =
    (media.uploadedBy as any)?._id?.toString?.() ||
    (media.uploadedBy as any)?.id?.toString?.() ||
    (media.uploadedBy as any)?.toString?.();
  const isUploader =
    Boolean(options.actingUserId) &&
    Boolean(uploaderId) &&
    String(uploaderId) === String(options.actingUserId);
  const role = String(options.userRole || "").toLowerCase();
  const isAdmin = role === "admin" || role === "superadmin" || role === "super_admin";
  const isApproved = media.moderationStatus === "approved" && !media.isHidden;

  if (!isApproved && !isUploader && !isAdmin) {
    throw new Error("Media not found or under review");
  }

  // Transform to match spec: ensure imageUrl is returned (aliased from coverImageUrl)
  const mediaObj = media.toObject();
  return enrichMediaPlaybackFields({
    ...mediaObj,
    id: mediaObj._id, // Alias for _id
    imageUrl: mediaObj.coverImageUrl, // Alias coverImageUrl to imageUrl for spec compliance
  });
}

export async function getRecentMedia(limit: number) {
  const rows = await Media.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .select(
      "title contentType category createdAt thumbnailUrl fileUrl duration processing processingMetadata moderationStatus playbackUrl hlsUrl"
    )
    .populate("uploadedBy", "firstName lastName avatar")
    .lean();
  return rows.map((row: any) => enrichMediaPlaybackFields(row));
}
