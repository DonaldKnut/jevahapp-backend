import { Request, Response } from "express";
import { Types } from "mongoose";
import { Media } from "../../../models/media.model";
import { mediaService } from "../../../service/media.service";
import cacheService from "../../../service/cache.service";
import { invalidateFeedCaches } from "../../../lib/invalidateFeedCaches";
import { enqueueAnalyticsEvent, enqueueMediaPostUpload } from "../../../queues/enqueue";
import { User } from "../../../models/user.model";
import { optimizedVerificationService } from "../../../service/optimizedVerification.service";
import { uploadProgressService } from "../../../service/uploadProgress.service";
import resendEmailService from "../../../service/resendEmail.service";
import logger from "../../../utils/logger";
import { UPLOAD_LIMITS } from "../constants";
import { UploadMediaRequestBody } from "../shared";
import {
  findReusableModerationDecision,
  sha256Buffer,
} from "../../../service/moderation/contentHashDedup";
import { persistModerationDecision } from "../../../service/moderation/persistDecision";
import {
  reserveUserUploadForModeration,
} from "../../../service/moderation/aiBudget.service";

export const uploadMedia = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { title, description, contentType, category, topics, duration } =
      request.body as UploadMediaRequestBody;

    // Type assertion for Multer files from upload.fields
    const files = request.files as
      | { [fieldname: string]: Express.Multer.File[] }
      | undefined;

    // Check if files object exists
    if (!files) {
      logger.warn("No files received in request");
      response.status(400).json({
        success: false,
        message: "No files uploaded",
      });
      return;
    }

    const file = files?.file?.[0]; // Access the first file in the 'file' field
    const thumbnail = files?.thumbnail?.[0]; // Access the first file in the 'thumbnail' field

    // Detailed logging for debugging
    logger.debug("Request Files", {
      fileExists: !!file,
      fileBufferExists: !!file?.buffer,
      fileMimetype: file?.mimetype,
      fileOriginalname: file?.originalname,
      fileSize: file?.size,
      thumbnailExists: !!thumbnail,
      thumbnailBufferExists: !!thumbnail?.buffer,
      thumbnailMimetype: thumbnail?.mimetype,
      thumbnailOriginalname: thumbnail?.originalname,
      thumbnailSize: thumbnail?.size,
      body: {
        title,
        description,
        contentType,
        category,
        topics,
        duration,
      },
    });

    // Validate required fields
    if (!title || !contentType) {
      response.status(400).json({
        success: false,
        message: "Title and contentType are required",
      });
      return;
    }

    // Validate contentType
    if (!["music", "videos", "books", "live", "sermon"].includes(contentType)) {
      response.status(400).json({
        success: false,
        message:
          "Invalid content type. Must be 'music', 'videos', 'books', 'live', or 'sermon'",
      });
      return;
    }

    // Validate file presence
    if (!file || !file.buffer) {
      response.status(400).json({
        success: false,
        message: "No file uploaded",
      });
      return;
    }

    // Validate thumbnail (optional — FE may omit; pipeline can generate later)
    const hasThumbnail = !!(thumbnail && thumbnail.buffer);

    // Validate user authentication
    if (!request.userId) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    // Validate file size limits based on content type
    const fileSizeInMB = file.size / (1024 * 1024); // Convert bytes to MB

    if (contentType === "videos" || contentType === "sermon") {
      // Sermons/Videos: Maximum 300MB per file
      if (fileSizeInMB > UPLOAD_LIMITS.FILE_SIZE.SERMON_MB) {
        response.status(400).json({
          success: false,
          message: `File size exceeds maximum limit. Sermons/videos must be ${UPLOAD_LIMITS.FILE_SIZE.SERMON_MB}MB or less. Your file is ${fileSizeInMB.toFixed(1)}MB.`,
          code: "FILE_SIZE_EXCEEDED",
          maxSizeMB: UPLOAD_LIMITS.FILE_SIZE.SERMON_MB,
          fileSizeMB: fileSizeInMB.toFixed(1),
          contentType,
        });
        return;
      }
    } else if (contentType === "music") {
      // Music: Maximum 50MB per file
      if (fileSizeInMB > UPLOAD_LIMITS.FILE_SIZE.MUSIC_MB) {
        response.status(400).json({
          success: false,
          message: `File size exceeds maximum limit. Music files must be ${UPLOAD_LIMITS.FILE_SIZE.MUSIC_MB}MB or less. Your file is ${fileSizeInMB.toFixed(1)}MB.`,
          code: "FILE_SIZE_EXCEEDED",
          maxSizeMB: UPLOAD_LIMITS.FILE_SIZE.MUSIC_MB,
          fileSizeMB: fileSizeInMB.toFixed(1),
          contentType,
        });
        return;
      }
    } else if (contentType === "books") {
      // Books/Ebooks: Maximum 100MB per file (PDFs can be large)
      if (fileSizeInMB > UPLOAD_LIMITS.FILE_SIZE.BOOK_MB) {
        response.status(400).json({
          success: false,
          message: `File size exceeds maximum limit. Books/eBooks must be ${UPLOAD_LIMITS.FILE_SIZE.BOOK_MB}MB or less. Your file is ${fileSizeInMB.toFixed(1)}MB.`,
          code: "FILE_SIZE_EXCEEDED",
          maxSizeMB: UPLOAD_LIMITS.FILE_SIZE.BOOK_MB,
          fileSizeMB: fileSizeInMB.toFixed(1),
          contentType,
        });
        return;
      }
    }

    // Validate upload count limits per user
    const { Media } = await import("../../../models/media.model");
    const { Types } = await import("mongoose");
    const userIdObj = new Types.ObjectId(request.userId);

    if (contentType === "music") {
      // Artists: Maximum 50 songs per user
      const userMusicCount = await Media.countDocuments({
        uploadedBy: userIdObj,
        contentType: "music",
        isDefaultContent: { $ne: true }, // Exclude default/copyright-free content
      });

      if (userMusicCount >= UPLOAD_LIMITS.UPLOAD_COUNT.MUSIC_PER_USER) {
        response.status(400).json({
          success: false,
          message: `Upload limit reached. You can upload a maximum of ${UPLOAD_LIMITS.UPLOAD_COUNT.MUSIC_PER_USER} songs. Please delete some songs before uploading new ones.`,
          code: "UPLOAD_LIMIT_EXCEEDED",
          maxUploads: UPLOAD_LIMITS.UPLOAD_COUNT.MUSIC_PER_USER,
          currentUploads: userMusicCount,
          contentType,
        });
        return;
      }
    } else if (contentType === "videos" || contentType === "sermon") {
      // Users: Maximum 30 sermons/videos per user
      const userSermonCount = await Media.countDocuments({
        uploadedBy: userIdObj,
        contentType: { $in: ["videos", "sermon"] },
        isDefaultContent: { $ne: true }, // Exclude default content
      });

      if (userSermonCount >= UPLOAD_LIMITS.UPLOAD_COUNT.SERMON_PER_USER) {
        response.status(400).json({
          success: false,
          message: `Upload limit reached. You can upload a maximum of ${UPLOAD_LIMITS.UPLOAD_COUNT.SERMON_PER_USER} sermons/videos. Please delete some videos before uploading new ones.`,
          code: "UPLOAD_LIMIT_EXCEEDED",
          maxUploads: UPLOAD_LIMITS.UPLOAD_COUNT.SERMON_PER_USER,
          currentUploads: userSermonCount,
          contentType,
        });
        return;
      }
    }

    // Parse and validate topics
    let parsedTopics: string[] = [];
    if (topics) {
      try {
        parsedTopics = Array.isArray(topics) ? topics : JSON.parse(topics);
        if (!Array.isArray(parsedTopics)) {
          throw new Error("Topics must be an array");
        }
      } catch (error) {
        response.status(400).json({
          success: false,
          message: "Invalid topics format. Must be an array of strings",
        });
        return;
      }
    }

    // Validate duration (optional, only checked if provided)
    if (duration !== undefined && (isNaN(duration) || duration < 0)) {
      response.status(400).json({
        success: false,
        message: "Invalid duration. Must be a non-negative number",
      });
      return;
    }

    // Prefer FE X-Upload-ID for socket/poll correlation; else generate
    const uploadId = uploadProgressService.resolveUploadId(
      request.headers["x-upload-id"]
    );
    const userId = request.userId || "";

    // PRE-UPLOAD VERIFICATION: Verify content before uploading to storage
    // Skip verification for "live" content type as it doesn't require file uploads
    let verificationResult: {
      isApproved: boolean;
      moderationResult: any;
      transcript?: string;
      videoFrames?: string[];
    } | null = null;

    if (contentType !== "live") {
      logger.info("Starting optimized pre-upload content verification with progress", {
        uploadId,
        contentType,
        clientUploadId: request.headers["x-upload-id"],
      });

      // Register upload session for progress tracking
      uploadProgressService.registerUploadSession(uploadId, userId);
      uploadProgressService.sendProgress(
        {
          uploadId,
          progress: 5,
          stage: "received",
          message: "Upload received",
          timestamp: new Date().toISOString(),
        },
        userId
      );

      const contentHash = sha256Buffer(file.buffer);

      try {
        const reused = await findReusableModerationDecision(contentHash);
        if (reused) {
          verificationResult = {
            isApproved: reused.isApproved && !reused.requiresReview,
            moderationResult: reused,
            transcript: undefined,
            videoFrames: undefined,
          };
          (verificationResult as any).contentHash = contentHash;
        } else {
          if (!(await reserveUserUploadForModeration(userId))) {
            response.status(429).json({
              success: false,
              message:
                "Daily upload moderation allowance exceeded. Try again tomorrow.",
              code: "MODERATION_UPLOAD_BUDGET",
            });
            return;
          }
          verificationResult = await optimizedVerificationService.verifyContentWithProgress(
            file.buffer,
            file.mimetype,
            contentType,
            title,
            description,
            uploadId,
            (progress) => {
              uploadProgressService.sendProgress(progress, userId);
            },
            hasThumbnail ? thumbnail.buffer : undefined,
            hasThumbnail ? thumbnail.mimetype : undefined
          );
          (verificationResult as any).contentHash = contentHash;
        }
      } catch (error: any) {
        logger.error("Pre-upload verification error:", error);

        // Send error progress
        uploadProgressService.sendProgress(
          {
            uploadId,
            progress: 0,
            stage: "error",
            message: `Verification failed: ${error.message}`,
            timestamp: new Date().toISOString(),
          },
          userId
        );

        // Cleanup session
        uploadProgressService.clearUploadSession(uploadId);

        if (
          error?.code === "FFMPEG_REQUIRED" ||
          error?.name === "MediaToolsError" ||
          /ffmpeg is required|not recognized as an internal/i.test(
            String(error?.message || "")
          )
        ) {
          response.status(503).json({
            success: false,
            message:
              "FFmpeg is required for video/audio upload verification. Install FFmpeg (ffmpeg + ffprobe on PATH), restart the API, and retry.",
            code: "FFMPEG_REQUIRED",
            error: error.message,
            uploadId,
          });
          return;
        }

        // If verification fails, reject the upload for safety
        response.status(400).json({
          success: false,
          message: "Content verification failed. Please try again or contact support.",
          error: error.message,
          uploadId, // Include uploadId in response for frontend tracking
        });
        return;
      }

      // Hard reject only. Under-review continues to create a private media record
      // so admins have a reviewable ID in the moderation queue.
      if (
        !verificationResult.isApproved &&
        !verificationResult.moderationResult.requiresReview
      ) {
        logger.warn("Content rejected during pre-upload verification", {
          status: "rejected",
          reason: verificationResult.moderationResult.reason,
          flags: verificationResult.moderationResult.flags,
          uploadId,
        });

        uploadProgressService.sendProgress(
          {
            uploadId,
            progress: 0,
            stage: "rejected",
            message: "Content does not meet community guidelines",
            timestamp: new Date().toISOString(),
          },
          userId
        );
        uploadProgressService.clearUploadSession(uploadId, 60_000);

        response.status(403).json({
          success: false,
          message: "Content does not meet our community guidelines and cannot be uploaded.",
          moderationResult: {
            status: "rejected",
            reason: verificationResult.moderationResult.reason,
            flags: verificationResult.moderationResult.flags,
            confidence: verificationResult.moderationResult.confidence,
          },
          uploadId,
        });
        return;
      }

      const needsReview =
        !!verificationResult.moderationResult.requiresReview ||
        !verificationResult.isApproved;

      uploadProgressService.sendProgress(
        {
          uploadId,
          progress: 85,
          stage: "uploading",
          message: needsReview
            ? "Verified — uploading for review…"
            : "Verified — uploading to storage…",
          timestamp: new Date().toISOString(),
        },
        userId
      );

      logger.info(
        needsReview
          ? "Content requires review — creating private media record"
          : "Content approved, proceeding with upload to storage",
        { uploadId }
      );
    } else {
      logger.info("Skipping verification for live content type");
    }

    uploadProgressService.sendProgress(
      {
        uploadId,
        progress: 90,
        stage: "finalizing",
        message: "Saving media…",
        timestamp: new Date().toISOString(),
      },
      userId
    );

    // Call mediaService to upload the media
    const media = await mediaService.uploadMedia({
      title,
      description,
      contentType,
      category,
      file: file.buffer,
      fileMimeType: file.mimetype,
      thumbnail: hasThumbnail ? thumbnail.buffer : undefined,
      thumbnailMimeType: hasThumbnail ? thumbnail.mimetype : undefined,
      uploadedBy: new Types.ObjectId(request.userId),
      topics: parsedTopics,
      duration,
    } as any);

    // Update media with pre-upload verification result (if verification was performed)
    if (verificationResult) {
      const requiresReview =
        !!verificationResult.moderationResult.requiresReview ||
        !verificationResult.isApproved;
      const status = requiresReview ? "under_review" : "approved";
      const isHidden = requiresReview;

      const updateData: any = {
        moderationStatus: status,
        contentHash: (verificationResult as any).contentHash,
        moderationResult: {
          ...verificationResult.moderationResult,
          moderatedAt: new Date(),
        },
        isHidden,
        processing: {
          status: requiresReview ? "queued" : "queued",
          jobType: contentType === "videos" || contentType === "sermon" ? "transcode" : "process",
          updatedAt: new Date(),
          progress: 0,
        },
      };

      await Media.findByIdAndUpdate(media._id, updateData);
      await persistModerationDecision({
        mediaId: String(media._id),
        contentHash: (verificationResult as any).contentHash,
        result: verificationResult.moderationResult,
        title,
        description,
        transcript: verificationResult.transcript,
        frameCount: verificationResult.videoFrames?.length || 0,
        hasThumbnail,
      });
      media.moderationStatus = status;
      media.moderationResult = updateData.moderationResult;
      media.isHidden = isHidden;

      if (requiresReview) {
        void (async () => {
          try {
            const flags: string[] =
              verificationResult.moderationResult?.flags || [];
            // AI outages / offline quarantine: don't spam every admin inbox.
            // Admins still see the item in /api/admin/moderation/queue.
            const skipEmailBlast = flags.some((f: string) =>
              [
                "provider_unavailable",
                "moderation_service_error",
                "ai_budget_exhausted",
                "ai_error",
              ].includes(f)
            );
            if (skipEmailBlast) {
              logger.info(
                "Skipping admin email blast for degraded-moderation quarantine",
                { mediaId: String(media._id), flags }
              );
              return;
            }

            const [admins, uploader] = await Promise.all([
              User.find({ role: "admin" }).select("email").lean(),
              User.findById(userId).select("email firstName lastName").lean(),
            ]);
            const adminEmails = (admins as any[]).map(a => a.email).filter(Boolean);
            const uploadedByLabel = uploader
              ? `${(uploader as any).firstName || ""} ${(uploader as any).lastName || ""}`.trim() ||
                (uploader as any).email ||
                userId
              : userId;
            if (adminEmails.length > 0) {
              await resendEmailService.sendAdminModerationAlert(
                adminEmails,
                title || "Untitled",
                contentType,
                uploadedByLabel,
                verificationResult.moderationResult,
                0
              );
            }
          } catch (err: any) {
            logger.error("Failed to send under-review alert to admins", {
              mediaId: String(media._id),
              error: err?.message,
            });
          }
        })();
      }
    } else {
      const updateData: any = {
        moderationStatus: "pending",
        isHidden: false,
      };
      await Media.findByIdAndUpdate(media._id, updateData);
      media.moderationStatus = "pending";
    }

    const mediaIdString = String((media as any)._id);
    const isPubliclyVisible =
      media.moderationStatus === "approved" && media.isHidden !== true;

    uploadProgressService.setMediaId(uploadId, mediaIdString);

    // Only invalidate public feeds when content is actually visible
    if (isPubliclyVisible) {
      await cacheService.delPattern("media:public:all-content*");
      await cacheService.delPattern("media:all:*");
      await invalidateFeedCaches(mediaIdString, userId);
    }

    enqueueMediaPostUpload({
      mediaId: mediaIdString,
      userId,
      contentType,
      fileUrl: media.fileUrl,
      requestId: (request as any).requestId,
    });
    enqueueAnalyticsEvent({
      name: "media_uploaded",
      payload: {
        mediaId: mediaIdString,
        userId,
        contentType,
        createdAt: new Date().toISOString(),
      },
      requestId: (request as any).requestId,
    });

    const underReview = media.moderationStatus === "under_review";
    const processingStatus =
      (media as any).processing?.status === "ready" ||
      (media as any).processing?.status === "completed"
        ? "ready"
        : underReview
          ? "pending"
          : "processing";

    if (contentType !== "live") {
      uploadProgressService.sendProgress(
        {
          uploadId,
          progress: 100,
          stage: "complete",
          message: underReview
            ? "Uploaded — awaiting moderation"
            : "Upload complete",
          timestamp: new Date().toISOString(),
        },
        userId
      );
      // Keep pollable briefly for FE that missed the socket event
      uploadProgressService.clearUploadSession(uploadId, 120_000);
    }

    const mediaObj = media.toObject ? media.toObject() : media;
    response.status(underReview ? 202 : 201).json({
      success: true,
      message: underReview
        ? "Media uploaded and queued for manual review. It is hidden until an admin approves it."
        : verificationResult
          ? "Media uploaded successfully. Content has been verified and approved."
          : "Media uploaded successfully.",
      uploadId: contentType !== "live" ? uploadId : undefined,
      data: {
        _id: mediaIdString,
        id: mediaIdString,
        contentType,
        title: media.title,
        fileUrl: media.fileUrl,
        thumbnailUrl: media.thumbnailUrl,
        duration: (media as any).duration ?? duration ?? null,
        processingStatus,
        hlsUrl: (media as any).hlsUrl ?? null,
        moderationStatus: media.moderationStatus || "pending",
        moderationResult: media.moderationResult,
      },
      media: {
        ...mediaObj,
        fileUrl: media.fileUrl,
        thumbnailUrl: media.thumbnailUrl,
        moderationStatus: media.moderationStatus || "pending",
        moderationResult: media.moderationResult,
        processingStatus,
      },
    });
    return;
  } catch (error: any) {
    logger.error("Upload media error", { error: error?.message });

    // Cleanup upload session on error (only if variables are available)
    if (request.body && request.body.contentType && request.body.contentType !== "live") {
      const errorUploadId = uploadProgressService.resolveUploadId(
        request.headers["x-upload-id"]
      );
      const errorUserId = request.userId || "";

      if (errorUploadId && errorUserId) {
        uploadProgressService.sendProgress(
          {
            uploadId: errorUploadId,
            progress: 0,
            stage: "error",
            message: `Upload failed: ${error.message}`,
            timestamp: new Date().toISOString(),
          },
          errorUserId
        );
        uploadProgressService.clearUploadSession(errorUploadId, 60_000);
      }
    }
    response.status(500).json({
      success: false,
      message: `Failed to upload media: ${error.message}`,
    });
  }
};
