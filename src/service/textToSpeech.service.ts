import * as crypto from "crypto";
import logger from "../utils/logger";
import azureTextToSpeechService from "./azureTextToSpeech.service";

import type {
  TTSOptions,
  TTSProvider,
  TTSResult,
  TTSSegment,
  TTSTimings,
  TTSVoice,
} from "./tts.types";

export type { TTSOptions, TTSProvider, TTSResult, TTSSegment, TTSTimings, TTSVoice } from "./tts.types";

/**
 * Text-to-Speech Service
 * 
 * This service uses Azure TTS as the only provider.
 * Configure Azure TTS by setting:
 * - AZURE_TTS_KEY
 * - AZURE_TTS_REGION
 * - AZURE_TTS_ENDPOINT (optional)
 */
export class TextToSpeechService {
  private defaultLanguageCode = "en-US";

  constructor() {
    if (azureTextToSpeechService.isAvailable()) {
      logger.info("Azure TTS service initialized successfully");
    } else {
      logger.warn("Azure TTS not configured. Set AZURE_TTS_KEY and AZURE_TTS_REGION environment variables to enable TTS.");
    }
  }

  /**
   * Get available voices for a language
   * Note: Azure doesn't have a listVoices API in this implementation.
   * Use voice names directly (e.g., "en-US-JennyNeural", "en-US-GuyNeural")
   */
  async getAvailableVoices(languageCode?: string): Promise<TTSVoice[]> {
    // Return a list of common Azure Neural voices
    const language = languageCode || this.defaultLanguageCode;
    
    const voices: TTSVoice[] = [
      // Female voices
      { name: "en-US-JennyNeural", ssmlGender: "FEMALE" as const, languageCode: "en-US" },
      { name: "en-US-AriaNeural", ssmlGender: "FEMALE" as const, languageCode: "en-US" },
      { name: "en-US-MichelleNeural", ssmlGender: "FEMALE" as const, languageCode: "en-US" },
      { name: "en-GB-SoniaNeural", ssmlGender: "FEMALE" as const, languageCode: "en-GB" },
      // Male voices
      { name: "en-US-GuyNeural", ssmlGender: "MALE" as const, languageCode: "en-US" },
      { name: "en-US-DavisNeural", ssmlGender: "MALE" as const, languageCode: "en-US" },
      { name: "en-US-BrianNeural", ssmlGender: "MALE" as const, languageCode: "en-US" },
      { name: "en-GB-RyanNeural", ssmlGender: "MALE" as const, languageCode: "en-GB" },
    ];
    
    return voices.filter(v => v.languageCode === language || language.startsWith(v.languageCode.split("-")[0]));
  }

  /**
   * Generate TTS audio from text with segment timings
   */
  async synthesizeSpeech(
    text: string,
    options: TTSOptions = {},
    includeTimings: boolean = true
  ): Promise<TTSResult> {
    if (!azureTextToSpeechService.isAvailable()) {
      throw new Error(
        "Azure TTS is not configured. Please set AZURE_TTS_KEY and AZURE_TTS_REGION environment variables."
      );
    }

    return azureTextToSpeechService.synthesizeSpeech(text, options, includeTimings);
  }

  /**
   * Generate TTS for ebook with chunking (for long texts)
   * Handles timings across multiple chunks
   */
  async synthesizeEbook(
    text: string,
    options: TTSOptions = {},
    includeTimings: boolean = true
  ): Promise<TTSResult> {
    if (!azureTextToSpeechService.isAvailable()) {
      throw new Error(
        "Azure TTS is not configured. Please set AZURE_TTS_KEY and AZURE_TTS_REGION environment variables."
      );
    }

    return azureTextToSpeechService.synthesizeEbook(text, options, includeTimings);
  }

  /**
   * Check if TTS is available
   */
  isAvailable(): boolean {
    return azureTextToSpeechService.isAvailable();
  }
}

export default new TextToSpeechService();
