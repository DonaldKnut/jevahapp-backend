import { ClientSession } from "mongoose";
import { Media } from "../../../models/media.model";
import { Devotional } from "../../../models/devotional.model";
import { normalizeContentType } from "../shared/contentType.resolver";

const FLOOR_COMMENT = [
  {
    $set: {
      commentCount: {
        $max: [0, { $subtract: [{ $ifNull: ["$commentCount", 0] }, 1] }],
      },
    },
  },
];

export async function bumpCommentCount(
  contentId: string,
  contentType: string,
  delta: number,
  session?: ClientSession
) {
  const normalized = normalizeContentType(contentType);
  const opts = session ? { session } : {};
  if (delta < 0) {
    if (normalized === "media") {
      await Media.findByIdAndUpdate(contentId, FLOOR_COMMENT, opts);
    } else if (normalized === "devotional") {
      await Devotional.findByIdAndUpdate(contentId, FLOOR_COMMENT, opts);
    }
    return;
  }
  if (normalized === "media") {
    await Media.findByIdAndUpdate(contentId, { $inc: { commentCount: delta } }, opts);
  } else if (normalized === "devotional") {
    await Devotional.findByIdAndUpdate(contentId, { $inc: { commentCount: delta } }, opts);
  }
}
