import { Types } from "mongoose";
import { Media } from "../../models/media.model";
import { MediaReport } from "../../models/mediaReport.model";
import { User } from "../../models/user.model";
import cacheService from "../../service/cache.service";
import { contentModerationService } from "../../service/contentModeration.service";
import { mediaProcessingService } from "../../service/mediaProcessing.service";
import { NotificationService } from "../../service/notification.service";
import resendEmailService from "../../service/resendEmail.service";
import { transcriptionService } from "../../service/transcription.service";
import logger from "../../utils/logger";

export interface UploadMediaRequestBody {
  title: string;
  description?: string;
  contentType: "music" | "videos" | "books" | "live" | "sermon";
  category?: string;
  topics?: string[] | string;
  duration?: number;
}
export interface InteractionRequestBody {
  interactionType: "view" | "listen" | "read" | "download";
}

export interface UserActionRequestBody {
  actionType: "favorite" | "share";
}

export interface SearchQueryParameters {
  search?: string;
  contentType?: string;
  category?: string;
  topics?: string;
  sort?: string;
  page?: string;
  limit?: string;
  creator?: string;
  duration?: "short" | "medium" | "long";
  startDate?: string;
  endDate?: string;
}

// New interfaces for enhanced functionality
export interface ViewTrackingRequestBody {
  duration: number; // Duration in seconds
  isComplete?: boolean;
}

export interface DownloadRequestBody {
  fileSize?: number; // Optional - will be fetched from media document if not provided
}

export interface ShareRequestBody {
  platform?: string;
}

// Helper function to extract object key from URL
export const extractObjectKeyFromUrl = (url: string): string | null => {
  try {
    if (url.includes("/")) {
      const parts = url.split("/");
      return parts.slice(3).join("/"); // Remove domain parts
    }
    return url;
  } catch (error) {
    return null;
  }
};

// Helper function to map content types
export const mapContentType = (contentType: string): "video" | "audio" | "image" => {
  switch (contentType) {
    case "videos":
    case "sermon":
      return "video";
    case "audio":
    case "music":
    case "devotional":
      return "audio";
    case "ebook":
    case "books":
      return "image";
    default:
      return "video";
  }
};

/**
 * Extract text from PDF buffer for moderation
 */
async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  try {
    // Dynamic import for pdf-parse (uses ES Module pdfjs-dist)
    const pdfParseModule = await new Function('return import("pdf-parse")')();
    const { PDFParse } = pdfParseModule;

    // Create PDFParse instance
    const pdfParser = new PDFParse({ data: pdfBuffer });

    // Get text result
    const textResult = await pdfParser.getText();

    // Clean up
    await pdfParser.destroy();

    // Extract all text from pages
    let fullText = "";
    if (textResult.pages && textResult.pages.length > 0) {
      // Use per-page text if available
      fullText = textResult.pages
        .map((pageData: any) => pageData.text || "")
        .join("\n");
    } else if (textResult.text) {
      // Fallback: use full text
      fullText = textResult.text;
    }

    // Clean up text (remove excessive whitespace)
    fullText = fullText.replace(/\s+/g, " ").trim();

    // Limit text length for moderation (first 10000 characters should be enough)
    return fullText.substring(0, 10000);
  } catch (error: any) {
    logger.error("Failed to extract text from PDF", { error: error.message });
    throw new Error("Failed to extract text from PDF");
  }
}

/**
 * Extract text from EPUB buffer for moderation
 * EPUB is a ZIP archive containing HTML/XHTML files
 * Note: For now, EPUB extraction is limited - we'll use basic moderation
 * TODO: Add proper EPUB parsing library (e.g., epub2 or jszip)
 */
