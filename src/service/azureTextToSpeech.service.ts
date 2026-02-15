import * as sdk from "microsoft-cognitiveservices-speech-sdk";
import * as crypto from "crypto";
import logger from "../utils/logger";
import fileUploadService from "./fileUpload.service";
import { TTSOptions, TTSResult, TTSTimings, TTSSegment } from "./tts.types";

export class AzureTextToSpeechService {
  private subscriptionKey: string | null;
  private region: string | null;
  private endpoint: string | null;
  private defaultLanguageCode = "en-US";

  // Azure Neural Voices (high quality)
  private readonly voiceOptions: {
    male: string[];
    female: string[];
  } = {
    male: [
      "en-US-GuyNeural", // Natural male voice
      "en-US-DavisNeural", // Natural male voice
      "en-US-BrianNeural", // Natural male voice
      "en-GB-RyanNeural", // UK English male
    ],
    female: [
      "en-US-JennyNeural", // Natural female voice (recommended)
      "en-US-AriaNeural", // Natural female voice
      "en-US-MichelleNeural", // Natural female voice
      "en-GB-SoniaNeural", // UK English female
    ],
  };

  constructor() {
    this.subscriptionKey = process.env.AZURE_TTS_KEY || null;
    this.region = process.env.AZURE_TTS_REGION || null;
    this.endpoint = process.env.AZURE_TTS_ENDPOINT || null;

    if (this.subscriptionKey && this.region) {
      logger.info("Azure TTS service initialized", {
        region: this.region,
        hasEndpoint: !!this.endpoint,
      });
    } else {
      logger.warn("Azure TTS not configured", {
        note: "Set AZURE_TTS_KEY and AZURE_TTS_REGION environment variables to enable Azure TTS.",
      });
    }
  }

  /**
   * Calculate SHA-256 hash of text for cache correctness
   */
  private calculateTextHash(text: string): string {
    return crypto.createHash("sha256").update(text).digest("hex");
  }

  /**
   * Split text into segments (sentences preferred, fallback to paragraphs)
   */
  private splitIntoSegments(text: string): Array<{ text: string; kind: "sentence" | "paragraph"; id: string }> {
    const segments: Array<{ text: string; kind: "sentence" | "paragraph"; id: string }> = [];
    
    // Try to split by sentences first
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    
    if (sentences.length > 0) {
      sentences.forEach((sentence, index) => {
        const trimmed = sentence.trim();
        if (trimmed.length > 0) {
          segments.push({
            text: trimmed,
            kind: "sentence",
            id: `s${index + 1}`,
          });
        }
      });
    } else {
      // Fallback to paragraphs
      const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
      paragraphs.forEach((paragraph, index) => {
        segments.push({
          text: paragraph.trim(),
          kind: "paragraph",
          id: `p${index + 1}`,
        });
      });
    }

    return segments;
  }

  /**
   * Select voice based on options
   */
  private selectVoice(options: TTSOptions): string {
    const languageCode = options.languageCode || this.defaultLanguageCode;
    const voiceType = options.voice || "female";

    // If custom voice name is provided, use it
    if (options.voiceName) {
      return options.voiceName;
    }

    // Select from predefined voices
    const availableVoices =
      voiceType === "male" ? this.voiceOptions.male : this.voiceOptions.female;

    // Try to find a voice matching the language code
    const matchingVoice = availableVoices.find(
      v => v.startsWith(languageCode)
    );

    if (matchingVoice) {
      return matchingVoice;
    }

    // Fallback to first available voice
    return availableVoices[0] || this.voiceOptions.female[0];
  }

