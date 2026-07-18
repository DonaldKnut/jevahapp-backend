import { Types } from "mongoose";

export interface BatchMetadataRequestItem {
  contentType: string;
  contentId: string;
}

/**
 * Canonical: { items: [{ contentType, contentId }] }
 * Legacy:   { contentIds: [...], contentType?: "media" }
 */
export function parseBatchMetadataBody(body: {
  items?: BatchMetadataRequestItem[];
  contentIds?: string[];
  contentType?: string;
}): BatchMetadataRequestItem[] | null {
  if (Array.isArray(body.items) && body.items.length > 0) {
    const parsed = body.items.filter(
      item =>
        item?.contentId &&
        item?.contentType &&
        Types.ObjectId.isValid(String(item.contentId))
    );
    return parsed.length > 0 ? parsed : null;
  }

  if (Array.isArray(body.contentIds) && body.contentIds.length > 0) {
    const contentType = body.contentType || "media";
    const parsed = body.contentIds
      .filter(id => Types.ObjectId.isValid(String(id)))
      .map(contentId => ({ contentId: String(contentId), contentType }));
    return parsed.length > 0 ? parsed : null;
  }

  return null;
}
