import fs from "fs";
import os from "os";
import path from "path";
import { createHash } from "crypto";
import { Media } from "../models/media.model";
import { optimizedVerificationService } from "../service/optimizedVerification.service";
import {
  findReusableModerationDecision,
  applyReusedDecisionToMedia,
} from "../service/moderation/contentHashDedup";
import {
  reserveUserUploadForModeration,
} from "../service/moderation/aiBudget.service";
import logger from "../utils/logger";

async function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const input = fs.createReadStream(filePath);
    input.on("error", reject);
    input.on("data", chunk => hash.update(chunk));
    input.on("end", () => resolve(hash.digest("hex")));
  });
}

/**
 * Hash → optional decision reuse → evidence sample + moderate (once) → persist case.
 */
export async function processMediaModeration(params: {
  mediaId: string;
  userId: string;
  localFilePath: string;
  mimeType?: string;
}): Promise<{
  moderationStatus: string;
  contentHash: string;
  reused: boolean;
}> {
  const { mediaId, userId, localFilePath } = params;
  const media = await Media.findById(mediaId);
  if (!media) throw new Error("Media not found for moderation");

  await Media.findByIdAndUpdate(mediaId, {
    processing: {
      ...(media.processing as any),
      status: "moderating",
      updatedAt: new Date(),
      progress: 25,
    },
  });

  const contentHash = await sha256File(localFilePath);
  const declared = (media as any).uploadIntent?.checksum;
  if (declared && declared.toLowerCase() !== contentHash.toLowerCase()) {
    await Media.findByIdAndUpdate(mediaId, {
      moderationStatus: "rejected",
      isHidden: true,
      processing: {
        status: "rejected",
        error: "Checksum mismatch",
        updatedAt: new Date(),
        progress: 100,
      },
      contentHash,
    });
    throw new Error("Checksum mismatch against declared SHA-256");
  }

  await Media.findByIdAndUpdate(mediaId, { contentHash });

  const reused = await findReusableModerationDecision(contentHash);
  if (reused) {
    await applyReusedDecisionToMedia(mediaId, reused);
    logger.info("Reused moderation decision via contentHash", {
      mediaId,
      contentHash: contentHash.slice(0, 12),
    });
    const refreshed = await Media.findById(mediaId).select("moderationStatus");
    return {
      moderationStatus: refreshed?.moderationStatus || "under_review",
      contentHash,
      reused: true,
    };
  }

  if (!(await reserveUserUploadForModeration(userId))) {
    await Media.findByIdAndUpdate(mediaId, {
      moderationStatus: "under_review",
      isHidden: true,
      moderationResult: {
        isApproved: false,
        confidence: 0,
        reason: "Daily upload moderation allowance exceeded",
        flags: ["user_upload_budget"],
        requiresReview: true,
        moderatedAt: new Date(),
      },
    });
    return { moderationStatus: "under_review", contentHash, reused: false };
  }

  const mime =
    params.mimeType ||
    (media as any).fileMimeType ||
    (media as any).uploadIntent?.declaredMime ||
    "application/octet-stream";

  const isVideo =
    (media.contentType === "videos" || media.contentType === "sermon") &&
    mime.startsWith("video/");
  const result = isVideo
    ? await optimizedVerificationService.verifyVideoPathWithProgress(
        localFilePath,
        mime,
        media.contentType,
        media.title,
        media.description,
        mediaId,
        { mediaId, contentHash }
      )
    : await optimizedVerificationService.verifyContentWithProgress(
        fs.readFileSync(localFilePath),
        mime,
        media.contentType,
        media.title,
        media.description,
        mediaId,
        undefined,
        undefined,
        undefined,
        { mediaId, contentHash }
      );

  const moderationResult = result.moderationResult;
  const status = moderationResult.requiresReview
    ? "under_review"
    : moderationResult.isApproved
      ? "approved"
      : "rejected";

  await Media.findByIdAndUpdate(mediaId, {
    contentHash,
    moderationStatus: status,
    // Stay hidden until AssetPublisher flips publicationState=live
    isHidden: true,
    publicationState:
      status === "approved"
        ? "publishing"
        : status === "rejected"
          ? "tombstoned"
          : "staged",
    moderationResult: {
      isApproved: moderationResult.isApproved,
      confidence: moderationResult.confidence,
      reason: moderationResult.reason,
      flags: moderationResult.flags,
      requiresReview: moderationResult.requiresReview,
      moderatedAt: new Date(),
    },
    processing: {
      status: status === "rejected" ? "rejected" : "processing",
      updatedAt: new Date(),
      progress: 40,
    },
  });

  return { moderationStatus: status, contentHash, reused: false };
}

export function createWorkDir(mediaId: string): string {
  const dir = path.join(os.tmpdir(), `jevah-moderate-${mediaId}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