  /**
   * Generate TTS audio from text with segment timings
   */
  async synthesizeSpeech(
    text: string,
    options: TTSOptions = {},
    includeTimings: boolean = true
  ): Promise<TTSResult> {
    if (!this.subscriptionKey || !this.region) {
      throw new Error(
        "Azure TTS not configured. Please set AZURE_TTS_KEY and AZURE_TTS_REGION environment variables."
      );
    }

    if (!text || text.trim().length === 0) {
      throw new Error("Text cannot be empty");
    }

    try {
      const voiceName = this.selectVoice(options);
      const languageCode = options.languageCode || this.defaultLanguageCode;

      // Calculate text hash for cache correctness
      const textHash = this.calculateTextHash(text);

      // Split text into segments for timing
      const segments = includeTimings ? this.splitIntoSegments(text) : [];

      // Create speech config
      const speechConfig = sdk.SpeechConfig.fromSubscription(
        this.subscriptionKey,
        this.region
      );

      // Set voice
      speechConfig.speechSynthesisVoiceName = voiceName;

      // Set output format (MP3)
      speechConfig.speechSynthesisOutputFormat =
        sdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3;

      // Set speaking rate (Azure uses SSML for rate control)
      const speakingRate = options.speakingRate || 1.0;
      const pitch = options.pitch || 0;

      logger.info("Synthesizing speech with Azure TTS", {
        textLength: text.length,
        voice: voiceName,
        languageCode,
        speakingRate,
        segmentCount: segments.length,
      });

      // For long texts, we need to chunk (Azure has ~10,000 character limit per request)
      const MAX_CHUNK_LENGTH = 9000; // Leave buffer
      const audioBuffers: Buffer[] = [];
      const allSegments: TTSSegment[] = [];
      let totalDurationMs = 0;
      let charOffset = 0;

      if (text.length <= MAX_CHUNK_LENGTH) {
        // Single request
        const audioBuffer = await this.synthesizeChunk(
          text,
          speechConfig,
          languageCode,
          speakingRate,
          pitch
        );
        audioBuffers.push(audioBuffer);

        // Estimate segment timings
        if (includeTimings && segments.length > 0) {
          const estimatedDuration = this.estimateDuration(text, speakingRate);
          segments.forEach((segment, index) => {
            const startMs = (index / segments.length) * estimatedDuration;
            const endMs = ((index + 1) / segments.length) * estimatedDuration;

            allSegments.push({
              id: segment.id,
              kind: segment.kind,
              startMs: Math.round(startMs),
              endMs: Math.round(endMs),
              text: segment.text,
              charStart: charOffset,
              charEnd: charOffset + segment.text.length,
            });

            charOffset += segment.text.length + 2;
          });
          totalDurationMs = estimatedDuration;
        } else {
          totalDurationMs = this.estimateDuration(text, speakingRate);
        }
      } else {
        // Multiple chunks - OPTIMIZED: Process chunks in parallel for faster synthesis
        const textChunks = this.splitIntoChunks(text, MAX_CHUNK_LENGTH);
        const chunkCount = textChunks.length;
        
        logger.info(`Processing ${chunkCount} chunks in parallel for faster TTS generation`);

        // Process all chunks in parallel (Azure TTS API can handle concurrent requests)
        const chunkPromises = textChunks.map(async (chunk, i) => {
          // Skip empty chunks after sanitization
          const sanitizedChunk = this.sanitizeTextForSSML(chunk);
          if (!sanitizedChunk || sanitizedChunk.trim().length === 0) {
            logger.warn(`Skipping empty chunk ${i + 1}/${chunkCount} after sanitization`);
            return {
              index: i,
              audioBuffer: Buffer.alloc(0),
              chunkDuration: 0,
              chunkSegments: [],
              chunkText: "",
              skipped: true,
            };
          }

          logger.info(`Synthesizing Azure TTS chunk ${i + 1}/${chunkCount}`);
          
          const audioBuffer = await this.synthesizeChunk(
            chunk,
            speechConfig,
            languageCode,
            speakingRate,
            pitch
          );

          // Pre-calculate timing data for this chunk
          const chunkDuration = this.estimateDuration(chunk, speakingRate);
          const chunkSegments = this.splitIntoSegments(chunk);
          
          return {
            index: i,
            audioBuffer,
            chunkDuration,
            chunkSegments,
            chunkText: chunk,
            skipped: false,
          };
        });

        // Wait for all chunks to complete
        const chunkResults = await Promise.all(chunkPromises);
        
        // Sort by index to maintain order and filter out skipped chunks
        chunkResults.sort((a, b) => a.index - b.index);
        const validResults = chunkResults.filter(r => !r.skipped && r.audioBuffer.length > 0);

        if (validResults.length === 0) {
          throw new Error("All text chunks were empty or invalid after sanitization");
        }

        // Build audio buffers and segments in order
        let chunkStartTime = 0;
        validResults.forEach((result) => {
          audioBuffers.push(result.audioBuffer);

          // Build segments with correct timing offsets
          result.chunkSegments.forEach((segment, segIndex) => {
            const segmentStart = (segIndex / result.chunkSegments.length) * result.chunkDuration;
            const segmentEnd = ((segIndex + 1) / result.chunkSegments.length) * result.chunkDuration;

            allSegments.push({
              id: `chunk${result.index + 1}-${segment.id}`,
              kind: segment.kind,
              startMs: Math.round(chunkStartTime + segmentStart),
              endMs: Math.round(chunkStartTime + segmentEnd),
              text: segment.text,
              charStart: charOffset,
              charEnd: charOffset + segment.text.length,
            });

            charOffset += segment.text.length + 2;
          });

          chunkStartTime += result.chunkDuration;
          totalDurationMs = chunkStartTime;
        });

        logger.info(`Completed parallel TTS synthesis for ${chunkCount} chunks`);
      }

      // Combine audio buffers
      const combinedBuffer = Buffer.concat(audioBuffers);

      // Upload audio to Cloudflare R2
      const uploadResult = await fileUploadService.uploadMedia(
        combinedBuffer,
        "tts-audio",
        "audio/mpeg"
      );

      // Build timings
      const timings: TTSTimings | undefined = includeTimings && allSegments.length > 0
        ? {
            format: "segments.v1",
            segments: allSegments,
          }
        : undefined;

      const durationSeconds = Math.ceil(totalDurationMs / 1000);

      logger.info("Azure TTS audio generated successfully", {
        audioUrl: uploadResult.secure_url,
        objectKey: uploadResult.objectKey,
        durationMs: totalDurationMs,
        durationSeconds,
        segmentCount: allSegments.length,
      });

      return {
        audioBuffer: combinedBuffer,
        audioUrl: uploadResult.secure_url,
        objectKey: uploadResult.objectKey,
        durationMs: totalDurationMs,
        duration: durationSeconds,
        textHash,
        timings,
        ttsConfig: {
          provider: "azure-tts",
          voicePreset: options.voice,
          voiceName,
          languageCode,
          speed: speakingRate,
          pitch,
        },
      };
    } catch (error: any) {
      logger.error("Failed to synthesize speech with Azure TTS", {
        error: error.message,
        stack: error.stack,
      });
      throw new Error(`Azure TTS synthesis failed: ${error.message}`);
    }
  }

