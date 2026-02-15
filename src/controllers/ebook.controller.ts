import { Request, Response } from "express";
import ebookService from "../service/ebook.service";
import logger from "../utils/logger";
import { Media } from "../models/media.model";
import textToSpeechService, { TTSOptions } from "../service/textToSpeech.service";

/**
 * Get text from ebook PDF
 * @route GET /api/ebooks/text
 * @query url - Direct PDF URL
 * @query contentId - Content ID to resolve to PDF URL
 * @query normalize - Whether to normalize text with Gemini AI (default: false)
 */
export const getEbookText = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { url, contentId, normalize } = request.query;

    // Validate input
    if (!url && !contentId) {
      response.status(400).json({
        success: false,
        message: "Either 'url' or 'contentId' parameter is required",
      });
      return;
    }

    // Resolve PDF URL
    let pdfUrl: string;

    if (contentId) {
      // Find content by ID and get PDF URL
      const content = await Media.findById(contentId);

      if (!content) {
        response.status(404).json({
          success: false,
          message: "Content not found",
        });
        return;
      }

      // Check if content has a PDF URL or file URL
      if (content.pdfUrl) {
        pdfUrl = content.pdfUrl;
      } else if (content.fileUrl) {
        pdfUrl = content.fileUrl;
      } else {
        response.status(400).json({
          success: false,
          message: "Content does not have a PDF URL",
        });
        return;
      }
    } else {
      pdfUrl = url as string;
    }

    // Validate URL
    if (!pdfUrl.startsWith("http://") && !pdfUrl.startsWith("https://")) {
      response.status(400).json({
        success: false,
        message: "Invalid PDF URL",
      });
      return;
    }

    // Parse normalize parameter
    const shouldNormalize = normalize === "true" || normalize === "1";

    logger.info("Extracting ebook text", {
      contentId,
      url: pdfUrl,
      normalize: shouldNormalize,
      userId: request.userId || "anonymous",
    });

    // Get ebook text
    const ebookData = await ebookService.getEbookText(pdfUrl, shouldNormalize);

    // Set cache headers
    response.setHeader("Cache-Control", "private, max-age=300");

    response.status(200).json({
      success: true,
      data: ebookData,
    });
  } catch (error) {
    logger.error("Get ebook text error", {
      error: (error as Error).message,
      stack: (error as Error).stack,
      userId: request.userId || "anonymous",
    });

    // Determine appropriate error status
    const errorMessage = (error as Error).message;
    let statusCode = 500;

    if (errorMessage.includes("download")) {
      statusCode = 400;
    } else if (errorMessage.includes("not found")) {
      statusCode = 404;
    }

    response.status(statusCode).json({
      success: false,
      message: "Failed to extract ebook text",
      error: process.env.NODE_ENV === "development" ? errorMessage : undefined,
    });
  }
};

/**
 * Render TTS audio for ebook (optional)
 * @route POST /api/tts/render
 * @body contentId - Content ID
 * @body pages - Array of page objects with page number and text
 * @body voiceId - Voice ID for TTS
 * @body language - Language code (e.g., "en-US")
 * @body speed - Playback speed (default: 1.0)
 * @body pitch - Voice pitch (default: 0)
 * @body format - Audio format (default: "mp3")
 * @body cache - Whether to cache the audio (default: true)
 */
export const renderTTS = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const {
      contentId,
      pages,
      voiceId = "en-US-female-1",
      language = "en-US",
      speed = 1.0,
      pitch = 0,
      format = "mp3",
      cache = true,
    } = request.body;

    // Validate input
    if (!contentId) {
      response.status(400).json({
        success: false,
        message: "'contentId' is required",
      });
      return;
    }

    if (!pages || !Array.isArray(pages) || pages.length === 0) {
      response.status(400).json({
        success: false,
        message: "'pages' must be a non-empty array",
      });
      return;
    }

    // Validate pages structure
    for (const page of pages) {
      if (typeof page.page !== "number" || typeof page.text !== "string") {
        response.status(400).json({
          success: false,
          message: "Each page must have 'page' (number) and 'text' (string)",
        });
        return;
      }
    }

    logger.info("TTS render request", {
      contentId,
      pageCount: pages.length,
      voiceId,
      language,
      userId: request.userId || "anonymous",
    });

    // Render TTS
    const renderResult = await ebookService.renderTTS({
      contentId,
      pages,
      voiceId,
      language,
      speed: Number(speed),
      pitch: Number(pitch),
      format,
      cache: Boolean(cache),
    });

    // Determine status code based on result
    const statusCode = renderResult.status === "completed" ? 200 : 202;

    response.status(statusCode).json({
      success: true,
      data: renderResult,
    });
  } catch (error) {
    logger.error("TTS render error", {
      error: (error as Error).message,
      stack: (error as Error).stack,
      userId: request.userId || "anonymous",
    });

    response.status(500).json({
      success: false,
      message: "Failed to render TTS",
      error:
        process.env.NODE_ENV === "development"
          ? (error as Error).message
          : undefined,
    });
  }
};

