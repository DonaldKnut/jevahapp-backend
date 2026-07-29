import { commentRepository } from "./comment.repository";
import { ensurePublicR2Url } from "../../../service/fileUpload.service";
import logger from "../../../utils/logger";

/**
 * Persist healed imageUrls when list finds bare `/comments/` (or other missing prefix).
 * Fire-and-forget — never blocks the list response.
 */
export function persistHealedCommentImageUrls(
  docs: Array<{ _id?: any; imageUrl?: string }>
): void {
  for (const doc of docs) {
    if (!doc?.imageUrl || !doc._id) continue;
    const healed = ensurePublicR2Url(doc.imageUrl);
    if (healed === doc.imageUrl) continue;
    doc.imageUrl = healed;
    void commentRepository
      .updateCommentFields(String(doc._id), { imageUrl: healed })
      .catch((err: any) => {
        logger.warn("Failed to persist healed comment imageUrl", {
          id: String(doc._id),
          error: err?.message,
        });
      });
  }
}
