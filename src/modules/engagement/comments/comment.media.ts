import {
  ensurePublicR2Url,
  objectKeyFromPublicUrl,
} from "../../../service/fileUpload.service";
import fileUploadService from "../../../service/fileUpload.service";
import logger from "../../../utils/logger";

/** Heal avatar fields for API responses (legacy missing `jevah/` prefix). */
export function healAvatarUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return ensurePublicR2Url(url);
}

export function withHealedAvatars<T extends Record<string, any>>(user: T): T {
  if (!user) return user;
  const avatar = healAvatarUrl(user.avatar || user.avatarUpload);
  return {
    ...user,
    avatar,
    avatarUpload: healAvatarUrl(user.avatarUpload) || avatar,
  };
}

/** Best-effort delete of a comment image from R2 (never blocks soft-delete). */
export async function deleteCommentImageFromR2(
  imageUrl: string | null | undefined
): Promise<void> {
  if (!imageUrl) return;
  const key = objectKeyFromPublicUrl(imageUrl);
  if (!key) return;
  try {
    await fileUploadService.deleteMedia(key);
    logger.info("Deleted comment image from R2", { key });
  } catch (err: any) {
    logger.warn("Failed to delete comment image from R2", {
      key,
      error: err?.message,
    });
  }
}
