"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTTSStatus = exports.renderTTS = exports.getEbookText = void 0;
const ebook_service_1 = __importDefault(require("../service/ebook.service"));
const logger_1 = __importDefault(require("../utils/logger"));
const media_model_1 = require("../models/media.model");
/**
 * Get text from ebook PDF
 * @route GET /api/ebooks/text
 * @query url - Direct PDF URL
 * @query contentId - Content ID to resolve to PDF URL
 * @query normalize - Whether to normalize text with Gemini AI (default: false)
 */
const getEbookText = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
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
        let pdfUrl;
        if (contentId) {
            // Find content by ID and get PDF URL
            const content = yield media_model_1.Media.findById(contentId);
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
            }
            else if (content.fileUrl) {
                pdfUrl = content.fileUrl;
            }
            else {
                response.status(400).json({
                    success: false,
                    message: "Content does not have a PDF URL",
                });
                return;
            }
        }
        else {
            pdfUrl = url;
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
        logger_1.default.info("Extracting ebook text", {
            contentId,
            url: pdfUrl,
            normalize: shouldNormalize,
            userId: request.userId || "anonymous",
        });
        // Get ebook text
        const ebookData = yield ebook_service_1.default.getEbookText(pdfUrl, shouldNormalize);
        // Set cache headers
        response.setHeader("Cache-Control", "private, max-age=300");
        response.status(200).json({
            success: true,
            data: ebookData,
        });
    }
    catch (error) {
        logger_1.default.error("Get ebook text error", {
            error: error.message,
            stack: error.stack,
            userId: request.userId || "anonymous",
        });
        // Determine appropriate error status
        const errorMessage = error.message;
        let statusCode = 500;
        if (errorMessage.includes("download")) {
            statusCode = 400;
        }
        else if (errorMessage.includes("not found")) {
            statusCode = 404;
        }
        response.status(statusCode).json({
            success: false,
            message: "Failed to extract ebook text",
            error: process.env.NODE_ENV === "development" ? errorMessage : undefined,
        });
    }
});
exports.getEbookText = getEbookText;
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
const renderTTS = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { contentId, pages, voiceId = "en-US-female-1", language = "en-US", speed = 1.0, pitch = 0, format = "mp3", cache = true, } = request.body;
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
        logger_1.default.info("TTS render request", {
            contentId,
            pageCount: pages.length,
            voiceId,
            language,
            userId: request.userId || "anonymous",
        });
        // Render TTS
        const renderResult = yield ebook_service_1.default.renderTTS({
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
    }
    catch (error) {
        logger_1.default.error("TTS render error", {
            error: error.message,
            stack: error.stack,
            userId: request.userId || "anonymous",
        });
        response.status(500).json({
            success: false,
            message: "Failed to render TTS",
            error: process.env.NODE_ENV === "development"
                ? error.message
                : undefined,
        });
    }
});
exports.renderTTS = renderTTS;
/**
 * Get TTS job status (for async rendering)
 * @route GET /api/tts/status/:jobId
 * @param jobId - Job ID
 */
const getTTSStatus = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { jobId } = request.params;
        if (!jobId) {
            response.status(400).json({
                success: false,
                message: "'jobId' parameter is required",
            });
            return;
        }
        logger_1.default.info("TTS status request", {
            jobId,
            userId: request.userId || "anonymous",
        });
        // Get job status
        const status = yield ebook_service_1.default.getTTSJobStatus(jobId);
        response.status(200).json({
            success: true,
            data: status,
        });
    }
    catch (error) {
        logger_1.default.error("TTS status error", {
            error: error.message,
            jobId: request.params.jobId,
            userId: request.userId || "anonymous",
        });
        response.status(500).json({
            success: false,
            message: "Failed to get TTS status",
            error: process.env.NODE_ENV === "development"
                ? error.message
                : undefined,
        });
    }
});
exports.getTTSStatus = getTTSStatus;
