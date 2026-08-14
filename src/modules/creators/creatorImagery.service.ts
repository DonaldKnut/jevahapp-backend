import { Artist } from "../../models/artist.model";
import fileUploadService from "../../service/fileUpload.service";
import {
  ALLOWED_COVER_MIME,
  TRACK_COVER_MAX_BYTES,
  TRACK_PRESIGN_EXPIRES_SEC,
} from "../audio/track.constants";
import { CreatorProfileError } from "./creatorProfile.service";

function extFromMime(mime: string, fileName?: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  if (fileName && /\.(png|webp|jpe?g|gif)$/i.test(fileName)) {
    return fileName.split(".").pop()!.toLowerCase().replace("jpeg", "jpg");
  }
  return "jpg";
}

async function requireArtist(userId: string) {
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
  return artist;
}

export async function createArtistImageUploadIntent(input: {
  userId: string;
  kind: "avatar" | "banner";
  contentType?: string;
  fileName?: string;
  fileSizeBytes?: number;
}) {
  const artist = await requireArtist(input.userId);
  const mime = String(input.contentType || "image/jpeg").toLowerCase();
  if (!ALLOWED_COVER_MIME.has(mime)) {
    throw new CreatorProfileError(
      "Unsupported image type",
      400,
      "INVALID_CONTENT_TYPE"
    );
  }
  const size = Number(input.fileSizeBytes || 0);
  if (size > TRACK_COVER_MAX_BYTES) {
    throw new CreatorProfileError(
      `Image exceeds ${TRACK_COVER_MAX_BYTES / (1024 * 1024)}MB limit`,
      400,
      "COVER_TOO_LARGE"
    );
  }
  const ext = extFromMime(mime, input.fileName);
  const key = `artists/${artist._id.toString()}/${input.kind}.${ext}`;
  const putUrl = await fileUploadService.getPresignedPutUrl(
    key,
    mime,
    size > 0 ? size : undefined,
    TRACK_PRESIGN_EXPIRES_SEC
  );

  if (input.kind === "avatar") artist.avatarPendingKey = key;
  else artist.bannerPendingKey = key;
  await artist.save();

  return {
    kind: input.kind,
    putUrl,
    key,
    headers: { "Content-Type": mime },
    expiresInSeconds: TRACK_PRESIGN_EXPIRES_SEC,
  };
}

export async function finalizeArtistImage(input: {
  userId: string;
  kind: "avatar" | "banner";
}) {
  const artist = await requireArtist(input.userId);
  const key =
    input.kind === "avatar" ? artist.avatarPendingKey : artist.bannerPendingKey;
  if (!key) {
    throw new CreatorProfileError(
      `No ${input.kind} upload intent — call ${input.kind}/upload-intent first`,
      400,
      "OBJECT_MISSING"
    );
  }
  try {
    await fileUploadService.headObject(key);
  } catch {
    throw new CreatorProfileError(
      "Image object missing in storage — complete the presigned PUT first",
      400,
      "OBJECT_MISSING"
    );
  }
  const url = fileUploadService.generatePublicUrl(key);
  if (input.kind === "avatar") {
    artist.avatarUrl = url;
    artist.avatarPendingKey = null;
  } else {
    artist.bannerUrl = url;
    artist.bannerPendingKey = null;
  }
  await artist.save();
  return {
    kind: input.kind,
    url,
    avatarUrl: artist.avatarUrl || null,
    bannerUrl: artist.bannerUrl || null,
  };
}