/**
 * Get TTS job status (for async rendering)
 * @route GET /api/tts/status/:jobId
 * @param jobId - Job ID
 */
export const getTTSStatus = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { jobId } = request.params;

    if (!jobId) {
      response.status(400).json({
        success: false,
        message: "'jobId' parameter is required",
      });
      return;
    }

    logger.info("TTS status request", {
      jobId,
      userId: request.userId || "anonymous",
    });

    // Get job status
    const status = await ebookService.getTTSJobStatus(jobId);

    response.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error("TTS status error", {
      error: (error as Error).message,
      jobId: request.params.jobId,
      userId: request.userId || "anonymous",
    });

    response.status(500).json({
      success: false,
      message: "Failed to get TTS status",
      error:
        process.env.NODE_ENV === "development"
          ? (error as Error).message
          : undefined,
    });
  }
};

/**
 * Generate TTS audio for ebook (auto-generate when ebook is opened)
 * @route POST /api/ebooks/:ebookId/tts/generate
 * @route GET /api/ebooks/:ebookId/tts (if TTS already exists, return it)
 * @param ebookId - Media ID of the ebook
 * @query voice - Voice type: "male" | "female" | "custom" (default: "female")
 * @query voiceName - Custom voice name (optional)
 * @query languageCode - Language code (default: "en-US")
 * @query speed - Speaking rate 0.25-4.0 (default: 1.0)
 * @query pitch - Pitch -20.0 to 20.0 (default: 0)
 */
