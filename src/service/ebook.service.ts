import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from "axios";
// pdf-parse uses pdfjs-dist (ES Module) which requires dynamic import
// import { PDFParse } from "pdf-parse";
import logger from "../utils/logger";
import textToSpeechService, { TTSOptions } from "./textToSpeech.service";

export interface PageText {
  page: number;
  text: string;
}

export interface EbookTextResponse {
  title: string;
  totalPages: number;
  pages: PageText[];
}

export interface TTSRenderRequest {
  contentId: string;
  pages: PageText[];
  voiceId: string;
  language: string;
  speed: number;
  pitch: number;
  format: string;
  cache: boolean;
}

export interface TTSRenderResponse {
  status: "completed" | "processing";
  jobId?: string;
  audioUrl?: string;
  estimatedTime?: number;
}

export class EbookService {
  private genAI: GoogleGenerativeAI | null;
  private model: any;

  constructor() {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      logger.warn(
        "GOOGLE_AI_API_KEY not found. Ebook normalization will be skipped."
      );
      this.genAI = null;
      this.model = null;
    } else {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    }
  }

  /**
   * Download PDF from URL
   */
  private async downloadPDF(url: string): Promise<Buffer> {
    try {
      const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 30000, // 30 seconds timeout
        headers: {
          "User-Agent": "Jevah-App-Backend/2.0.0",
        },
      });

      return Buffer.from(response.data);
    } catch (error) {
      logger.error("Failed to download PDF", {
        error: (error as Error).message,
        url,
      });
      throw new Error("Failed to download PDF from provided URL");
    }
  }

  /**
   * Extract text from PDF buffer
   */
  private async extractTextFromPDF(pdfBuffer: Buffer): Promise<{
    title: string;
    pages: PageText[];
  }> {
    try {
      // Dynamic import for pdf-parse (uses ES Module pdfjs-dist)
      // Must use Function constructor to create true dynamic import at runtime
      const pdfParseModule = await new Function('return import("pdf-parse")')();
      const { PDFParse } = pdfParseModule;

      // Create PDFParse instance
      const pdfParser = new PDFParse({ data: pdfBuffer });

      // Get text result
      const textResult = await pdfParser.getText();

      // Get info for metadata
      const infoResult = await pdfParser.getInfo();

      // Clean up
      await pdfParser.destroy();

      // Try to get title from PDF metadata
      const title = infoResult.info?.Title || "Untitled Document";

      // Get total pages
      const numPages = textResult.numpages;

      // Extract pages
      const pages: PageText[] = [];

      if (textResult.pages && textResult.pages.length > 0) {
        // Use per-page text if available
        textResult.pages.forEach((pageData: any, index: number) => {
          if (pageData.text) {
            pages.push({
              page: index + 1,
              text: this.cleanText(pageData.text),
            });
          }
        });
      } else if (textResult.text) {
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
    } catch (error) {
      logger.error("Failed to extract text from PDF", {
        error: (error as Error).message,
      });
      throw new Error("Failed to extract text from PDF");
    }
  }

  /**
   * Clean extracted text (remove headers, footers, extra whitespace)
   */
  private cleanText(text: string): string {
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
  private async normalizeTextForTTS(text: string): Promise<string> {
    if (!this.model) {
      logger.warn("Gemini AI not available, skipping text normalization");
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

      const result = await this.model.generateContent(prompt);
      const normalizedText = result.response.text();

      return normalizedText.trim();
    } catch (error) {
      logger.error("Failed to normalize text with Gemini", {
        error: (error as Error).message,
      });
      // Return original text if normalization fails
      return text;
    }
  }

  /**
   * Get text from ebook (main method)
   */
  async getEbookText(
    url: string,
    normalize: boolean = false
  ): Promise<EbookTextResponse> {
    try {
      // Download PDF
      const pdfBuffer = await this.downloadPDF(url);

      // Extract text
      const { title, pages } = await this.extractTextFromPDF(pdfBuffer);

      // Normalize text if requested
      let normalizedPages = pages;
      if (normalize && this.model) {
        logger.info("Normalizing text for TTS with Gemini AI", {
          pageCount: pages.length,
        });

        // Normalize each page
        normalizedPages = await Promise.all(
          pages.map(async page => ({
            page: page.page,
            text: await this.normalizeTextForTTS(page.text),
          }))
        );
      }

      return {
        title,
        totalPages: normalizedPages.length,
        pages: normalizedPages,
      };
    } catch (error) {
      logger.error("Failed to get ebook text", {
        error: (error as Error).message,
        url,
      });
      throw error;
    }
  }

  /**
   * Render TTS audio for ebook pages
   * Generates audio from text using Google Cloud TTS
   */
  async renderTTS(request: TTSRenderRequest): Promise<TTSRenderResponse> {
    try {
      logger.info("TTS render request received", {
        contentId: request.contentId,
        pageCount: request.pages.length,
        voiceId: request.voiceId,
      });

      // Check if TTS service is available
      if (!textToSpeechService.isAvailable()) {
        logger.warn("TTS service not available, returning processing status");
        return {
          status: "processing",
          jobId: `tts_${Date.now()}_${request.contentId}`,
          estimatedTime: request.pages.length * 30,
        };
      }

      // Combine all page text
      const fullText = request.pages
        .map(page => page.text)
        .join("\n\n")
        .trim();

      if (!fullText) {
        throw new Error("No text content to synthesize");
      }

      // Parse voice options from voiceId
      // Format: "en-US-female-1" or "en-US-male-1" or custom voice name
      const voiceMatch = request.voiceId.match(/^([a-z]{2}-[A-Z]{2})-(male|female|custom)(?:-(\d+))?$/i);
      const voiceType = voiceMatch
        ? (voiceMatch[2].toLowerCase() as "male" | "female" | "custom")
        : "female";
      const languageCode = voiceMatch
        ? voiceMatch[1]
        : request.language || "en-US";

      // Prepare TTS options
      const ttsOptions: TTSOptions = {
        voice: voiceType,
        languageCode,
        speakingRate: request.speed || 1.0,
        pitch: request.pitch || 0,
        audioEncoding: (request.format?.toUpperCase() || "MP3") as "MP3" | "LINEAR16" | "OGG_OPUS",
      };

      // Generate TTS audio
      logger.info("Generating TTS audio", {
        contentId: request.contentId,
        textLength: fullText.length,
        voiceType,
        languageCode,
      });

      const ttsResult = await textToSpeechService.synthesizeEbook(
        fullText,
        ttsOptions
      );

      logger.info("TTS audio generated successfully", {
        contentId: request.contentId,
        audioUrl: ttsResult.audioUrl,
        duration: ttsResult.duration,
      });

      return {
        status: "completed",
        audioUrl: ttsResult.audioUrl,
        estimatedTime: ttsResult.duration || request.pages.length * 30,
      };
    } catch (error) {
      logger.error("Failed to render TTS", {
        error: (error as Error).message,
        stack: (error as Error).stack,
        contentId: request.contentId,
      });
      throw new Error(`Failed to initiate TTS rendering: ${(error as Error).message}`);
    }
  }

  /**
   * Get TTS job status (for async rendering)
   */
  async getTTSJobStatus(jobId: string): Promise<TTSRenderResponse> {
    // TODO: Implement actual job status checking
    return {
      status: "completed",
      audioUrl: `https://example.com/audio/${jobId}.mp3`,
    };
  }
}

export default new EbookService();
