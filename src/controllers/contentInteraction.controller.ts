import { Request, Response } from "express";
import { Types } from "mongoose";
import contentInteractionService from "../service/contentInteraction.service";
import logger from "../utils/logger";
import { Bookmark } from "../models/bookmark.model";
import { MediaInteraction } from "../models/mediaInteraction.model";
import { enqueueAnalyticsEvent } from "../queues/enqueue";
import { User } from "../models/user.model";
import resendEmailService from "../service/resendEmail.service";
import { NotificationService } from "../service/notification.service";
import { ReportReason } from "../models/mediaReport.model";

// Toggle like on any content type
export const toggleContentLike = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { contentId, contentType } = req.params;
    const userId = req.userId;

    // Enhanced logging for debugging
    logger.info("Toggle content like request", {
      userId,
      contentId,
      contentType,
      userAgent: req.get("User-Agent"),
      ip: req.ip,
      timestamp: new Date().toISOString(),
    });

    if (!userId) {
      logger.warn("Unauthorized like request - no user ID", {
        contentId,
        contentType,
        ip: req.ip,
      });
      res.status(401).json({
        success: false,
        message: "Authentication required",
        data: null,
      });
      return;
    }

    if (!contentId || !Types.ObjectId.isValid(contentId)) {
      logger.warn("Invalid content ID in like request", {
        userId,
        contentId,
        contentType,
        ip: req.ip,
      });
      res.status(400).json({
        success: false,
        message: `Invalid content ID: ${contentId}`,
        data: {
          contentId,
        },
      });
      return;
    }

    // Note: devotional likes removed - will be separate system in future
    const validContentTypes = [
      "media",
      "artist",
      "merch",
      "ebook",
      "podcast",
    ];
    if (!contentType || !validContentTypes.includes(contentType)) {
      logger.warn("Invalid content type in like request", {
        userId,
        contentId,
        contentType,
        validTypes: validContentTypes,
        ip: req.ip,
      });
      res.status(400).json({
        success: false,
        message: `Invalid content type: ${contentType}`,
        data: {
          contentType,
          validTypes: validContentTypes,
        },
      });
      return;
    }

    // Fast path: Use Redis for optimistic response
    // Return immediately, do DB work in background
    const result = await contentInteractionService.toggleLikeFast(
      userId,
      contentId,
      contentType
    );

    // Enqueue analytics (non-blocking)
    try {
      enqueueAnalyticsEvent({
        name: "content_like_toggled",
        payload: {
          userId,
          contentId,
          contentType,
          liked: result.liked,
          likeCount: result.likeCount,
          createdAt: new Date().toISOString(),
        },
        requestId: (req as any).requestId,
      });
    } catch {
      // Never block on analytics errors
    }

    // Do DB work in background (non-blocking)
    contentInteractionService.toggleLike(
      userId,
      contentId,
      contentType
    ).catch((err) => {
      logger.error("Background like sync failed", {
        userId,
        contentId,
        contentType,
        error: err.message,
      });
    });

    res.status(200).json({
      success: true,
      message: "Like toggled successfully",
      data: {
        liked: result.liked,
        likeCount: result.likeCount,
      },
    });
  } catch (error: any) {
    const { contentId, contentType } = req.params;
    
    logger.error("Toggle content like error", {
      error: error.message,
      stack: error.stack,
      userId: req.userId,
      contentId,
      contentType,
      ip: req.ip,
      timestamp: new Date().toISOString(),
    });

    // Handle specific error types with appropriate status codes
    if (
      error.message.includes("not found") ||
      error.message.includes("Content not found")
    ) {
      res.status(404).json({
        success: false,
        message: `Content not found: ${contentId} (type: ${contentType})`,
        data: {
          contentId,
          contentType,
          exists: false,
        },
      });
      return;
    }

    if (
      error.message.includes("Invalid") ||
      error.message.includes("Unsupported")
    ) {
      const validContentTypes = [
        "media",
        "artist",
        "merch",
        "ebook",
        "podcast",
      ];
      res.status(400).json({
        success: false,
        message: error.message.includes("content type")
          ? `Invalid content type: ${contentType}`
          : error.message,
        data: error.message.includes("content type")
          ? {
              contentType,
              validTypes: validContentTypes,
            }
          : {
              contentId: contentId || undefined,
              contentType: contentType || undefined,
            },
      });
      return;
    }

    // Default to 500 for unexpected errors
    res.status(500).json({
      success: false,
      message: "Internal server error",
      data: {
        error: error.message,
        requestId: (req as any).requestId || undefined,
      },
    });
  }
};