async function extractTextFromEPUB(epubBuffer: Buffer): Promise<string> {
  try {
    // Try to use jszip if available, otherwise fall back to basic extraction
    let JSZip: any;
    try {
      // Dynamic import with type assertion to handle optional dependency
      JSZip = await import("jszip" as any).catch(() => null);
      if (!JSZip) {
        throw new Error("JSZip not available");
      }
    } catch (importError) {
      logger.warn("JSZip not available, EPUB text extraction will be limited");
      // Return empty string - will fall back to title/description moderation
      return "";
    }

    const zip = new JSZip.default();
    const zipData = await zip.loadAsync(epubBuffer);

    let fullText = "";

    // EPUB structure: content is usually in OEBPS/ or OPS/ folder
    // Look for .html, .xhtml, or .htm files
    const contentFiles: string[] = [];

    zipData.forEach((relativePath: string, file: any) => {
      if (
        !file.dir &&
        (relativePath.endsWith(".html") ||
          relativePath.endsWith(".xhtml") ||
          relativePath.endsWith(".htm")) &&
        !relativePath.includes("META-INF") &&
        !relativePath.includes("mimetype")
      ) {
        contentFiles.push(relativePath);
      }
    });

    // Extract text from content files (limit to first 10 files)
    for (const filePath of contentFiles.slice(0, 10)) {
      try {
        const fileContent = await zipData.file(filePath)?.async("string");
        if (fileContent) {
          // Remove HTML tags and extract text
          const textContent = fileContent
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "") // Remove scripts
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "") // Remove styles
            .replace(/<[^>]+>/g, " ") // Remove HTML tags
            .replace(/\s+/g, " ") // Normalize whitespace
            .trim();

          if (textContent) {
            fullText += textContent + "\n";
          }
        }
      } catch (error) {
        logger.warn(`Failed to extract text from EPUB file: ${filePath}`, error);
      }
    }

    // Clean up text
    fullText = fullText.trim();

    if (!fullText) {
      logger.warn("No text extracted from EPUB, will use basic moderation");
      return "";
    }

    // Limit text length for moderation (first 10000 characters should be enough)
    return fullText.substring(0, 10000);
  } catch (error: any) {
    logger.error("Failed to extract text from EPUB", { error: error.message });
    // Return empty string - will fall back to title/description moderation
    return "";
  }
}

/**
 * Pre-upload content verification
 * Processes files in memory, extracts audio/frames, transcribes, and runs moderation
 * Returns moderation result before upload to storage
 */
async function verifyContentBeforeUpload(
  file: Buffer,
  fileMimeType: string,
  contentType: string,
  title: string,
  description?: string
): Promise<{
  isApproved: boolean;
  moderationResult: any;
  transcript?: string;
  videoFrames?: string[];
}> {
  logger.info("Starting pre-upload content verification", {
    contentType,
    fileSize: file.length,
    fileMimeType,
  });

  let transcript = "";
  let videoFrames: string[] = [];

  // For video content, extract audio and frames
  if (contentType === "videos" && fileMimeType.startsWith("video")) {
    try {
      logger.info("Processing video: extracting audio and frames");

      // Extract audio for transcription
      const audioResult = await mediaProcessingService.extractAudio(
        file,
        fileMimeType
      );

      // Transcribe audio
      const transcriptionResult = await transcriptionService.transcribeAudio(
        audioResult.audioBuffer,
        "audio/mp3"
      );
      transcript = transcriptionResult.transcript;
      logger.info("Video transcription completed", {
        transcriptLength: transcript.length,
      });

      // Extract video frames
      const framesResult = await mediaProcessingService.extractVideoFrames(
        file,
        fileMimeType,
        3 // Extract 3 key frames
      );
      videoFrames = framesResult.frames;
      logger.info("Video frames extracted", { frameCount: videoFrames.length });
    } catch (error: any) {
      logger.warn("Media processing failed, continuing with basic moderation:", error);
      // Continue with basic moderation (title/description only)
    }
  }

  // For audio/music content, transcribe
  if (
    (contentType === "music" || contentType === "audio") &&
    fileMimeType.startsWith("audio")
  ) {
    try {
      logger.info("Processing audio: transcribing");
      const transcriptionResult = await transcriptionService.transcribeAudio(
        file,
        fileMimeType
      );
      transcript = transcriptionResult.transcript;
      logger.info("Audio transcription completed", {
        transcriptLength: transcript.length,
      });
    } catch (error: any) {
      logger.warn("Transcription failed, continuing with basic moderation:", error);
      // Continue with basic moderation (title/description only)
    }
  }

  // For books/ebooks, extract text from PDF or EPUB
  if (contentType === "books") {
    try {
      logger.info("Processing book: extracting text");

      if (fileMimeType === "application/pdf") {
        // Extract text from PDF
        const pdfText = await extractTextFromPDF(file);
        transcript = pdfText;
        logger.info("PDF text extraction completed", {
          textLength: transcript.length,
        });
      } else if (fileMimeType === "application/epub+zip") {
        // Extract text from EPUB
        const epubText = await extractTextFromEPUB(file);
        transcript = epubText;
        logger.info("EPUB text extraction completed", {
          textLength: transcript.length,
        });
      } else {
        logger.warn("Unsupported book file type, continuing with basic moderation");
      }
    } catch (error: any) {
      logger.warn("Book text extraction failed, continuing with basic moderation:", error);
      // Continue with basic moderation (title/description only)
    }
  }

  // Run moderation
  logger.info("Running AI moderation");
  const moderationResult = await contentModerationService.moderateContent({
    transcript: transcript || undefined,
    videoFrames: videoFrames.length > 0 ? videoFrames : undefined,
    title,
    description,
    contentType,
  });

  logger.info("Pre-upload verification completed", {
    isApproved: moderationResult.isApproved,
    requiresReview: moderationResult.requiresReview,
    confidence: moderationResult.confidence,
  });

  return {
    isApproved: moderationResult.isApproved,
    moderationResult,
    transcript: transcript || undefined,
    videoFrames: videoFrames.length > 0 ? videoFrames : undefined,
  };
}

