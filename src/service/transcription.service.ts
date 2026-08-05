import { GoogleGenerativeAI } from "@google/generative-ai";
import logger from "../utils/logger";
import { mediaProcessingService } from "./mediaProcessing.service";
import {
  LanguageDetectionUtil,
  NIGERIAN_LANGUAGE_CODES,
} from "../utils/languageDetection.util";
import {
  isGuardianConfigured,
  transcribeWithGuardian,
} from "./moderation/guardianClient";

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
        "GOOGLE_AI_API_KEY not found. Gemini transcription unavailable (Guardian STT may still work)."
      );
      this.genAI = null;
      this.model = null;
    } else {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({
        model:
          process.env.GEMINI_TRANSCRIPTION_MODEL ||
          process.env.GEMINI_DEFAULT_MODEL ||
          "gemini-2.5-flash",
      });
    }
  }

  /**
   * Prefer Content Guardian (faster-whisper) → Google Cloud STT → Gemini → empty.
   */
  async transcribeAudio(
    audioBuffer: Buffer,
    audioMimeType: string,
    languageCode: string = "en-US"
  ): Promise<TranscriptionResult> {
    try {
      const preparedAudio =
        await mediaProcessingService.prepareAudioForTranscription(
          audioBuffer,
          audioMimeType
        );

      if (isGuardianConfigured()) {
        try {
          const g = await transcribeWithGuardian(
            preparedAudio,
            "audio.wav",
            "audio/wav",
            languageCode?.startsWith("en") ? undefined : languageCode
          );
          if (g && g.transcript && g.transcript.trim().length > 0) {
            let detectedLanguage = languageCode;
            const languageInfo = LanguageDetectionUtil.detectLanguageFromText(
              g.transcript
            );
            if (languageInfo?.code) detectedLanguage = languageInfo.code;
            logger.info("Transcript from Content Guardian Whisper", {
              chars: g.transcript.length,
              language: detectedLanguage,
            });
            return {
              transcript: g.transcript.trim(),
              confidence: g.confidence ?? 0.75,
              language: detectedLanguage,
            };
          }
        } catch (err: any) {
          logger.warn("Guardian transcription failed, trying next provider", {
            error: err?.message,
          });
        }
      }

      if (process.env.GOOGLE_CLOUD_SPEECH_TO_TEXT_ENABLED === "true") {
        return await this.transcribeWithGoogleCloud(
          preparedAudio,
          languageCode
        );
      }

      if (this.model) {
        try {
          const base64Audio = preparedAudio.toString("base64");

          const result = await this.model.generateContent({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `Transcribe the following audio in whatever language it is spoken or sung. The audio may be in English, Yoruba, Hausa, Igbo, or any other language. Return only the transcript text in the original language, preserving the exact words. No additional commentary or translation.`,
                  },
                  {
                    inlineData: {
                      mimeType: "audio/wav",
                      data: base64Audio,
                    },
                  },
                ],
              },
            ],
          });

          const response = await result.response;
          const transcript = response.text().trim();

          let detectedLanguage = languageCode;
          if (transcript && transcript.length > 0) {
            const languageInfo =
              LanguageDetectionUtil.detectLanguageFromText(transcript);
            detectedLanguage = languageInfo.code;
            logger.info("Language detected from transcript", {
              detected: languageInfo.name,
              code: languageInfo.code,
              confidence: languageInfo.confidence,
            });
          }

          return {
            transcript,
            confidence: 0.7,
            language: detectedLanguage,
          };
        } catch (error: any) {
          logger.warn("Gemini transcription failed, trying fallback:", error);
        }
      }

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

  private async transcribeWithGoogleCloud(
    audioBuffer: Buffer,
    languageCode: string
  ): Promise<TranscriptionResult> {
    try {
      const speech = await import("@google-cloud/speech" as any).catch(
        () => null
      );
      if (!speech) {
        throw new Error("Google Cloud Speech-to-Text not available");
      }
      const client = new speech.SpeechClient();

      const audioBytes = audioBuffer.toString("base64");
      const nigerianLanguages = LanguageDetectionUtil.getNigerianLanguageCodes();

      const config: any = {
        encoding: "LINEAR16" as const,
        sampleRateHertz: 16000,
        languageCode: languageCode || NIGERIAN_LANGUAGE_CODES.ENGLISH_US,
        enableAutomaticPunctuation: true,
        model: "default",
      };

      if (
        languageCode === NIGERIAN_LANGUAGE_CODES.ENGLISH_US ||
        !languageCode
      ) {
        const alternatives = nigerianLanguages.filter(
          (code: string) => code !== NIGERIAN_LANGUAGE_CODES.ENGLISH_US
        );
        config.alternativeLanguageCodes = alternatives;
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

      const confidence =
        response.results[0]?.alternatives?.[0]?.confidence || 0;

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

  isAvailable(): boolean {
    return (
      isGuardianConfigured() ||
      (this.genAI !== null && this.model !== null) ||
      process.env.GOOGLE_CLOUD_SPEECH_TO_TEXT_ENABLED === "true"
    );
  }
}

export const transcriptionService = new TranscriptionService();
