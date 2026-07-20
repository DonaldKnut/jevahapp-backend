import { Types } from "mongoose";
import { PUBLIC_MEDIA_FILTER } from "../../../lib/publicMediaVisibility";

/** Build Mongo filter for public vs owner-visible media lists. */
export function buildMediaVisibilityQuery(options: {
  enforceModeration?: boolean;
  actingUserId?: string;
} = {}): Record<string, unknown> {
  const shouldEnforce = options.enforceModeration !== false;
  if (!shouldEnforce) return {};

  if (options.actingUserId) {
    return {
      $or: [
        { ...PUBLIC_MEDIA_FILTER },
        { uploadedBy: new Types.ObjectId(options.actingUserId) },
      ],
    };
  }

  return { ...PUBLIC_MEDIA_FILTER };
}
