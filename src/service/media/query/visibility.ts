import { Types } from "mongoose";
import { publicCatalogFilter } from "../../../lib/publicMediaVisibility";

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
        publicCatalogFilter(),
        { uploadedBy: new Types.ObjectId(options.actingUserId) },
      ],
    };
  }

  return publicCatalogFilter();
}