// Add comment to content
export const addContentComment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { contentId, contentType } = req.params;
    const { content, parentCommentId } = req.body;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    if (!contentId || !Types.ObjectId.isValid(contentId)) {
      res.status(400).json({
        success: false,
        message: "Invalid content ID",
      });
      return;
    }

    // Accept ebook and podcast for backwards compatibility (they're normalized to "media" internally)
    const validCommentContentTypes = ["media", "devotional", "ebook", "podcast"];
    if (!contentType || !validCommentContentTypes.includes(contentType)) {
      res.status(400).json({
        success: false,
        message: "Comments not supported for this content type",
      });
      return;
    }

    if (!content || content.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: "Comment content is required",
      });
      return;
    }

    const comment = await contentInteractionService.addComment(
      userId,
      contentId,
      contentType,
      content,
      parentCommentId
    );

    enqueueAnalyticsEvent({
      name: "content_commented",
      payload: {
        userId,
        contentId,
        contentType,
        parentCommentId: parentCommentId || null,
        commentId: comment?._id,
        createdAt: new Date().toISOString(),
      },
      requestId: (req as any).requestId,
    });

    res.status(201).json({
      success: true,
      message: "Comment added successfully",
      data: comment,
    });
  } catch (error: any) {
    logger.error("Add content comment error", {
      error: error.message,
      userId: req.userId,
      contentId: req.params.contentId,
      contentType: req.params.contentType,
    });

    if (error.message.includes("not found")) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
      return;
    }

    if (error.message.includes("not supported")) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Failed to add comment",
    });
  }
};

// Get content metadata for frontend UI
export const getContentMetadata = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { contentId, contentType } = req.params;
    const userId = req.userId; // Optional, for user-specific interactions

    if (!contentId || !Types.ObjectId.isValid(contentId)) {
      res.status(400).json({
        success: false,
        message: "Invalid content ID",
      });
      return;
    }

    if (
      !contentType ||
      !["media", "devotional", "artist", "merch", "ebook", "podcast"].includes(
        contentType
      )
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid content type",
      });
      return;
    }

    // Ensure userId is valid before passing to service
    const validUserId = userId && Types.ObjectId.isValid(userId) ? userId : "";

    const metadata = await contentInteractionService.getContentMetadata(
      validUserId,
      contentId,
      contentType
    );

    // Fetch bookmark count if content type supports it
    let bookmarkCount = 0;
    if (["media", "ebook", "podcast", "merch"].includes(contentType)) {
      try {
        bookmarkCount = await Bookmark.countDocuments({
          media: new Types.ObjectId(contentId),
        });
      } catch (error) {
        // Ignore bookmark count errors
      }
    }

    // hasViewed is optional; we only compute it when authenticated (within the current dedupe window).
    // This avoids inflating DB queries for public traffic.
    let hasViewed = false;
    if (validUserId && Types.ObjectId.isValid(validUserId) && Types.ObjectId.isValid(contentId)) {
      try {
        const { ViewEvent } = await import("../models/viewEvent.model");
        const VIEW_DEDUPE_WINDOW_MS = 60 * 60 * 1000;
        const windowKey = Math.floor(Date.now() / VIEW_DEDUPE_WINDOW_MS);
        const view = await ViewEvent.findOne({
          userId: new Types.ObjectId(validUserId),
          contentId: new Types.ObjectId(contentId),
          contentType,
          windowKey,
        })
          .select("_id")
          .lean();
        hasViewed = !!view;
      } catch (error) {
        logger.warn("Error checking hasViewed in metadata", {
          error: error instanceof Error ? error.message : String(error),
          userId: validUserId,
          contentId,
        });
      }
    }

    // Format response to match documentation spec
    res.status(200).json({
      success: true,
      data: {
        contentId: metadata.id,
        likes: metadata.stats?.likes || 0,
        saves: bookmarkCount || 0,
        shares: metadata.stats?.shares || 0,
        views: metadata.stats?.views || 0,
        comments: metadata.stats?.comments || 0,
        userInteractions: {
          liked: metadata.userInteraction?.hasLiked || false,
          saved: metadata.userInteraction?.hasBookmarked || false,
          shared: metadata.userInteraction?.hasShared || false,
          viewed: hasViewed,
        },
      },
    });
  } catch (error: any) {
    logger.error("Get content metadata error", {
      error: error.message,
      userId: req.userId,
      contentId: req.params.contentId,
      contentType: req.params.contentType,
    });

    if (error.message.includes("not found")) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Failed to get content metadata",
    });
  }
};