  /**
   * Synthesize a single chunk of text
   */
  private async synthesizeChunk(
    text: string,
    speechConfig: sdk.SpeechConfig,
    languageCode: string,
    speakingRate: number,
    pitch: number
  ): Promise<Buffer> {
    // Validate text before processing
    const sanitizedText = this.sanitizeTextForSSML(text);
    if (!sanitizedText || sanitizedText.trim().length === 0) {
      logger.warn("Empty text after sanitization, skipping chunk");
      // Return empty buffer for empty chunks
      return Buffer.alloc(0);
    }

    return new Promise((resolve, reject) => {
      // Build SSML with rate and pitch control
      const ssml = this.buildSSML(
        sanitizedText,
        speechConfig.speechSynthesisVoiceName || this.voiceOptions.female[0],
        languageCode,
        speakingRate,
        pitch
      );

      // Validate SSML before sending
      if (!ssml || ssml.trim().length === 0) {
        reject(new Error("Generated SSML is empty after sanitization"));
        return;
      }

      const synthesizer = new sdk.SpeechSynthesizer(speechConfig, null);

      synthesizer.speakSsmlAsync(
        ssml,
        (result) => {
          if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
            const audioBuffer = Buffer.from(result.audioData);
            synthesizer.close();
            resolve(audioBuffer);
          } else {
            const errorDetails =
              result.errorDetails ||
              `Azure TTS failed with reason: ${result.reason}`;
            const isSsmlParseError =
              /ssml/i.test(errorDetails) ||
              /0x80045003/i.test(errorDetails) ||
              /FailedPrecondition/i.test(errorDetails);

            logger.error("Azure TTS synthesis error", {
              reason: result.reason,
              errorDetails: result.errorDetails,
              ssmlLength: ssml.length,
              textLength: sanitizedText.length,
              textPreview: sanitizedText.substring(0, 100),
            });

            // Workaround: if SSML parsing fails (common with PDF-extracted text),
            // fall back to plain-text synthesis (no SSML).
            if (isSsmlParseError) {
              const plainText = this.sanitizePlainText(text);
              synthesizer.close();

              const fallbackSynthesizer = new sdk.SpeechSynthesizer(
                speechConfig,
                null
              );

              fallbackSynthesizer.speakTextAsync(
                plainText,
                (fallbackResult) => {
                  if (
                    fallbackResult.reason ===
                    sdk.ResultReason.SynthesizingAudioCompleted
                  ) {
                    const audioBuffer = Buffer.from(fallbackResult.audioData);
                    fallbackSynthesizer.close();
                    resolve(audioBuffer);
                  } else {
                    const fallbackDetails =
                      fallbackResult.errorDetails || errorDetails;
                    fallbackSynthesizer.close();
                    reject(
                      new Error(
                        `Azure TTS synthesis failed (SSML + fallback): ${fallbackDetails}`
                      )
                    );
                  }
                },
                (fallbackError) => {
                  fallbackSynthesizer.close();
                  reject(fallbackError);
                }
              );
              return;
            }

            synthesizer.close();
            reject(new Error(`Azure TTS synthesis failed: ${errorDetails}`));
          }
        },
        (error: any) => {
          synthesizer.close();
          logger.error("Azure TTS synthesis exception", {
            error: error?.message || String(error),
            stack: error?.stack,
            ssmlLength: ssml.length,
            textLength: sanitizedText.length,
            textPreview: sanitizedText.substring(0, 100),
          });
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      );
    });
  }

