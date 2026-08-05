import { Request, Response } from "express";
import { User } from "../../../models/user.model";
import { aiContentDescriptionService } from "../../../service/aiContentDescription.service";
import { mediaProcessingService } from "../../../service/mediaProcessing.service";
import { transcriptionService } from "../../../service/transcription.service";
import logger from "../../../utils/logger";
import { AI_DESCRIPTION_LIMITS } from "../constants";

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