/**
 * Generate AI-powered description for media creation
 * This endpoint helps users generate engaging descriptions for their media content
 */
/**
 * Async function to moderate content after upload
 * This runs in the background and updates the media's moderation status
 * NOTE: This is kept for backward compatibility but is no longer used for new uploads
 */
async function moderateContentAsync(
  mediaId: string,
  mediaData: {
    file: Buffer;
    fileMimeType: string;
    contentType: string;
    title: string;
    description?: string;
  }
): Promise<void> {
  try {
    logger.info("Starting content moderation", { mediaId });

    let transcript = "";
    let videoFrames: string[] = [];

    // For video content, extract audio and frames
    if (mediaData.contentType === "videos" && mediaData.fileMimeType.startsWith("video")) {
      try {
        // Extract audio for transcription
        const audioResult = await mediaProcessingService.extractAudio(
          mediaData.file,
          mediaData.fileMimeType
        );

        // Transcribe audio
        const transcriptionResult = await transcriptionService.transcribeAudio(
          audioResult.audioBuffer,
          "audio/mp3"
        );
        transcript = transcriptionResult.transcript;

        // Extract video frames
        const framesResult = await mediaProcessingService.extractVideoFrames(
          mediaData.file,
          mediaData.fileMimeType,
          3 // Extract 3 key frames
        );
        videoFrames = framesResult.frames;
      } catch (error: any) {
        logger.warn("Media processing failed, continuing with basic moderation:", error);
      }
    }

    // For audio/music content, transcribe
    if (
      (mediaData.contentType === "music" || mediaData.contentType === "audio") &&
      mediaData.fileMimeType.startsWith("audio")
    ) {
      try {
        const transcriptionResult = await transcriptionService.transcribeAudio(
          mediaData.file,
          mediaData.fileMimeType
        );
        transcript = transcriptionResult.transcript;
      } catch (error: any) {
        logger.warn("Transcription failed, continuing with basic moderation:", error);
      }
    }

    // Run moderation
    const moderationResult = await contentModerationService.moderateContent({
      transcript: transcript || undefined,
      videoFrames: videoFrames.length > 0 ? videoFrames : undefined,
      title: mediaData.title,
      description: mediaData.description,
      contentType: mediaData.contentType,
    });

    // Update media with moderation result
    const updateData: any = {
      moderationStatus: moderationResult.isApproved
        ? "approved"
        : moderationResult.requiresReview
          ? "under_review"
          : "rejected",
      moderationResult: {
        ...moderationResult,
        moderatedAt: new Date(),
      },
      isHidden: !moderationResult.isApproved && !moderationResult.requiresReview,
    };

    const media = await Media.findByIdAndUpdate(mediaId, updateData).populate(
      "uploadedBy",
      "firstName lastName email"
    );

    if (!media) {
      logger.error("Media not found after moderation", { mediaId });
      return;
    }

    // Invalidate cache when content becomes publicly visible (approved)
    if (moderationResult.isApproved) {
      await cacheService.delPattern("media:public:all-content*");
    }

    // Get report count
    const reportCount = await MediaReport.countDocuments({
      mediaId: new Types.ObjectId(mediaId),
      status: "pending",
    });

    // Send notifications
    try {
      // Notify admins if content is rejected or needs review
      if (!moderationResult.isApproved || moderationResult.requiresReview || reportCount > 0) {
        const admins = await User.find({ role: "admin" }).select("email");
        const adminEmails = admins.map(admin => admin.email).filter(Boolean);

        if (adminEmails.length > 0) {
          await resendEmailService.sendAdminModerationAlert(
            adminEmails,
            media.title,
            media.contentType,
            (media.uploadedBy as any)?.email || "Unknown",
            moderationResult,
            reportCount
          );
        }

        // Also send in-app notification to admins
        for (const admin of admins) {
          await NotificationService.createNotification({
            userId: admin._id.toString(),
            type: "moderation_alert",
            title: "Content Moderation Alert",
            message: `Content "${media.title}" requires review`,
            metadata: {
              mediaId: mediaId,
              contentType: media.contentType,
              moderationStatus: updateData.moderationStatus,
              reportCount,
            },
            priority: "high",
            relatedId: mediaId,
          });
        }
      }

      // Notify user if content is rejected
      if (!moderationResult.isApproved && !moderationResult.requiresReview) {
        const uploader = media.uploadedBy as any;
        if (uploader && uploader.email) {
          await resendEmailService.sendContentRemovedEmail(
            uploader.email,
            uploader.firstName || "User",
            media.title,
            moderationResult.reason || "Content violates community guidelines",
            moderationResult.flags || []
          );

          // Send in-app notification
          await NotificationService.createNotification({
            userId: uploader._id.toString(),
            type: "content_removed",
            title: "Content Removed",
            message: `Your content "${media.title}" has been removed`,
            metadata: {
              mediaId: mediaId,
              reason: moderationResult.reason,
              flags: moderationResult.flags,
            },
            priority: "high",
            relatedId: mediaId,
          });
        }
      }
    } catch (emailError: any) {
      logger.error("Failed to send moderation notifications:", emailError);
      // Don't fail moderation if email fails
    }

    logger.info("Content moderation completed", {
      mediaId,
      isApproved: moderationResult.isApproved,
      requiresReview: moderationResult.requiresReview,
    });
  } catch (error: any) {
    logger.error("Content moderation error:", error);
    // On error, set to under_review for manual review
    await Media.findByIdAndUpdate(mediaId, {
      moderationStatus: "under_review",
      isHidden: false,
    });
    // Notify admins so they know a video is under review (e.g. moderation failed)
    try {
      const media = await Media.findById(mediaId).populate("uploadedBy", "email firstName lastName").lean();
      const admins = await User.find({ role: "admin" }).select("email").lean();
      const adminEmails = (admins as any[]).map(a => a.email).filter(Boolean);
      if (media && adminEmails.length > 0) {
        const uploadedBy = (media as any).uploadedBy;
        const uploadedByLabel = uploadedBy
          ? `${uploadedBy.firstName || ""} ${uploadedBy.lastName || ""}`.trim() || uploadedBy.email || "Unknown"
          : "Unknown";
        await resendEmailService.sendAdminModerationAlert(
          adminEmails,
          (media as any).title || "Untitled",
          (media as any).contentType || "video",
          uploadedByLabel,
          {
            isApproved: false,
            requiresReview: true,
            reason: "Moderation check failed – manual review required",
            flags: ["moderation_error"],
          },
          0
        );
        logger.info("Admin notified: content under review (moderation error)", { mediaId });
      }
    } catch (emailErr: any) {
      logger.error("Failed to send under-review alert to admins after moderation error", {
        mediaId,
        error: emailErr?.message,
      });
    }
  }
}
