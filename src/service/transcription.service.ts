import { GoogleGenerativeAI } from "@google/generative-ai";
import logger from "../utils/logger";
import { mediaProcessingService } from "./mediaProcessing.service";

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
   * Note: Gemini 1.5 can process audio, but for production, consider using
   * Google Cloud Speech-to-Text API for better accuracy
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
          
          // Gemini 1.5 can process audio files
          const result = await this.model.generateContent({
            contents: [{
              role: "user",
              parts: [
                {
                  text: "Transcribe the following audio. Return only the transcript text, no additional commentary."
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

          return {
            transcript,
            confidence: 0.7, // Gemini doesn't provide confidence scores
            language: languageCode,
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

      const request = {
        audio: {
          content: audioBytes,
        },
        config: {
          encoding: "LINEAR16" as const,
          sampleRateHertz: 16000,
          languageCode: languageCode,
          enableAutomaticPunctuation: true,
          model: "default",
        },
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


