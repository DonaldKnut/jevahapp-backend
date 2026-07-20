import { Request, Response } from "express";
import { Types } from "mongoose";
import { Media } from "../../models/media.model";
import { mediaService } from "../../service/media.service";
import cacheService from "../../service/cache.service";
import { invalidateFeedCaches } from "../../lib/invalidateFeedCaches";
import { enqueueAnalyticsEvent, enqueueMediaPostUpload } from "../../queues/enqueue";
import { User } from "../../models/user.model";
import { optimizedVerificationService } from "../../service/optimizedVerification.service";
import { uploadProgressService } from "../../service/uploadProgress.service";
import resendEmailService from "../../service/resendEmail.service";
import { aiContentDescriptionService } from "../../service/aiContentDescription.service";
import { mediaProcessingService } from "../../service/mediaProcessing.service";
import { transcriptionService } from "../../service/transcription.service";
import logger from "../../utils/logger";
import { UPLOAD_LIMITS, AI_DESCRIPTION_LIMITS } from "./constants";
import { UploadMediaRequestBody } from "./shared";
import {
  findReusableModerationDecision,
  sha256Buffer,
} from "../../service/moderation/contentHashDedup";
import { persistModerationDecision } from "../../service/moderation/persistDecision";
import {
  reserveUserUploadForModeration,
} from "../../service/moderation/aiBudget.service";

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

    // Validate thumbnail presence
    if (!thumbnail || !thumbnail.buffer) {
      response.status(400).json({
        success: false,
        message: "No thumbnail uploaded",
      });
      return;
    }

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
    const { Media } = await import("../../models/media.model");
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

    // Generate upload ID for progress tracking (used for all content types)
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
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
      });

      // Register upload session for progress tracking
      uploadProgressService.registerUploadSession(uploadId, userId);

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
            thumbnail.buffer,
            thumbnail.mimetype
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
        uploadProgressService.clearUploadSession(uploadId);

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
          progress: 100,
          stage: needsReview ? "under_review" : "complete",
          message: needsReview
            ? "Content queued for manual review"
            : "Content verified and approved!",
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

    // Call mediaService to upload the media
    const media = await mediaService.uploadMedia({
      title,
      description,
      contentType,
      category,
      file: file.buffer,
      fileMimeType: file.mimetype,
      thumbnail: thumbnail.buffer,
      thumbnailMimeType: thumbnail.mimetype,
      uploadedBy: new Types.ObjectId(request.userId),
      topics: parsedTopics,
      duration,
    });

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
        hasThumbnail: true,
      });
      media.moderationStatus = status;
      media.moderationResult = updateData.moderationResult;
      media.isHidden = isHidden;

      if (requiresReview) {
        void (async () => {
          try {
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

    if (contentType !== "live") {
      uploadProgressService.clearUploadSession(uploadId);
    }

    const underReview = media.moderationStatus === "under_review";
    response.status(underReview ? 202 : 201).json({
      success: true,
      message: underReview
        ? "Media uploaded and queued for manual review. It is hidden until an admin approves it."
        : verificationResult
          ? "Media uploaded successfully. Content has been verified and approved."
          : "Media uploaded successfully.",
      media: {
        ...media.toObject(),
        fileUrl: media.fileUrl,
        thumbnailUrl: media.thumbnailUrl,
        moderationStatus: media.moderationStatus || "pending",
        moderationResult: media.moderationResult,
      },
      uploadId: contentType !== "live" ? uploadId : undefined,
    });
    return;
  } catch (error: any) {
    logger.error("Upload media error", { error: error?.message });

    // Cleanup upload session on error (only if variables are available)
    if (request.body && request.body.contentType && request.body.contentType !== "live") {
      const errorUploadId = request.headers['x-upload-id'] as string || undefined;
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
        uploadProgressService.clearUploadSession(errorUploadId);
      }
    }
    response.status(500).json({
      success: false,
      message: `Failed to upload media: ${error.message}`,
    });
  }
};

export const generateMediaDescription = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { title, contentType, category, topics } = request.body;

    // Validate required fields
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      response.status(400).json({
        success: false,
        message: "Title is required",
      });
      return;
    }

    if (
      !contentType ||
      !["music", "videos", "books", "live", "audio", "sermon", "devotional", "ebook", "podcast"].includes(
        contentType
      )
    ) {
      response.status(400).json({
        success: false,
        message:
          "Valid contentType is required (music, videos, books, live, audio, sermon, devotional, ebook, podcast)",
      });
      return;
    }

    // Get user info if authenticated (optional for this endpoint)
    let authorInfo = undefined;
    if (request.userId) {
      try {
        const user = await User.findById(request.userId).select(
          "firstName lastName username avatar"
        );
        if (user) {
          authorInfo = {
            _id: user._id.toString(),
            firstName: user.firstName || "",
            lastName: user.lastName || "",
            fullName: `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unknown Author",
            avatar: user.avatar || undefined,
          };
        }
      } catch (userError) {
        // Non-blocking - continue without author info
        console.log("Could not fetch user info for AI description:", userError);
      }
    }

    // Process uploaded files for multimodal analysis (optional)
    let videoFrames: string[] | undefined;
    let transcript: string | undefined;
    let thumbnailBase64: string | undefined;

    // Check if files were uploaded
    const files = request.files as
      | { [fieldname: string]: Express.Multer.File[] }
      | undefined;

    const file = files?.file?.[0];
    const thumbnail = files?.thumbnail?.[0];

    // Process uploaded files for multimodal analysis (optional)
    // We now allow analysis for all files up to the system limit, 
    // but the analysis itself stays light (first 3 mins only).
    if (file && file.buffer) {
      logger.info(`Processing file for AI analysis (${(file.size / (1024 * 1024)).toFixed(1)}MB)`);
    }

    // Process thumbnail if provided
    if (thumbnail && thumbnail.buffer) {
      try {
        const thumbnailSizeMB = thumbnail.size / (1024 * 1024);
        if (thumbnailSizeMB <= 5) { // Thumbnail size limit
          thumbnailBase64 = `data:${thumbnail.mimetype || "image/jpeg"};base64,${thumbnail.buffer.toString("base64")}`;
          logger.info("Thumbnail processed for AI description generation");
        } else {
          logger.warn(`Thumbnail too large (${thumbnailSizeMB.toFixed(1)}MB), skipping`);
        }
      } catch (error) {
        logger.warn("Failed to process thumbnail:", error);
      }
    }

    // Process video/audio file if provided for enhanced analysis
    if (file && file.buffer) {
      try {
        const fileMimeType = file.mimetype;

        // For video content, extract frames and transcribe (limited duration)
        if ((contentType === "videos" || contentType === "sermon") && fileMimeType.startsWith("video/")) {
          logger.info("Processing video for AI description generation (limited to first 3 minutes)");

          // Extract video frames (from first portion of video)
          try {
            const framesResult = await mediaProcessingService.extractVideoFrames(
              file.buffer,
              fileMimeType,
              3 // Extract 3 key frames
            );
            videoFrames = framesResult.frames;
            logger.info(`Extracted ${videoFrames.length} video frames for analysis`);
          } catch (frameError) {
            logger.warn("Failed to extract video frames:", frameError);
          }

          // Extract audio and transcribe (limited to first 3 minutes for cost control)
          try {
            const audioResult = await mediaProcessingService.extractAudio(
              file.buffer,
              fileMimeType
            );

            // Limit transcription to first 3 minutes if duration is available
            // Note: Transcription service should handle this, but we log it
            const transcriptionResult = await transcriptionService.transcribeAudio(
              audioResult.audioBuffer,
              "audio/mp3"
            );
            transcript = transcriptionResult.transcript;

            // Truncate transcript if too long (safety measure)
            if (transcript.length > 2000) {
              transcript = transcript.substring(0, 2000) + "...";
              logger.info("Transcript truncated to 2000 chars for cost control");
            }

            logger.info(`Transcribed video audio (${transcript.length} chars)`);
          } catch (transcribeError) {
            logger.warn("Failed to transcribe video:", transcribeError);
          }
        }
        // For audio/music content, transcribe (limited duration)
        else if ((contentType === "music" || contentType === "audio") && fileMimeType.startsWith("audio/")) {
          logger.info("Processing audio for AI description generation (limited to first 3 minutes)");

          try {
            const transcriptionResult = await transcriptionService.transcribeAudio(
              file.buffer,
              fileMimeType
            );
            transcript = transcriptionResult.transcript;

            // Truncate transcript if too long (safety measure)
            if (transcript.length > 2000) {
              transcript = transcript.substring(0, 2000) + "...";
              logger.info("Transcript truncated to 2000 chars for cost control");
            }

            logger.info(`Transcribed audio (${transcript.length} chars)`);
          } catch (transcribeError) {
            logger.warn("Failed to transcribe audio:", transcribeError);
          }
        }
      } catch (fileError) {
        logger.warn("File processing failed, continuing with text-only analysis:", fileError);
        // Continue without multimodal content - not a critical error
      }
    }

    // Prepare media content object for AI service with multimodal data
    const mediaContent = {
      _id: "temp-id", // Not needed for generation
      title: title.trim(),
      description: undefined, // No existing description
      contentType: contentType,
      category: category || undefined,
      topics: Array.isArray(topics) ? topics : typeof topics === "string" ? [topics] : undefined,
      authorInfo: authorInfo,
      // Add multimodal content if available
      videoFrames: videoFrames,
      thumbnail: thumbnailBase64,
      transcript: transcript,
    };

    // Generate description using AI service (with multimodal analysis if available)
    // Add timeout to prevent hanging requests
    const generateDescription = async () => {
      return await aiContentDescriptionService.generateContentDescription(mediaContent);
    };

    let aiResponse: Awaited<ReturnType<typeof generateDescription>>;

    try {
      // Race between AI generation and timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error("AI description generation timed out"));
        }, AI_DESCRIPTION_LIMITS.TIMEOUT_MS);
      });

      aiResponse = await Promise.race([
        generateDescription(),
        timeoutPromise,
      ]);
    } catch (timeoutError: any) {
      if (timeoutError.message === "AI description generation timed out") {
        logger.warn("AI description generation timed out, using fallback");
        // Return fallback description on timeout
        response.status(200).json({
          success: true,
          description: aiContentDescriptionService.getFallbackDescription(mediaContent),
          bibleVerses: aiContentDescriptionService.getFallbackBibleVerses(mediaContent),
          message: "Description generation timed out. Generated description from title only.",
          warning: "GENERATION_TIMEOUT",
        });
        return;
      }
      throw timeoutError; // Re-throw other errors
    }

    if (!aiResponse.success) {
      // Return fallback description if AI fails
      response.status(200).json({
        success: true,
        description: aiResponse.description || aiContentDescriptionService.getFallbackDescription(mediaContent),
        bibleVerses: aiResponse.bibleVerses || [],
        message: "Description generated (using fallback)",
        warning: "AI_GENERATION_FAILED",
      });
      return;
    }

    // Return successful AI-generated description
    response.status(200).json({
      success: true,
      description: aiResponse.description,
      bibleVerses: aiResponse.bibleVerses || [],
      enhancedDescription: aiResponse.enhancedDescription,
      message: "Description generated successfully",
    });
  } catch (error: any) {
    logger.error("Generate media description error:", error);

    // Return fallback description on any error (don't fail the request)
    try {
      const fallbackDescription = aiContentDescriptionService.getFallbackDescription({
        _id: "temp-id",
        title: request.body.title?.trim() || "Media",
        contentType: request.body.contentType || "content",
        category: request.body.category,
        topics: Array.isArray(request.body.topics)
          ? request.body.topics
          : typeof request.body.topics === "string"
            ? [request.body.topics]
            : undefined,
      });

      response.status(200).json({
        success: true,
        description: fallbackDescription,
        bibleVerses: [],
        message: "Description generated (using fallback due to error)",
        warning: "ERROR_FALLBACK",
      });
    } catch (fallbackError) {
      response.status(500).json({
        success: false,
        message: "Failed to generate description",
        error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
      });
    }
  }
};

/**
 * Get current upload counts and limits for the authenticated user
 * Useful for frontend to display progress bars and check limits before upload
 */
export const getUploadCounts = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    // Validate user authentication
    if (!request.userId) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    const { Media } = await import("../../models/media.model");
    const { Types } = await import("mongoose");
    const userIdObj = new Types.ObjectId(request.userId);

    // Get current upload counts (excluding default content)
    const [musicCount, sermonVideoCount] = await Promise.all([
      Media.countDocuments({
        uploadedBy: userIdObj,
        contentType: "music",
        isDefaultContent: { $ne: true },
      }),
      Media.countDocuments({
        uploadedBy: userIdObj,
        contentType: { $in: ["videos", "sermon"] },
        isDefaultContent: { $ne: true },
      }),
    ]);

    // Calculate remaining uploads
    const musicRemaining = Math.max(
      0,
      UPLOAD_LIMITS.UPLOAD_COUNT.MUSIC_PER_USER - musicCount
    );
    const sermonVideoRemaining = Math.max(
      0,
      UPLOAD_LIMITS.UPLOAD_COUNT.SERMON_PER_USER - sermonVideoCount
    );

    // Calculate percentage used
    const musicPercentage = Math.round(
      (musicCount / UPLOAD_LIMITS.UPLOAD_COUNT.MUSIC_PER_USER) * 100
    );
    const sermonVideoPercentage = Math.round(
      (sermonVideoCount / UPLOAD_LIMITS.UPLOAD_COUNT.SERMON_PER_USER) * 100
    );

    response.status(200).json({
      success: true,
      message: "Upload counts retrieved successfully",
      data: {
        music: {
          current: musicCount,
          max: UPLOAD_LIMITS.UPLOAD_COUNT.MUSIC_PER_USER,
          remaining: musicRemaining,
          percentage: musicPercentage,
          canUpload: musicCount < UPLOAD_LIMITS.UPLOAD_COUNT.MUSIC_PER_USER,
        },
        sermons: {
          current: sermonVideoCount,
          max: UPLOAD_LIMITS.UPLOAD_COUNT.SERMON_PER_USER,
          remaining: sermonVideoRemaining,
          percentage: sermonVideoPercentage,
          canUpload:
            sermonVideoCount < UPLOAD_LIMITS.UPLOAD_COUNT.SERMON_PER_USER,
        },
        limits: {
          fileSize: UPLOAD_LIMITS.FILE_SIZE,
          uploadCount: UPLOAD_LIMITS.UPLOAD_COUNT,
        },
      },
    });
  } catch (error: any) {
    console.error("Get upload counts error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to retrieve upload counts",
      error: error.message,
    });
  }
};