export const generateEbookTTS = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { ebookId } = request.params;
    const {
      voice = "female",
      voiceName,
      languageCode = "en-US",
      speed = "1.0",
      pitch = "0",
    } = request.query;

    // Validate ebookId
    if (!ebookId) {
      response.status(400).json({
        success: false,
        message: "ebookId parameter is required",
      });
      return;
    }

    // Find the ebook
    const ebook = await Media.findById(ebookId);

    if (!ebook) {
      response.status(404).json({
        success: false,
        message: "Ebook not found",
      });
      return;
    }

    // Check if it's an ebook
    if (ebook.contentType !== "ebook" && ebook.contentType !== "books") {
      response.status(400).json({
        success: false,
        message: "Content is not an ebook",
      });
      return;
    }

    // Check if TTS already exists and is recent (within 7 days)
    // Also check if config matches (voice, speed, pitch, language)
    if (ebook.ttsAudioUrl && ebook.ttsGeneratedAt) {
      const daysSinceGeneration =
        (Date.now() - ebook.ttsGeneratedAt.getTime()) / (1000 * 60 * 60 * 24);
      
      // Check if config matches
      const voiceId = voiceName || `${languageCode}-${voice}-1`;
      const configMatches = 
        ebook.ttsVoice === voiceId &&
        ebook.ttsLanguageCode === languageCode;

      if (daysSinceGeneration < 7 && configMatches) {
        logger.info("Returning existing TTS audio", {
          ebookId,
          ttsAudioUrl: ebook.ttsAudioUrl,
        });

        // Regenerate timings if needed (they're not stored in DB, generated on-demand)
        // For now, return without timings - frontend can request them separately if needed
        // Or we can regenerate them here (slower but complete)
        
        // For performance, we'll return basic info and let frontend request full data
        // Or we can generate timings here if requested
        const includeTimings = request.query.includeTimings === "true";
        
        if (includeTimings) {
          // Regenerate timings by extracting text and generating TTS again (cached)
          // This is expensive, so we'll do it only if requested
          try {
            const ebookText = await ebookService.getEbookText(ebook.fileUrl, true);
            const fullText = ebookText.pages.map(p => p.text).join("\n\n").trim();
            
            const ttsOptions: TTSOptions = {
              voice: voice as "male" | "female" | "custom",
              voiceName: voiceName as string | undefined,
              languageCode: languageCode as string,
              speakingRate: parseFloat(speed as string) || 1.0,
              pitch: parseFloat(pitch as string) || 0,
              audioEncoding: "MP3",
            };

            // Generate timings only (reuse existing audio)
            const ttsResult = await textToSpeechService.synthesizeEbook(
              fullText,
              ttsOptions,
              true // include timings
            );

            response.status(200).json({
              success: true,
              data: {
                audioUrl: ebook.ttsAudioUrl,
                durationMs: ttsResult.durationMs,
                generatedAt: ebook.ttsGeneratedAt.toISOString(),
                cached: true,
                textHash: ttsResult.textHash,
                ttsConfig: ttsResult.ttsConfig,
                timings: ttsResult.timings,
              },
            });
            return;
          } catch (timingError) {
            logger.warn("Failed to regenerate timings, returning without", {
              error: (timingError as Error).message,
            });
          }
        }

        // Return without timings (frontend can request separately)
        response.status(200).json({
          success: true,
          data: {
            audioUrl: ebook.ttsAudioUrl,
            voice: ebook.ttsVoice,
            languageCode: ebook.ttsLanguageCode,
            generatedAt: ebook.ttsGeneratedAt.toISOString(),
            cached: true,
            // Note: timings not included - request with ?includeTimings=true
          },
        });
        return;
      }
    }

    // Check if TTS service is available
    if (!textToSpeechService.isAvailable()) {
      const hasAzureEnv =
        !!process.env.AZURE_TTS_KEY && !!process.env.AZURE_TTS_REGION;

      response.status(503).json({
        success: false,
        message:
          "TTS service is not available. Please configure AZURE_TTS_KEY and AZURE_TTS_REGION environment variables and restart/redeploy the backend service. See AZURE_TTS_SETUP.md for setup instructions.",
        code: "TTS_SERVICE_UNAVAILABLE",
        // Safe to expose booleans to help diagnose deployment config issues
        details: {
          hasAzureEnv,
          azureKeySet: !!process.env.AZURE_TTS_KEY,
          azureRegionSet: !!process.env.AZURE_TTS_REGION,
          nodeEnv: process.env.NODE_ENV || null,
        },
      });
      return;
    }

    logger.info("Generating TTS for ebook", {
      ebookId,
      title: ebook.title,
      voice,
      languageCode,
      userId: request.userId || "anonymous",
    });

    // Extract text from ebook
    const ebookUrl = ebook.fileUrl;
    if (!ebookUrl) {
      response.status(400).json({
        success: false,
        message: "Ebook does not have a file URL",
      });
      return;
    }

    // Get ebook text
    const ebookText = await ebookService.getEbookText(ebookUrl, true); // Normalize for TTS

    // Combine all pages into full text
    const fullText = ebookText.pages
      .map(page => page.text)
      .join("\n\n")
      .trim();

    if (!fullText || fullText.length === 0) {
      response.status(400).json({
        success: false,
        message: "Could not extract text from ebook",
      });
      return;
    }

    // Prepare TTS options
    const ttsOptions: TTSOptions = {
      voice: voice as "male" | "female" | "custom",
      voiceName: voiceName as string | undefined,
      languageCode: languageCode as string,
      speakingRate: parseFloat(speed as string) || 1.0,
      pitch: parseFloat(pitch as string) || 0,
      audioEncoding: "MP3",
    };

    // Generate TTS audio
    const ttsResult = await textToSpeechService.synthesizeEbook(
      fullText,
      ttsOptions
    );

    // Update ebook with TTS audio URL and metadata
    const voiceId = voiceName || `${languageCode}-${voice}-1`;
    await Media.findByIdAndUpdate(ebookId, {
      ttsAudioUrl: ttsResult.audioUrl,
      ttsAudioObjectKey: ttsResult.objectKey,
      ttsVoice: voiceId,
      ttsLanguageCode: languageCode as string,
      ttsGeneratedAt: new Date(),
    });

    logger.info("TTS generated and saved for ebook", {
      ebookId,
      audioUrl: ttsResult.audioUrl,
      durationMs: ttsResult.durationMs,
      segmentCount: ttsResult.timings?.segments.length || 0,
    });

    response.status(200).json({
      success: true,
      data: {
        audioUrl: ttsResult.audioUrl,
        durationMs: ttsResult.durationMs,
        generatedAt: new Date().toISOString(),
        cached: false,
        textHash: ttsResult.textHash,
        ttsConfig: ttsResult.ttsConfig,
        timings: ttsResult.timings,
      },
    });
  } catch (error) {
    logger.error("Failed to generate ebook TTS", {
      error: (error as Error).message,
      stack: (error as Error).stack,
      ebookId: request.params.ebookId,
      userId: request.userId || "anonymous",
    });

    // Check for specific credential errors
    const errorMessage = (error as Error).message;
    const isCredentialError = 
      errorMessage.includes("Azure TTS is not configured") ||
      errorMessage.includes("AZURE_TTS_KEY") ||
      errorMessage.includes("AZURE_TTS_REGION") ||
      errorMessage.includes("TTS service is not available");

    const userMessage = isCredentialError
      ? "TTS service is not properly configured. Please configure AZURE_TTS_KEY and AZURE_TTS_REGION environment variables."
      : "Failed to generate TTS audio";

    response.status(500).json({
      success: false,
      message: userMessage,
      code: isCredentialError ? "TTS_CREDENTIALS_ERROR" : "TTS_GENERATION_ERROR",
      error:
        process.env.NODE_ENV === "development"
          ? errorMessage
          : undefined,
    });
  }
};