// Record a view/listen/read event with dedupe and thresholding
export const recordContentView = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { contentId, contentType } = req.params;
    const { durationMs, progressPct, isComplete, source, sessionId, deviceId } =
      req.body || {};
    const userId = req.userId; // Optional (auth is optional on this endpoint)

    if (!contentId || !Types.ObjectId.isValid(contentId)) {
      res.status(400).json({ success: false, message: "Invalid content ID" });
      return;
    }
    const validTypes = [
      "media",
      "devotional",
      "artist",
      "merch",
      "ebook",
      "podcast",
    ];
    if (!contentType || !validTypes.includes(contentType)) {
      res.status(400).json({ success: false, message: "Invalid content type" });
      return;
    }

    // Delegate to service method
    const { default: contentService } = await import(
      "../service/contentView.service"
    );
    const result = await contentService.recordView({
      userId,
      contentId,
      contentType: contentType as any,
      durationMs: typeof durationMs === "number" ? durationMs : undefined,
      progressPct: typeof progressPct === "number" ? progressPct : undefined,
      isComplete: !!isComplete,
      source: typeof source === "string" ? source : undefined,
      sessionId: typeof sessionId === "string" ? sessionId : undefined,
      deviceId: typeof deviceId === "string" ? deviceId : undefined,
      ip: req.ip,
      userAgent: req.get("User-Agent") || "",
    });

    res.status(200).json({
      success: true,
      data: {
        contentId: result.contentId,
        viewCount: result.viewCount,
        hasViewed: result.hasViewed,
        counted: result.counted,
      },
    });
  } catch (error: any) {
    logger.error("Record content view error", {
      error: error.message,
      userId: req.userId,
      contentId: req.params.contentId,
      contentType: req.params.contentType,
    });

    // Handle specific error types
    if (error.message.includes("not found") || error.message.includes("Content not found")) {
      res.status(404).json({
        success: false,
        message: "Content not found",
      });
      return;
    }

    res.status(500).json({ success: false, message: "Failed to record view" });
  }
};

// Batch metadata for multiple content IDs
export const getBatchContentMetadata = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId;
    const { contentIds, contentType } = req.body || {};

    if (!Array.isArray(contentIds) || contentIds.length === 0) {
      res.status(400).json({
        success: false,
        message: "contentIds must be a non-empty array",
      });
      return;
    }

    if (
      contentType &&
      !["media", "devotional", "artist", "merch", "ebook", "podcast"].includes(
        contentType
      )
    ) {
      res.status(400).json({ success: false, message: "Invalid content type" });
      return;
    }

    const data = await contentInteractionService.getBatchContentMetadata(
      userId,
      contentIds,
      contentType || "media"
    );

    // Transform array to object map with contentId as key (per spec)
    const metadataMap: Record<string, any> = {};
    (data || []).forEach((item) => {
      metadataMap[item.id] = {
        contentId: item.id,
        likes: item.likeCount || 0,
        saves: item.bookmarkCount || 0,
        shares: item.shareCount || 0,
        views: item.viewCount || 0,
        comments: item.commentCount || 0,
        userInteractions: {
          liked: !!item.hasLiked,
          saved: !!item.hasBookmarked,
          shared: !!item.hasShared,
          viewed: !!item.hasViewed,
        },
      };
    });

    res.status(200).json({
      success: true,
      data: metadataMap,
    });
  } catch (error: any) {
    logger.error("Batch content metadata error", {
      error: error.message,
      userId: req.userId,
    });
    res
      .status(500)
      .json({ success: false, message: "Failed to get batch metadata" });
  }
};

