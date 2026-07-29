import { Types } from "mongoose";
import { commentRepository } from "./comment.repository";
import { sanitizeCommentContent, formatComment } from "./comment.formatter";
import { bumpCommentsVersion } from "./comment.version";
import {
  isAllowedImageUrl,
  MentionInput,
  parseMentionsInput,
  resolveMentions,
} from "./comment.mentions";
import { ensurePublicR2Url } from "../../../service/fileUpload.service";
import { CommentErrors } from "./comment.errors";
import { notifyMentions } from "./comment.notify";
import { deleteCommentImageFromR2 } from "./comment.media";
import { normalizeContentType } from "../shared/contentType.resolver";

/** Default 24h. Set COMMENT_EDIT_WINDOW_MS=0 for unlimited. */
export function getCommentEditWindowMs(): number {
  const raw = process.env.COMMENT_EDIT_WINDOW_MS;
  if (raw === undefined || raw === "") return 24 * 60 * 60 * 1000;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? Math.max(0, n) : 24 * 60 * 60 * 1000;
}

export type EditCommentOptions = {
  content?: string;
  imageUrl?: string;
  clearImage?: boolean;
  mentions?: MentionInput[];
};

export async function editComment(
  commentId: string,
  userId: string,
  options: EditCommentOptions
) {
  if (!Types.ObjectId.isValid(commentId) || !Types.ObjectId.isValid(userId)) {
    throw CommentErrors.invalidCommentId();
  }

  const comment = await commentRepository.findComment(commentId);
  if (!comment || comment.interactionType !== "comment") {
    throw CommentErrors.commentNotFound();
  }
  if (comment.user.toString() !== userId) {
    throw CommentErrors.forbidden();
  }

  const windowMs = getCommentEditWindowMs();
  if (windowMs > 0) {
    const created = new Date(comment.createdAt).getTime();
    if (Date.now() - created > windowMs) {
      throw CommentErrors.editWindowExpired(
        Math.max(1, Math.round(windowMs / (60 * 60 * 1000)))
      );
    }
  }

  const clearImage =
    options.clearImage === true ||
    String((options as any).clearImage || "").toLowerCase() === "true";

  const nextContent =
    options.content !== undefined
      ? sanitizeCommentContent(options.content || "").text
      : comment.content || "";

  let nextImageUrl: string | null | undefined = undefined;
  if (clearImage) {
    nextImageUrl = null;
  } else if (options.imageUrl !== undefined) {
    const raw = String(options.imageUrl || "").trim();
    if (!raw) {
      nextImageUrl = null;
    } else {
      const healed = ensurePublicR2Url(raw);
      if (!isAllowedImageUrl(healed)) throw CommentErrors.invalidImageUrl();
      nextImageUrl = healed;
    }
  }

  const finalImage =
    nextImageUrl === undefined ? comment.imageUrl || null : nextImageUrl;
  if (!nextContent?.trim() && !finalImage) {
    throw CommentErrors.contentRequired();
  }

  const previousImage = comment.imageUrl || null;
  const prevMentionIds = new Set(
    (comment.mentions || []).map((m: any) =>
      String(m.userId?._id || m.userId || "")
    )
  );

  let mentionsResolved: Awaited<ReturnType<typeof resolveMentions>> | undefined;
  if (options.mentions !== undefined) {
    mentionsResolved = await resolveMentions(options.mentions || []);
  }

  const patch: Record<string, unknown> = {
    content: nextContent,
    editedAt: new Date(),
  };
  if (typeof nextImageUrl === "string") {
    patch.imageUrl = nextImageUrl;
  }
  if (mentionsResolved) {
    patch.mentions = mentionsResolved;
  }

  await commentRepository.updateCommentFields(commentId, patch, {
    unsetImage: nextImageUrl === null,
  });
  bumpCommentsVersion(comment.media?.toString());

  if (
    previousImage &&
    (nextImageUrl === null ||
      (typeof nextImageUrl === "string" && nextImageUrl !== previousImage))
  ) {
    void deleteCommentImageFromR2(previousImage);
  }

  if (mentionsResolved?.length) {
    const fresh = mentionsResolved.filter(
      (m) => !prevMentionIds.has(m.userId.toString())
    );
    if (fresh.length) {
      const contentId = comment.media?.toString() || "";
      notifyMentions({
        userId,
        contentId,
        contentType: normalizeContentType("media"),
        commentId,
        text: nextContent,
        imageUrl: finalImage || undefined,
        mentions: fresh,
      });
    }
  }

  const updated = await commentRepository
    .findById(commentId)
    .populate("user", "firstName lastName avatar avatarUpload")
    .lean();
  return formatComment(updated);
}

export { parseMentionsInput };