/**
 * Get TTS audio URL for ebook (if exists)
 * @route GET /api/ebooks/:ebookId/tts
 * @param ebookId - Media ID of the ebook
 */
/**
 * Check TTS provider configuration status
 * @route GET /api/ebooks/tts/config
 */
export const getTTSConfig = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const azureKeySet = !!process.env.AZURE_TTS_KEY;
    const azureRegionSet = !!process.env.AZURE_TTS_REGION;
    const azureEndpointSet = !!process.env.AZURE_TTS_ENDPOINT;
    const ttsProvider = process.env.TTS_PROVIDER || "auto";
    
    const isAvailable = textToSpeechService.isAvailable();
    
    response.status(200).json({
      success: true,
      data: {
        available: isAvailable,
        provider: ttsProvider,
        azure: {
          configured: azureKeySet && azureRegionSet,
          keySet: azureKeySet,
          regionSet: azureRegionSet,
          endpointSet: azureEndpointSet,
          region: azureRegionSet ? process.env.AZURE_TTS_REGION : null,
        },
        message: isAvailable 
          ? "TTS service is available" 
          : "TTS service is not available. Please configure AZURE_TTS_KEY and AZURE_TTS_REGION environment variables and restart/redeploy the service.",
      },
    });
  } catch (error) {
    logger.error("Failed to get TTS config", {
      error: (error as Error).message,
    });

    response.status(500).json({
      success: false,
      message: "Failed to retrieve TTS configuration",
    });
  }
};

export const getEbookTTS = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { ebookId } = request.params;

    const ebook = await Media.findById(ebookId).select(
      "ttsAudioUrl ttsVoice ttsLanguageCode ttsGeneratedAt contentType"
    );

    if (!ebook) {
      response.status(404).json({
        success: false,
        message: "Ebook not found",
      });
      return;
    }

    if (ebook.contentType !== "ebook" && ebook.contentType !== "books") {
      response.status(400).json({
        success: false,
        message: "Content is not an ebook",
      });
      return;
    }

    if (!ebook.ttsAudioUrl) {
      response.status(404).json({
        success: false,
        message: "TTS audio not generated for this ebook",
        data: {
          canGenerate: true,
        },
      });
      return;
    }

    // Check if timings are requested
    const includeTimings = request.query.includeTimings === "true";

    if (includeTimings) {
      // Regenerate timings by extracting text
      try {
        const ebookText = await ebookService.getEbookText(ebook.fileUrl, true);
        const fullText = ebookText.pages.map(p => p.text).join("\n\n").trim();

        // Parse voice config from stored voice name
        const voiceMatch = ebook.ttsVoice?.match(/^([a-z]{2}-[A-Z]{2})-(male|female|custom)(?:-(\d+))?$/i);
        const voiceType = voiceMatch ? (voiceMatch[2].toLowerCase() as "male" | "female" | "custom") : "female";
        const languageCode = voiceMatch ? voiceMatch[1] : ebook.ttsLanguageCode || "en-US";

        const ttsOptions: TTSOptions = {
          voice: voiceType,
          languageCode,
          audioEncoding: "MP3",
        };

        const ttsResult = await textToSpeechService.synthesizeEbook(
          fullText,
          ttsOptions,
          true // include timings
        );

        response.status(200).json({
          success: true,
          data: {
            audioUrl: ebook.ttsAudioUrl,
            durationMs: ttsResult.durationMs,
            generatedAt: ebook.ttsGeneratedAt?.toISOString(),
            textHash: ttsResult.textHash,
            ttsConfig: ttsResult.ttsConfig,
            timings: ttsResult.timings,
          },
        });
        return;
      } catch (timingError) {
        logger.warn("Failed to generate timings", {
          error: (timingError as Error).message,
        });
        // Fall through to return without timings
      }
    }

    response.status(200).json({
      success: true,
      data: {
        audioUrl: ebook.ttsAudioUrl,
        voice: ebook.ttsVoice,
        languageCode: ebook.ttsLanguageCode,
        generatedAt: ebook.ttsGeneratedAt?.toISOString(),
        // Note: timings not included - request with ?includeTimings=true
      },
    });
  } catch (error) {
    logger.error("Failed to get ebook TTS", {
      error: (error as Error).message,
      ebookId: request.params.ebookId,
    });

    response.status(500).json({
      success: false,
      message: "Failed to retrieve TTS audio",
    });
  }
};






