// Get paginated list of users who liked content
export const getContentLikers = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { contentId, contentType } = req.params;
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limitRaw = parseInt(req.query.limit as string) || 20;
    const limit = Math.min(Math.max(limitRaw, 1), 50);

    if (!contentId || !Types.ObjectId.isValid(contentId)) {
      res.status(400).json({ success: false, message: "Invalid content ID" });
      return;
    }
    if (
      !contentType ||
      !["media", "devotional", "ebook", "podcast"].includes(contentType)
    ) {
      res.status(400).json({ success: false, message: "Invalid content type" });
      return;
    }

    const result = await contentInteractionService.getContentLikers(
      contentId,
      contentType,
      page,
      limit
    );

    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    logger.error("Get content likers error", {
      error: error.message,
      contentId: req.params.contentId,
      contentType: req.params.contentType,
    });
    res.status(500).json({ success: false, message: "Failed to get likers" });
  }
};

// Remove comment
export const removeContentComment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { commentId } = req.params;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    if (!commentId || !Types.ObjectId.isValid(commentId)) {
      res.status(400).json({
        success: false,
        message: "Invalid comment ID",
      });
      return;
    }

    await contentInteractionService.removeContentComment(commentId, userId);

    res.status(200).json({
      success: true,
      message: "Comment removed successfully",
    });
  } catch (error: any) {
    logger.error("Remove content comment error", {
      error: error.message,
      userId: req.userId,
      commentId: req.params.commentId,
    });

    if (
      error.message.includes("not found") ||
      error.message.includes("permission")
    ) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Failed to remove comment",
    });
  }
};

// Get comments for content
export const getContentComments = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { contentId, contentType } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const sortBy = (req.query.sortBy as string) || "newest";
    const userId = req.userId; // Optional, for isLiked field

    // Support contentKey alias for backwards compatibility (e.g., reels with synthetic IDs)
    // If contentId is not a valid ObjectId, try to resolve it via contentKey lookup
    let resolvedContentId = contentId;
    if (!Types.ObjectId.isValid(contentId)) {
      // Try to resolve via contentKey - this is a fallback for older clients
      // The preferred fix is ensuring clients send real ObjectIds
      logger.warn("Non-ObjectId contentId received, attempting resolution", {
        contentId,
        contentType,
      });
      // For now, reject non-ObjectId to maintain data integrity
      // Backend should ensure all content has ObjectIds
      res.status(400).json({
        success: false,
        message: "Invalid content ID format. Content ID must be a valid ObjectId.",
      });
      return;
    }

    if (!contentType || !["media", "devotional", "ebook"].includes(contentType)) {
      res.status(400).json({
        success: false,
        message: "Comments not supported for this content type",
      });
      return;
    }

    const result = await contentInteractionService.getContentComments(
      resolvedContentId,
      contentType,
      page,
      limit,
      sortBy === "oldest" || sortBy === "top" ? sortBy : "newest",
      userId // Pass userId for isLiked calculation
    );

    // Generate ETag for caching (based on contentId, page, limit, sortBy)
    const etag = `"${resolvedContentId}-${page}-${limit}-${sortBy}"`;
    res.setHeader("ETag", etag);
    
    // Check If-None-Match header for 304 Not Modified
    const ifNoneMatch = req.headers["if-none-match"];
    if (ifNoneMatch === etag) {
      res.status(304).end();
      return;
    }

    // Set cache headers
    // Public caching for unauthenticated requests, private for authenticated
    if (userId) {
      res.setHeader("Cache-Control", "private, max-age=10, stale-while-revalidate=30");
      res.setHeader("Vary", "Authorization");
    } else {
      res.setHeader("Cache-Control", "public, max-age=15, stale-while-revalidate=60");
    }

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error("Get content comments error", {
      error: error.message,
      contentId: req.params.contentId,
      contentType: req.params.contentType,
    });

    if (error.message.includes("not found")) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
      return;
    }

    if (error.message.includes("Invalid")) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Failed to get comments",
    });
  }
};