  /**
   * Build SSML for Azure TTS with rate and pitch control
   */
  private buildSSML(
    text: string,
    voiceName: string,
    languageCode: string,
    speakingRate: number,
    pitch: number
  ): string {
    // Sanitize text for SSML - more robust cleaning
    let cleaned = this.sanitizeTextForSSML(text);

    // Ensure text is not empty after cleaning
    if (!cleaned || cleaned.trim().length === 0) {
      cleaned = " "; // Use a space if text is empty
    }

    // Convert pitch: Azure uses relative pitch in semitones (-12 to +12)
    // Our pitch is -20 to +20, so convert: pitch / 20 * 12
    const pitchSemitones = Math.max(-12, Math.min(12, (pitch / 20) * 12));

    // Convert rate: Azure uses relative rate (0.5x to 2.0x)
    // Our rate is 0.25 to 4.0, so map: rate / 2 (clamp to 0.5-2.0)
    const azureRate = Math.max(0.5, Math.min(2.0, speakingRate / 2));
    // Azure SSML expects a W3C-style prosody rate value (e.g., "+10%", "-20%"),
    // not a raw multiplier like "0.8".
    const ratePercent = Math.round((azureRate - 1.0) * 100);
    const rateStr = `${ratePercent >= 0 ? "+" : ""}${ratePercent}%`;

    // Build SSML with proper escaping
    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${this.escapeXmlAttribute(languageCode)}">
      <voice name="${this.escapeXmlAttribute(voiceName)}">
        <prosody rate="${rateStr}" pitch="${pitchSemitones > 0 ? "+" : ""}${pitchSemitones}st">
          ${cleaned}
        </prosody>
      </voice>
    </speak>`;

    return ssml;
  }

  /**
   * Sanitize text for SSML - removes invalid characters and escapes XML
   */
  private sanitizeTextForSSML(text: string): string {
    if (!text || typeof text !== "string") {
      return " ";
    }

    // Remove null bytes and control characters (except newlines, tabs, carriage returns)
    let cleaned = text
      .replace(/\0/g, "") // Remove null bytes
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "") // Remove control chars except \n, \t, \r
      .replace(/[\uFFFE\uFFFF]/g, "") // Remove invalid Unicode characters
      .replace(/\u00A0/g, " "); // Normalize non-breaking spaces

    // Remove unpaired surrogate halves (invalid UTF-16 sequences)
    cleaned = this.stripUnpairedSurrogates(cleaned);

    // Normalize whitespace (keep newlines but normalize spaces)
    cleaned = cleaned.replace(/[ \t]+/g, " "); // Multiple spaces/tabs to single space
    cleaned = cleaned.replace(/\n\s+/g, "\n"); // Remove trailing spaces after newlines
    cleaned = cleaned.replace(/\s+\n/g, "\n"); // Remove leading spaces before newlines

    // Normalize newlines - Azure TTS prefers single spaces
    cleaned = cleaned.replace(/\n+/g, " "); // Convert newlines to spaces
    cleaned = cleaned.replace(/\r+/g, " "); // Convert carriage returns to spaces

    // Escape XML special characters (must be done AFTER other replacements)
    cleaned = cleaned
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

    // Trim and ensure it's not empty
    cleaned = cleaned.trim();

    return cleaned || " ";
  }

  /**
   * Sanitize text for speakTextAsync fallback (plain text, NOT XML-escaped)
   */
  private sanitizePlainText(text: string): string {
    if (!text || typeof text !== "string") {
      return " ";
    }

    let cleaned = text
      .replace(/\r\n?/g, "\n")
      .replace(/\0/g, "")
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "")
      .replace(/[\uFFFE\uFFFF]/g, "")
      .replace(/\u00A0/g, " ");

    cleaned = this.stripUnpairedSurrogates(cleaned);

    // Normalize whitespace/newlines for more stable synthesis
    cleaned = cleaned.replace(/[ \t]+/g, " ").replace(/\n+/g, " ").trim();

    return cleaned || " ";
  }

  /**
   * Remove invalid UTF-16 sequences (unpaired surrogate halves).
   * Keeps valid surrogate pairs intact.
   */
  private stripUnpairedSurrogates(input: string): string {
    let out = "";
    for (let i = 0; i < input.length; i++) {
      const c = input.charCodeAt(i);

      // High surrogate
      if (c >= 0xd800 && c <= 0xdbff) {
        const next = input.charCodeAt(i + 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          out += input[i] + input[i + 1];
          i++;
        }
        continue;
      }

      // Low surrogate without preceding high surrogate
      if (c >= 0xdc00 && c <= 0xdfff) {
        continue;
      }

      out += input[i];
    }
    return out;
  }

  /**
   * Escape XML attribute values
   */
  private escapeXmlAttribute(value: string): string {
    return (value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  /**
   * Split text into chunks for Azure (max ~10,000 chars per request)
   */
  private splitIntoChunks(text: string, maxLength: number): string[] {
    const chunks: string[] = [];
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    let currentChunk = "";

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length <= maxLength) {
        currentChunk += sentence + " ";
      } else {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = sentence + " ";
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Estimate duration based on text length and speaking rate
   */
  private estimateDuration(text: string, speakingRate: number): number {
    // Estimate: ~150 words per minute at 1.0 rate
    const wordCount = text.split(/\s+/).length;
    const baseDurationMs = (wordCount / 150) * 60 * 1000;
    return Math.ceil(baseDurationMs / speakingRate);
  }

  /**
   * Generate TTS for ebook (alias for synthesizeSpeech)
   */
  async synthesizeEbook(
    text: string,
    options: TTSOptions = {},
    includeTimings: boolean = true
  ): Promise<TTSResult> {
    return this.synthesizeSpeech(text, options, includeTimings);
  }

  /**
   * Check if Azure TTS is available
   */
  isAvailable(): boolean {
    return !!(this.subscriptionKey && this.region);
  }
}

export default new AzureTextToSpeechService();

