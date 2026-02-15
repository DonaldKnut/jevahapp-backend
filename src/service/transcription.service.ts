import { GoogleGenerativeAI } from "@google/generative-ai";
import logger from "../utils/logger";
import { mediaProcessingService } from "./mediaProcessing.service";
import {
  LanguageDetectionUtil,
  NIGERIAN_LANGUAGE_CODES,
} from "../utils/languageDetection.util";

export interface TranscriptionResult {
  transcript: string;
  confidence: number;
  language?: string;
}

export class TranscriptionService {
  private genAI: GoogleGenerativeAI | null;
  private model: any;

  constructor() {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      logger.warn(
        "GOOGLE_AI_API_KEY not found. Transcription will not be available."
      );
      this.genAI = null;
      this.model = null;
    } else {
      this.genAI = new GoogleGenerativeAI(apiKey);
      // Note: Gemini can handle audio transcription, but for better results,
      // you might want to use Google Cloud Speech-to-Text API
      // For now, we'll use Gemini's audio capabilities
      this.model = this.genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
      });
    }
  }

  /**
   * Transcribe audio using Gemini (or fallback to Google Cloud Speech-to-Text)
   * 
   * Note: Gemini 1.5 can process audio and automatically detect languages including:
   * - English (en-US, en-NG)
   * - Yoruba (yo-NG)
   * - Hausa (ha-NG)
   * - Igbo (ig-NG)
   * - And many other languages
   * 
   * When languageCode is "en-US" (default), Gemini will automatically detect the language.
   * For production, consider using Google Cloud Speech-to-Text API for better accuracy
   */
  async transcribeAudio(
    audioBuffer: Buffer,
    audioMimeType: string,
    languageCode: string = "en-US"
  ): Promise<TranscriptionResult> {
    try {
      // Prepare audio for transcription
      const preparedAudio = await mediaProcessingService.prepareAudioForTranscription(
        audioBuffer,
        audioMimeType
      );

      // If using Google Cloud Speech-to-Text (recommended for production)
      if (process.env.GOOGLE_CLOUD_SPEECH_TO_TEXT_ENABLED === "true") {
        return await this.transcribeWithGoogleCloud(preparedAudio, languageCode);
      }

      // Fallback: Use Gemini for transcription (if supported)
      if (this.model) {
        try {
          const base64Audio = preparedAudio.toString("base64");
          
          // Gemini 1.5 can process audio files and supports multiple languages
          // Updated prompt to handle Nigerian languages (Yoruba, Hausa, Igbo) and other languages
          const result = await this.model.generateContent({
            contents: [{
              role: "user",
              parts: [
                {
                  text: `Transcribe the following audio in whatever language it is spoken or sung. The audio may be in English, Yoruba, Hausa, Igbo, or any other language. Return only the transcript text in the original language, preserving the exact words. No additional commentary or translation.`
                },
                {
                  inlineData: {
                    mimeType: "audio/wav",
                    data: base64Audio,
                  },
                },
              ],
            }],
          });

          const response = await result.response;
          const transcript = response.text().trim();

          // Try to detect the language from the transcript
          let detectedLanguage = languageCode;
          if (transcript && transcript.length > 0) {
            const languageInfo = LanguageDetectionUtil.detectLanguageFromText(transcript);
            detectedLanguage = languageInfo.code;
            logger.info("Language detected from transcript", {
              detected: languageInfo.name,
              code: languageInfo.code,
              confidence: languageInfo.confidence,
            });
          }

          return {
            transcript,
            confidence: 0.7, // Gemini doesn't provide confidence scores
            language: detectedLanguage,
          };
        } catch (error: any) {
          logger.warn("Gemini transcription failed, trying fallback:", error);
          // Fall back to basic method
        }
      }

      // Final fallback: return empty transcript
      logger.warn("No transcription service available");
      return {
        transcript: "",
        confidence: 0,
        language: languageCode,
      };
    } catch (error: any) {
      logger.error("Error transcribing audio:", error);
      return {
        transcript: "",
        confidence: 0,
        language: languageCode,
      };
    }
  }

  /**
   * Transcribe using Google Cloud Speech-to-Text API (recommended)
   * 
   * To use this, you need to:
   * 1. Enable Google Cloud Speech-to-Text API
   * 2. Set GOOGLE_CLOUD_SPEECH_TO_TEXT_ENABLED=true
   * 3. Set GOOGLE_APPLICATION_CREDENTIALS to your service account key path
   * 4. Install @google-cloud/speech: npm install @google-cloud/speech
   */
  private async transcribeWithGoogleCloud(
    audioBuffer: Buffer,
    languageCode: string
  ): Promise<TranscriptionResult> {
    try {
      // Dynamic import to avoid requiring the package if not used
      const speech = await import("@google-cloud/speech" as any).catch(() => null);
      if (!speech) {
        throw new Error("Google Cloud Speech-to-Text not available");
      }
      const client = new speech.SpeechClient();

      const audioBytes = audioBuffer.toString("base64");

      // Support multiple Nigerian languages for Google Cloud Speech-to-Text
      // When default language is used, try multiple language alternatives
      const nigerianLanguages = LanguageDetectionUtil.getNigerianLanguageCodes();
      
      const config: any = {
        encoding: "LINEAR16" as const,
        sampleRateHertz: 16000,
        languageCode: languageCode || NIGERIAN_LANGUAGE_CODES.ENGLISH_US,
        enableAutomaticPunctuation: true,
        model: "default",
      };

      // If using default English, add alternative language codes to try Nigerian languages
      if (languageCode === NIGERIAN_LANGUAGE_CODES.ENGLISH_US || !languageCode) {
        // Filter out the primary language from alternatives
        const alternatives = nigerianLanguages.filter(
          (code) => code !== NIGERIAN_LANGUAGE_CODES.ENGLISH_US
        );
        config.alternativeLanguageCodes = alternatives;
        logger.info("Using alternative language codes for Nigerian languages", {
          alternatives,
        });
      }

      const request = {
        audio: {
          content: audioBytes,
        },
        config,
      };

      const [response] = await client.recognize(request);
      
      if (!response.results || response.results.length === 0) {
        return {
          transcript: "",
          confidence: 0,
          language: languageCode,
        };
      }

      const transcript = response.results
        .map((result: any) => result.alternatives?.[0]?.transcript || "")
        .join(" ");

      const confidence = response.results[0]?.alternatives?.[0]?.confidence || 0;

      return {
        transcript,
        confidence,
        language: languageCode,
      };
    } catch (error: any) {
      logger.error("Google Cloud Speech-to-Text error:", error);
      throw error;
    }
  }

  /**
   * Check if transcription service is available
   */
  isAvailable(): boolean {
    return this.genAI !== null && this.model !== null;
  }
}

// Export singleton instance
export const transcriptionService = new TranscriptionService();