// Get replies for a comment
export const getCommentReplies = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { commentId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!commentId || !Types.ObjectId.isValid(commentId)) {
      res.status(400).json({ success: false, message: "Invalid comment ID" });
      return;
    }

    const data = await contentInteractionService.getCommentReplies(
      commentId,
      page,
      limit
    );

    res.status(200).json({ success: true, data });
  } catch (error: any) {
    logger.error("Get comment replies error", { error: error.message });
    res
      .status(500)
      .json({ success: false, message: "Failed to get comment replies" });
  }
};

// Edit comment
export const editContentComment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    if (!commentId || !Types.ObjectId.isValid(commentId)) {
      res.status(400).json({ success: false, message: "Invalid comment ID" });
      return;
    }
    if (!content || content.trim().length === 0) {
      res
        .status(400)
        .json({ success: false, message: "Comment content is required" });
      return;
    }

    const updated = await contentInteractionService.editContentComment(
      commentId,
      userId,
      content
    );
    res
      .status(200)
      .json({ success: true, message: "Comment updated", data: updated });
  } catch (error: any) {
    logger.error("Edit comment error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to edit comment" });
  }
};

// Report comment
export const reportContentComment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { commentId } = req.params;
    const { reason, description } = req.body as { reason?: ReportReason; description?: string };
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    if (!commentId || !Types.ObjectId.isValid(commentId)) {
      res.status(400).json({ success: false, message: "Invalid comment ID" });
      return;
    }

    // Validate reason if provided
    const validReasons: ReportReason[] = [
      "inappropriate_content",
      "non_gospel_content",
      "explicit_language",
      "violence",
      "sexual_content",
      "blasphemy",
      "spam",
      "copyright",
      "other",
    ];
    const reportReason = reason || "other";
    if (!validReasons.includes(reportReason)) {
      res.status(400).json({
        success: false,
        message: "Invalid report reason",
      });
      return;
    }

    // Report the comment (service handles validation for self-reporting and duplicates)
    const result = await contentInteractionService.reportContentComment(
      commentId,
      userId,
      reportReason
    );

    // Get reporter information
    const reporter = await User.findById(userId).select("firstName lastName email username");
    const reporterName = reporter
      ? `${reporter.firstName || ""} ${reporter.lastName || ""}`.trim() || reporter.username || reporter.email
      : "Unknown User";

    // Send email notification to admins on EVERY report
    try {
      const admins = await User.find({ role: "admin" }).select("email _id");
      const adminEmails = admins.map((admin) => admin.email).filter(Boolean);
      
      // Always include support@jevahapp.com in the recipient list
      const supportEmail = "support@jevahapp.com";
      const allRecipientEmails = [...new Set([...adminEmails, supportEmail])];

      if (allRecipientEmails.length > 0) {
        // Send email notification
        await resendEmailService.sendAdminCommentReportNotification(
          allRecipientEmails,
          result.comment.content,
          result.media.title,
          result.media.contentType,
          result.comment.authorEmail,
          result.comment.authorName,
          reporterName,
          reportReason,
          description,
          commentId,
          result.media.id,
          result.reportCount
        );

        // Send in-app notification to all admins
        for (const admin of admins) {
          try {
            await NotificationService.createNotification({
              userId: admin._id.toString(),
              type: "content_report",
              title: "New Comment Report",
              message: `${reporterName} reported a comment on "${result.media.title}" - Reason: ${reportReason}`,
              metadata: {
                commentId: commentId,
                mediaId: result.media.id,
                contentType: result.media.contentType,
                reportReason: reportReason,
                reportCount: result.reportCount,
                reporterName,
                commentAuthor: result.comment.authorName,
              },
              priority: result.reportCount >= 3 ? "high" : "medium",
              relatedId: commentId,
            });
          } catch (notifError) {
            logger.error("Failed to send in-app notification to admin:", notifError);
          }
        }

        logger.info("Admin notifications sent for comment report", {
          commentId,
          mediaId: result.media.id,
          adminCount: admins.length,
          totalRecipientCount: allRecipientEmails.length,
          recipientEmails: allRecipientEmails,
          reportCount: result.reportCount,
        });
      }
    } catch (emailError) {
      logger.error("Failed to send admin notifications for comment report:", emailError);
      // Don't fail the report submission if email fails
    }

    // If report count reaches threshold (3+), also send moderation alert
    if (result.reportCount >= 3) {
      try {
        const admins = await User.find({ role: "admin" }).select("email");
        const adminEmails = admins.map((admin) => admin.email).filter(Boolean);
        
        // Always include support@jevahapp.com in the recipient list
        const supportEmail = "support@jevahapp.com";
        const allRecipientEmails = [...new Set([...adminEmails, supportEmail])];

        if (allRecipientEmails.length > 0) {
          await resendEmailService.sendAdminModerationAlert(
            allRecipientEmails,
            result.media.title,
            result.media.contentType,
            result.media.uploaderEmail,
            {
              isApproved: false,
              confidence: 0.7,
              reason: `Comment has been reported ${result.reportCount} times`,
              flags: ["multiple_reports", "comment_report"],
              requiresReview: true,
            },
            result.reportCount
          );
        }
      } catch (thresholdEmailError) {
        logger.error("Failed to send threshold alert for comment:", thresholdEmailError);
      }
    }

    logger.info("Comment reported", {
      commentId,
      userId,
      reason: reportReason,
      reportCount: result.reportCount,
    });

    res.status(200).json({
      success: true,
      message: "Comment reported successfully",
      data: {
        reportCount: result.reportCount,
        commentId,
      },
    });
  } catch (error: any) {
    logger.error("Report comment error", { error: error.message });

    // Handle specific validation errors
    if (error.message === "You cannot report your own comment") {
      res.status(400).json({
        success: false,
        message: "You cannot report your own comment",
      });
      return;
    }

    if (error.message === "You have already reported this comment") {
      res.status(400).json({
        success: false,
        message: "You have already reported this comment",
      });
      return;
    }

    if (error.message === "Comment not found" || error.message === "Invalid comment ID") {
      res.status(404).json({
        success: false,
        message: "Comment not found",
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Failed to report comment",
    });
  }
};

