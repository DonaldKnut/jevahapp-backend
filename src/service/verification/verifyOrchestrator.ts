import logger from "../../utils/logger";
import { contentModerationService } from "../contentModeration.service";
import { assertFfmpegForContentType } from "../../utils/mediaTools";
import type {
  OptimizedVerificationResult,
  ProgressCallback,
} from "./types";
import { processAudioContent, processVideoContent } from "./bufferEvidence";
import { processBookContent } from "./bookEvidence";
import { processVideoPath } from "./videoPathEvidence";

export async function verifyContentWithProgress(
  file: Buffer,
  fileMimeType: string,
  contentType: string,
  title: string,
  description: string | undefined,
  uploadId: string,
  onProgress?: ProgressCallback,
  thumbnailBuffer?: Buffer,
  thumbnailMimeType?: string,
  opts?: { mediaId?: string; contentHash?: string; uploadedBy?: string }
): Promise<OptimizedVerificationResult> {
  const reportProgress = (progress: number, stage: string, message: string) => {
    if (onProgress) {
      onProgress({
        uploadId,
        progress,
        stage,
        message,
        timestamp: new Date().toISOString(),
      });
    }
  };

  reportProgress(5, "received", "File received, starting verification...");

  await assertFfmpegForContentType(contentType);

  let transcript = "";
  let videoFrames: string[] = [];
  let ocrText = "";

  try {
    if ((contentType === "videos" || contentType === "sermon") && fileMimeType.startsWith("video")) {
      await processVideoContent(
        file,
        fileMimeType,
        uploadId,
        reportProgress,
        (t, f, o) => {
          transcript = t;
          videoFrames = f;
          ocrText = o || "";
        }
      );
    } else if (
      (contentType === "music" || contentType === "audio") &&
      fileMimeType.startsWith("audio")
    ) {
      await processAudioContent(
        file,
        fileMimeType,
        uploadId,
        reportProgress,
        (t) => {
          transcript = t;
        }
      );
    } else if (contentType === "books") {
      await processBookContent(
        file,
        fileMimeType,
        uploadId,
        reportProgress,
        (t) => {
          transcript = t;
        }
      );
    }

    let thumbnailBase64: string | undefined;
    if (thumbnailBuffer) {
      reportProgress(72, "moderating", "Checking thumbnail image...");
      thumbnailBase64 = `data:${thumbnailMimeType || "image/jpeg"};base64,${thumbnailBuffer.toString("base64")}`;
    }

    reportProgress(75, "moderating", "Checking content guidelines...");
    const moderationResult = await contentModerationService.moderateContent({
      transcript: transcript || undefined,
      ocrText: ocrText || undefined,
      videoFrames: videoFrames.length > 0 ? videoFrames : undefined,
      thumbnail: thumbnailBase64,
      title,
      description,
      contentType,
      mediaId: opts?.mediaId,
      contentHash: opts?.contentHash,
      fileMimeType,
      uploadedBy: opts?.uploadedBy,
    });

    reportProgress(95, "finalizing", "Verification complete!");

    return {
      isApproved: moderationResult.isApproved,
      moderationResult,
      transcript: transcript || undefined,
      videoFrames: videoFrames.length > 0 ? videoFrames : undefined,
    };
  } catch (error: any) {
    logger.error("Optimized verification error:", error);
    reportProgress(0, "error", `Verification failed: ${error.message}`);
    throw error;
  }
}

export async function verifyVideoPathWithProgress(
  filePath: string,
  fileMimeType: string,
  contentType: string,
  title: string,
  description: string | undefined,
  uploadId: string,
  opts?: {
    mediaId?: string;
    contentHash?: string;
    thumbnailBuffer?: Buffer;
    thumbnailMimeType?: string;
    uploadedBy?: string;
  }
): Promise<OptimizedVerificationResult> {
  await assertFfmpegForContentType(contentType);

  let transcript = "";
  let videoFrames: string[] = [];
  let ocrText = "";
  const reportProgress = (
    progress: number,
    stage: string,
    message: string
  ) => {
    logger.debug("Staged video verification progress", {
      uploadId,
      progress,
      stage,
      message,
    });
  };
  await processVideoPath(
    filePath,
    fileMimeType,
    uploadId,
    reportProgress,
    (t, f, o) => {
      transcript = t;
      videoFrames = f;
      ocrText = o || "";
    }
  );

  let thumbnailBase64: string | undefined;
  if (opts?.thumbnailBuffer?.length) {
    logger.info("Including user thumbnail in staged video moderation", {
      uploadId,
      bytes: opts.thumbnailBuffer.length,
    });
    thumbnailBase64 = `data:${
      opts.thumbnailMimeType || "image/jpeg"
    };base64,${opts.thumbnailBuffer.toString("base64")}`;
  }

  const moderationResult = await contentModerationService.moderateContent({
    transcript: transcript || undefined,
    ocrText: ocrText || undefined,
    videoFrames: videoFrames.length ? videoFrames : undefined,
    thumbnail: thumbnailBase64,
    title,
    description,
    contentType,
    mediaId: opts?.mediaId,
    contentHash: opts?.contentHash,
    fileMimeType,
    uploadedBy: opts?.uploadedBy,
  });
  return {
    isApproved: moderationResult.isApproved,
    moderationResult,
    transcript: transcript || undefined,
    videoFrames: videoFrames.length ? videoFrames : undefined,
  };
}
