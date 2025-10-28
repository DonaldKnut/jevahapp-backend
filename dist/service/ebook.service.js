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
exports.EbookService = void 0;
const generative_ai_1 = require("@google/generative-ai");
const axios_1 = __importDefault(require("axios"));
const pdf_parse_1 = require("pdf-parse");
const logger_1 = __importDefault(require("../utils/logger"));
class EbookService {
    constructor() {
        const apiKey = process.env.GOOGLE_AI_API_KEY;
        if (!apiKey) {
            logger_1.default.warn("GOOGLE_AI_API_KEY not found. Ebook normalization will be skipped.");
            this.genAI = null;
            this.model = null;
        }
        else {
            this.genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
            this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        }
    }
    /**
     * Download PDF from URL
     */
    downloadPDF(url) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield axios_1.default.get(url, {
                    responseType: "arraybuffer",
                    timeout: 30000, // 30 seconds timeout
                    headers: {
                        "User-Agent": "Jevah-App-Backend/2.0.0",
                    },
                });
                return Buffer.from(response.data);
            }
            catch (error) {
                logger_1.default.error("Failed to download PDF", {
                    error: error.message,
                    url,
                });
                throw new Error("Failed to download PDF from provided URL");
            }
        });
    }
    /**
     * Extract text from PDF buffer
     */
    extractTextFromPDF(pdfBuffer) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                // Create PDFParse instance
                const pdfParser = new pdf_parse_1.PDFParse({ data: pdfBuffer });
                // Get text result
                const textResult = yield pdfParser.getText();
                // Get info for metadata
                const infoResult = yield pdfParser.getInfo();
                // Clean up
                yield pdfParser.destroy();
                // Try to get title from PDF metadata
                const title = ((_a = infoResult.info) === null || _a === void 0 ? void 0 : _a.Title) || "Untitled Document";
                // Get total pages
                const numPages = textResult.numpages;
                // Extract pages
                const pages = [];
                if (textResult.pages && textResult.pages.length > 0) {
                    // Use per-page text if available
                    textResult.pages.forEach((pageData, index) => {
                        if (pageData.text) {
                            pages.push({
                                page: index + 1,
                                text: this.cleanText(pageData.text),
                            });
                        }
                    });
                }
                else if (textResult.text) {
                    // Fallback: split full text into pages
                    const lines = textResult.text.split("\n");
                    const linesPerPage = Math.ceil(lines.length / numPages);
                    for (let i = 0; i < numPages; i++) {
                        const startLine = i * linesPerPage;
                        const endLine = Math.min((i + 1) * linesPerPage, lines.length);
                        const pageLines = lines.slice(startLine, endLine);
                        const pageText = pageLines.join("\n").trim();
                        if (pageText) {
                            pages.push({
                                page: i + 1,
                                text: this.cleanText(pageText),
                            });
                        }
                    }
                }
                // If no pages were extracted, create a single page with all text
                if (pages.length === 0 && textResult.text) {
                    pages.push({
                        page: 1,
                        text: this.cleanText(textResult.text),
                    });
                }
                return {
                    title,
                    pages,
                };
            }
            catch (error) {
                logger_1.default.error("Failed to extract text from PDF", {
                    error: error.message,
                });
                throw new Error("Failed to extract text from PDF");
            }
        });
    }
    /**
     * Clean extracted text (remove headers, footers, extra whitespace)
     */
    cleanText(text) {
        // Remove excessive whitespace
        let cleaned = text.replace(/\s+/g, " ");
        // Remove common header/footer patterns
        cleaned = cleaned.replace(/Page \d+ of \d+/gi, "");
        cleaned = cleaned.replace(/^\d+\s*$/gm, ""); // Remove standalone page numbers
        // Trim
        cleaned = cleaned.trim();
        return cleaned;
    }
    /**
     * Normalize text using Gemini AI for TTS
     */
    normalizeTextForTTS(text) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.model) {
                logger_1.default.warn("Gemini AI not available, skipping text normalization");
                return text;
            }
            try {
                const prompt = `Normalize the following text for text-to-speech (TTS). 

Rules:
1. Preserve sentence order and meaning EXACTLY
2. Expand abbreviations for TTS (e.g., "Dr." -> "Doctor", "St." -> "Saint")
3. Add natural pauses where appropriate (use commas)
4. Fix pronunciation issues (spell out acronyms if needed)
5. Do NOT summarize or change the content
6. Do NOT add or remove sentences
7. Keep the same tone and style

Text:
${text}

Normalized text for TTS:`;
                const result = yield this.model.generateContent(prompt);
                const normalizedText = result.response.text();
                return normalizedText.trim();
            }
            catch (error) {
                logger_1.default.error("Failed to normalize text with Gemini", {
                    error: error.message,
                });
                // Return original text if normalization fails
                return text;
            }
        });
    }
    /**
     * Get text from ebook (main method)
     */
    getEbookText(url_1) {
        return __awaiter(this, arguments, void 0, function* (url, normalize = false) {
            try {
                // Download PDF
                const pdfBuffer = yield this.downloadPDF(url);
                // Extract text
                const { title, pages } = yield this.extractTextFromPDF(pdfBuffer);
                // Normalize text if requested
                let normalizedPages = pages;
                if (normalize && this.model) {
                    logger_1.default.info("Normalizing text for TTS with Gemini AI", {
                        pageCount: pages.length,
                    });
                    // Normalize each page
                    normalizedPages = yield Promise.all(pages.map((page) => __awaiter(this, void 0, void 0, function* () {
                        return ({
                            page: page.page,
                            text: yield this.normalizeTextForTTS(page.text),
                        });
                    })));
                }
                return {
                    title,
                    totalPages: normalizedPages.length,
                    pages: normalizedPages,
                };
            }
            catch (error) {
                logger_1.default.error("Failed to get ebook text", {
                    error: error.message,
                    url,
                });
                throw error;
            }
        });
    }
    /**
     * Render TTS audio (optional endpoint)
     * This is a placeholder for integration with TTS providers like Google Cloud TTS, AWS Polly, etc.
     */
    renderTTS(request) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info("TTS render request received", {
                    contentId: request.contentId,
                    pageCount: request.pages.length,
                    voiceId: request.voiceId,
                });
                // TODO: Integrate with actual TTS provider
                // For now, return a mock response
                return {
                    status: "processing",
                    jobId: `tts_${Date.now()}_${request.contentId}`,
                    estimatedTime: request.pages.length * 30, // Estimate 30 seconds per page
                };
            }
            catch (error) {
                logger_1.default.error("Failed to render TTS", {
                    error: error.message,
                    contentId: request.contentId,
                });
                throw new Error("Failed to initiate TTS rendering");
            }
        });
    }
    /**
     * Get TTS job status (for async rendering)
     */
    getTTSJobStatus(jobId) {
        return __awaiter(this, void 0, void 0, function* () {
            // TODO: Implement actual job status checking
            return {
                status: "completed",
                audioUrl: `https://example.com/audio/${jobId}.mp3`,
            };
        });
    }
}
exports.EbookService = EbookService;
exports.default = new EbookService();