// Hide comment (moderator/admin)
export const hideContentComment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { commentId } = req.params;
    const { reason } = req.body || {};
    const userId = req.userId;
    const role = req.user?.role;

    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    if (!commentId || !Types.ObjectId.isValid(commentId)) {
      res.status(400).json({ success: false, message: "Invalid comment ID" });
      return;
    }
    if (!role || !["admin", "moderator"].includes(role as any)) {
      res.status(403).json({ success: false, message: "Forbidden" });
      return;
    }

    await contentInteractionService.moderateHideComment(
      commentId,
      userId,
      reason
    );
    res.status(200).json({ success: true, message: "Comment hidden" });
  } catch (error: any) {
    logger.error("Hide comment error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to hide comment" });
  }
};

// Share content
export const shareContent = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { contentId, contentType } = req.params;
    const { platform, message } = req.body;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    if (!contentId || !Types.ObjectId.isValid(contentId)) {
      res.status(400).json({
        success: false,
        message: "Invalid content ID",
      });
      return;
    }

    if (
      !contentType ||
      !["media", "devotional", "artist", "merch", "ebook", "podcast"].includes(
        contentType
      )
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid content type",
      });
      return;
    }

    // Use contentInteractionService to track share and get shareCount
    const result = await contentInteractionService.shareContent(
      userId,
      contentId,
      contentType,
      platform
    );

    enqueueAnalyticsEvent({
      name: "content_shared",
      payload: {
        userId,
        contentId,
        contentType,
        platform,
        message: message || null,
        shareCount: result.shareCount,
        createdAt: new Date().toISOString(),
      },
      requestId: (req as any).requestId,
    });

    res.status(200).json({
      success: true,
      message: "Content shared successfully",
      data: {
        shareCount: result.shareCount,
        platform,
        contentType,
      },
    });
  } catch (error: any) {
    logger.error("Share content error", {
      error: error.message,
      userId: req.userId,
      contentId: req.params.contentId,
      contentType: req.params.contentType,
    });

    if (error.message.includes("not found")) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Failed to share content",
    });
  }
};
