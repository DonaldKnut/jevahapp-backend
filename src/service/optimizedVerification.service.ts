import logger from "../utils/logger";
import { computeDistributedAudioSampleOffsets } from "../utils/verificationAudio.util";
import { mediaProcessingService } from "./mediaProcessing.service";
import { transcriptionService } from "./transcription.service";
import { contentModerationService } from "./contentModeration.service";
import {
  clipDurationsWithinBudget,
  getEvidenceProfile,
} from "./moderation/evidenceProfile";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const execAsync = promisify(exec);

export interface VerificationProgress {
  uploadId: string;
  progress: number;
  stage: string;
  message: string;
  timestamp: string;
}

export interface OptimizedVerificationResult {
  isApproved: boolean;
  moderationResult: any;
  transcript?: string;
  videoFrames?: string[];
}

export type ProgressCallback = (progress: VerificationProgress) => void;

/**
 * Optimized verification service with:
 * - Parallel processing where possible
 * - Audio sampling (only first 30-60 seconds for transcription)
 * - Faster frame extraction
 * - Progress reporting
 */
export class OptimizedVerificationService {
  private tempDir: string;

  constructor() {
    this.tempDir = path.join(os.tmpdir(), "jevah-media-processing");
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Verify content with progress updates
   */
  async verifyContentWithProgress(
    file: Buffer,
    fileMimeType: string,
    contentType: string,
    title: string,
    description: string | undefined,
    uploadId: string,
    onProgress?: ProgressCallback,
    thumbnailBuffer?: Buffer,
    thumbnailMimeType?: string,
    opts?: { mediaId?: string; contentHash?: string }
  ): Promise<OptimizedVerificationResult> {
    const reportProgress = (progress: number, stage: string, message: string) => {
      if (onProgress) {
        onProgress({
          uploadId,
          progress,
          stage,
          message,
          timestamp: new Date().toISOString(),
        });
      }
    };

    reportProgress(10, "file_received", "File received, starting verification...");

    let transcript = "";
    let videoFrames: string[] = [];

    try {
      if ((contentType === "videos" || contentType === "sermon") && fileMimeType.startsWith("video")) {
        await this.processVideoContent(
          file,
          fileMimeType,
          uploadId,
          reportProgress,
          (t, f) => {
            transcript = t;
            videoFrames = f;
          }
        );
      } else if (
        (contentType === "music" || contentType === "audio") &&
        fileMimeType.startsWith("audio")
      ) {
        await this.processAudioContent(
          file,
          fileMimeType,
          uploadId,
          reportProgress,
          (t) => {
            transcript = t;
          }
        );
      } else if (contentType === "books") {
        await this.processBookContent(
          file,
          fileMimeType,
          uploadId,
          reportProgress,
          (t) => {
            transcript = t;
          }
        );
      }

      // Moderate thumbnail if provided (CRITICAL - first thing users see)
      let thumbnailBase64: string | undefined;
      if (thumbnailBuffer) {
        reportProgress(72, "moderating", "Checking thumbnail image...");
        thumbnailBase64 = `data:${thumbnailMimeType || "image/jpeg"};base64,${thumbnailBuffer.toString("base64")}`;
      }

      // Run moderation (includes thumbnail check)
      reportProgress(75, "moderating", "Checking content guidelines...");
      const moderationResult = await contentModerationService.moderateContent({
        transcript: transcript || undefined,
        videoFrames: videoFrames.length > 0 ? videoFrames : undefined,
        thumbnail: thumbnailBase64,
        title,
        description,
        contentType,
        mediaId: opts?.mediaId,
        contentHash: opts?.contentHash,
        fileMimeType,
      });

      reportProgress(95, "finalizing", "Verification complete!");

      return {
        isApproved: moderationResult.isApproved,
        moderationResult,
        transcript: transcript || undefined,
        videoFrames: videoFrames.length > 0 ? videoFrames : undefined,
      };
    } catch (error: any) {
      logger.error("Optimized verification error:", error);
      reportProgress(0, "error", `Verification failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Worker entry point for staged video uploads. Evidence is extracted from
   * disk so a 300MB source is never materialized as one Node.js Buffer.
   */
  async verifyVideoPathWithProgress(
    filePath: string,
    fileMimeType: string,
    contentType: string,
    title: string,
    description: string | undefined,
    uploadId: string,
    opts?: { mediaId?: string; contentHash?: string }
  ): Promise<OptimizedVerificationResult> {
    let transcript = "";
    let videoFrames: string[] = [];
    const reportProgress = (
      progress: number,
      stage: string,
      message: string
    ) => {
      logger.debug("Staged video verification progress", {
        uploadId,
        progress,
        stage,
        message,
      });
    };
    await this.processVideoPath(
      filePath,
      fileMimeType,
      uploadId,
      reportProgress,
      (t, f) => {
        transcript = t;
        videoFrames = f;
      }
    );
    const moderationResult = await contentModerationService.moderateContent({
      transcript: transcript || undefined,
      videoFrames: videoFrames.length ? videoFrames : undefined,
      title,
      description,
      contentType,
      mediaId: opts?.mediaId,
      contentHash: opts?.contentHash,
      fileMimeType,
    });
    return {
      isApproved: moderationResult.isApproved,
      moderationResult,
      transcript: transcript || undefined,
      videoFrames: videoFrames.length ? videoFrames : undefined,
    };
  }

  /**
   * Process video content with optimized extraction
   */
  private async processVideoContent(
    videoBuffer: Buffer,
    videoMimeType: string,
    uploadId: string,
    reportProgress: (progress: number, stage: string, message: string) => void,
    onComplete: (transcript: string, frames: string[]) => void
  ): Promise<void> {
    reportProgress(20, "validating", "Validating video format...");

    // Write the source once and reuse for duration/audio/frames (avoids multi-GB temp duplication)
    const sharedId = `video-${uploadId}-${Date.now()}`;
    const sharedInputPath = path.join(this.tempDir, `${sharedId}-input`);
    fs.writeFileSync(sharedInputPath, videoBuffer);

    try {
      await this.processVideoPath(
        sharedInputPath,
        videoMimeType,
        uploadId,
        reportProgress,
        onComplete
      );
    } finally {
      this.cleanupFile(sharedInputPath);
    }
  }

  private async processVideoPath(
    inputPath: string,
    videoMimeType: string,
    uploadId: string,
    reportProgress: (progress: number, stage: string, message: string) => void,
    onComplete: (transcript: string, frames: string[]) => void
  ): Promise<void> {
    const duration = await this.getVideoDurationFromPath(inputPath);
    logger.info("Video duration detected", { duration, uploadId });
    reportProgress(30, "analyzing", "Extracting audio and frames...");

    const profile = getEvidenceProfile("videos", videoMimeType);
    const { offsets, clipSeconds } = clipDurationsWithinBudget(profile, duration);
    const frameCount = Math.min(
      profile.maxFrames,
      Math.max(profile.minFrames, Math.floor(duration / 90) + 2)
    );
    const audioResult =
      offsets.length > 1
        ? await this.extractMultipleAudioSamplesFromPath(
            inputPath,
            duration,
            offsets,
            clipSeconds
          )
        : await this.extractAudioSampleFromPath(
            inputPath,
            Math.min(clipSeconds, duration)
          );
    const framesResult = await this.extractVideoFramesFromPath(
      inputPath,
      frameCount,
      duration
    );
    reportProgress(50, "analyzing", "Transcribing audio...");

    let transcript = "";
    try {
      if (Array.isArray(audioResult)) {
        const chunks: string[] = [];
        for (let i = 0; i < audioResult.length; i += 2) {
          const parts = await Promise.all(
            audioResult
              .slice(i, i + 2)
              .map(sample =>
                transcriptionService.transcribeAudio(
                  sample.audioBuffer,
                  "audio/mp3"
                )
              )
          );
          chunks.push(...parts.map(t => t.transcript));
        }
        transcript = chunks.join(" ");
      } else {
        transcript = (
          await transcriptionService.transcribeAudio(
            audioResult.audioBuffer,
            "audio/mp3"
          )
        ).transcript;
      }
      logger.info("Video transcription completed", {
        transcriptLength: transcript.length,
        uploadId,
        segmentsProcessed: Array.isArray(audioResult) ? audioResult.length : 1,
      });
    } catch (error: any) {
      logger.warn("Transcription failed, continuing with frames only:", error);
    }
    reportProgress(70, "analyzing", "Processing complete!");
    onComplete(transcript, framesResult.frames);
  }

  private async getVideoDurationFromPath(inputPath: string): Promise<number> {
    try {
      const durationCommand = `ffprobe -i "${inputPath}" -show_entries format=duration -v quiet -of csv="p=0"`;
      const { stdout } = await execAsync(durationCommand, { timeout: 30_000 });
      return parseFloat(stdout.trim()) || 10;
    } catch {
      return 10;
    }
  }

  private async extractAudioSampleFromPath(
    inputPath: string,
    maxDuration: number,
    startOffset = 0
  ): Promise<{ audioBuffer: Buffer; duration?: number }> {
    const tempId = `audio-sample-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const outputPath = path.join(this.tempDir, `${tempId}-output.mp3`);
    try {
      const command =
        startOffset > 0
          ? `ffmpeg -i "${inputPath}" -ss ${startOffset} -t ${maxDuration} -vn -acodec libmp3lame -ar 44100 -ac 2 -y "${outputPath}"`
          : `ffmpeg -i "${inputPath}" -t ${maxDuration} -vn -acodec libmp3lame -ar 44100 -ac 2 -y "${outputPath}"`;
      await execAsync(command, { timeout: 120_000 });
      const audioBuffer = fs.readFileSync(outputPath);
      return { audioBuffer, duration: maxDuration };
    } finally {
      this.cleanupFile(outputPath);
    }
  }

  private async extractMultipleAudioSamplesFromPath(
    inputPath: string,
    duration: number,
    offsets?: number[],
    clipSeconds = 45
  ): Promise<Array<{ audioBuffer: Buffer; duration?: number }>> {
    const profile = getEvidenceProfile("videos");
    const planned =
      offsets && offsets.length
        ? { offsets, clipSeconds }
        : clipDurationsWithinBudget(profile, duration);
    const samples: Array<{ audioBuffer: Buffer; duration?: number }> = [];
    for (const offset of planned.offsets) {
      samples.push(
        await this.extractAudioSampleFromPath(
          inputPath,
          planned.clipSeconds,
          offset
        )
      );
    }
    return samples;
  }

  private async extractVideoFramesFromPath(
    inputPath: string,
    frameCount: number,
    duration: number
  ): Promise<{ frames: string[] }> {
    const tempId = `frames-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const framesDir = path.join(this.tempDir, tempId);
    if (!fs.existsSync(framesDir)) fs.mkdirSync(framesDir, { recursive: true });

    try {
      const timestamps: number[] = [];
      if (frameCount === 1) {
        timestamps.push(Math.max(5, duration * 0.5));
      } else {
        for (let i = 0; i < frameCount; i++) {
          const t = Math.max(1, (duration * i) / Math.max(1, frameCount - 1));
          timestamps.push(Math.min(duration - 0.5, t));
        }
      }

      const frames: string[] = [];
      // Bound concurrent ffmpeg frame extracts
      const concurrency = 3;
      for (let i = 0; i < timestamps.length; i += concurrency) {
        const batch = timestamps.slice(i, i + concurrency);
        const batchFrames = await Promise.all(
          batch.map(async (ts, idx) => {
            const out = path.join(framesDir, `frame-${i + idx}.jpg`);
            try {
              await execAsync(
                `ffmpeg -ss ${ts} -i "${inputPath}" -frames:v 1 -q:v 4 -y "${out}"`,
                { timeout: 60_000 }
              );
              if (fs.existsSync(out)) {
                const b64 = fs.readFileSync(out).toString("base64");
                this.cleanupFile(out);
                return `data:image/jpeg;base64,${b64}`;
              }
            } catch {
              this.cleanupFile(out);
            }
            return null;
          })
        );
        for (const f of batchFrames) if (f) frames.push(f);
      }
      return { frames };
    } finally {
      try {
        fs.rmSync(framesDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  }

  /**
   * Process video content with optimized extraction (legacy entry kept for buffer callers)
   */
  private async processVideoContentLegacyBuffer(
    videoBuffer: Buffer,
    videoMimeType: string,
    uploadId: string,
    reportProgress: (progress: number, stage: string, message: string) => void,
    onComplete: (transcript: string, frames: string[]) => void
  ): Promise<void> {
    return this.processVideoContent(
      videoBuffer,
      videoMimeType,
      uploadId,
      reportProgress,
      onComplete
    );
  }

  /**
   * Process audio content with optimized extraction
   */
  private async processAudioContent(
    audioBuffer: Buffer,
    audioMimeType: string,
    uploadId: string,
    reportProgress: (progress: number, stage: string, message: string) => void,
    onComplete: (transcript: string) => void
  ): Promise<void> {
    reportProgress(20, "validating", "Validating audio format...");

    // Get audio duration
    const duration = await this.getAudioDuration(audioBuffer, audioMimeType);
    logger.info("Audio duration detected", { duration, uploadId });

    reportProgress(30, "analyzing", "Preparing distributed audio samples...");

    const profile = getEvidenceProfile("music", audioMimeType);
    const { offsets, clipSeconds } = clipDurationsWithinBudget(profile, duration);

    // Write once for multi-offset extraction when possible
    const tempId = `audio-${uploadId}-${Date.now()}`;
    const inputPath = path.join(this.tempDir, `${tempId}-input`);
    fs.writeFileSync(inputPath, audioBuffer);

    let audioSample: { audioBuffer: Buffer; duration?: number } | Array<{ audioBuffer: Buffer; duration?: number }>;
    try {
      audioSample =
        offsets.length > 1
          ? await this.extractMultipleAudioSamplesFromPath(
              inputPath,
              duration,
              offsets,
              clipSeconds
            )
          : await this.extractAudioSampleFromPath(
              inputPath,
              Math.min(clipSeconds, duration)
            );
    } finally {
      this.cleanupFile(inputPath);
    }

    reportProgress(40, "analyzing", "Transcribing audio...");

    let transcript = "";
    try {
      if (Array.isArray(audioSample)) {
        const chunks: string[] = [];
        for (let i = 0; i < audioSample.length; i += 2) {
          const batch = audioSample.slice(i, i + 2);
          const parts = await Promise.all(
            batch.map(sample =>
              transcriptionService.transcribeAudio(
                sample.audioBuffer,
                audioMimeType === "audio/mpeg" ? "audio/mp3" : audioMimeType
              )
            )
          );
          chunks.push(...parts.map(t => t.transcript));
        }
        transcript = chunks.join(" ");
      } else {
        const transcriptionResult = await transcriptionService.transcribeAudio(
          audioSample.audioBuffer,
          audioMimeType === "audio/mpeg" ? "audio/mp3" : audioMimeType
        );
        transcript = transcriptionResult.transcript;
      }

      logger.info("Audio transcription completed", {
        transcriptLength: transcript.length,
        uploadId,
        segmentsProcessed: Array.isArray(audioSample) ? audioSample.length : 1,
      });
    } catch (error: any) {
      logger.warn("Transcription failed:", error);
    }

    reportProgress(70, "analyzing", "Processing complete!");

    onComplete(transcript);
  }

  /**
   * Process book content
   */
  private async processBookContent(
    fileBuffer: Buffer,
    fileMimeType: string,
    uploadId: string,
    reportProgress: (progress: number, stage: string, message: string) => void,
    onComplete: (text: string) => void
  ): Promise<void> {
    reportProgress(20, "validating", "Validating book format...");

    let text = "";

    try {
      const profile = getEvidenceProfile("books", fileMimeType);
      let fullText = "";
      if (fileMimeType === "application/pdf") {
        reportProgress(30, "analyzing", "Extracting text from PDF...");
        fullText = await this.extractTextFromPDF(fileBuffer);
      } else if (fileMimeType === "application/epub+zip") {
        reportProgress(30, "analyzing", "Extracting text from EPUB...");
        fullText = await this.extractTextFromEPUB(fileBuffer);
      } else {
        logger.warn("Unsupported book file type", { fileMimeType, uploadId });
      }

      // Distributed windows across the whole book — not only the opening pages
      text = this.sampleDistributedText(fullText, profile.maxTextChars, profile.textWindows);
      logger.info("Book text sampling completed", {
        textLength: text.length,
        fullLength: fullText.length,
        uploadId,
      });
    } catch (error: any) {
      logger.warn("Book text extraction failed:", error);
    }

    reportProgress(70, "analyzing", "Processing complete!");

    onComplete(text);
  }

  /** Take evenly spaced windows from start → end of the document. */
  private sampleDistributedText(
    fullText: string,
    maxChars: number,
    windows: number
  ): string {
    const cleaned = (fullText || "").replace(/\s+/g, " ").trim();
    if (!cleaned) return "";
    if (cleaned.length <= maxChars) return cleaned;
    const n = Math.max(1, windows);
    const per = Math.floor(maxChars / n);
    const parts: string[] = [];
    for (let i = 0; i < n; i++) {
      const start = Math.floor((i / Math.max(1, n - 1)) * Math.max(0, cleaned.length - per));
      parts.push(cleaned.slice(start, start + per));
    }
    return parts.join(" … ");
  }

  /**
   * Extract text from PDF buffer
   */
  private async extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
    try {
      // Dynamic import for pdf-parse
      const pdfParseModule = await new Function('return import("pdf-parse")')();
      const { PDFParse } = pdfParseModule;

      const pdfParser = new PDFParse({ data: pdfBuffer });
      const textResult = await pdfParser.getText();
      await pdfParser.destroy();

      let fullText = "";
      if (textResult.pages && textResult.pages.length > 0) {
        fullText = textResult.pages
          .map((pageData: any) => pageData.text || "")
          .join("\n");
      } else if (textResult.text) {
        fullText = textResult.text;
      }

      fullText = fullText.replace(/\s+/g, " ").trim();
      return fullText.substring(0, 10000);
    } catch (error: any) {
      logger.error("Failed to extract text from PDF", { error: error.message });
      return "";
    }
  }

  /**
   * Extract text from EPUB buffer
   */
  private async extractTextFromEPUB(epubBuffer: Buffer): Promise<string> {
    try {
      const JSZip = await import("jszip" as any).catch(() => null);
      if (!JSZip) {
        logger.warn("JSZip not available, EPUB text extraction will be limited");
        return "";
      }

      const zip = new JSZip.default();
      const zipData = await zip.loadAsync(epubBuffer);

      let fullText = "";
      const contentFiles: string[] = [];

      zipData.forEach((relativePath: string, file: any) => {
        if (
          !file.dir &&
          (relativePath.endsWith(".html") ||
            relativePath.endsWith(".xhtml") ||
            relativePath.endsWith(".htm")) &&
          !relativePath.includes("META-INF") &&
          !relativePath.includes("mimetype")
        ) {
          contentFiles.push(relativePath);
        }
      });

      // Limit to first 5 files for speed
      for (const filePath of contentFiles.slice(0, 5)) {
        try {
          const fileContent = await zipData.file(filePath)?.async("string");
          if (fileContent) {
            const textContent = fileContent
              .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim();

            if (textContent) {
              fullText += textContent + "\n";
            }
          }
        } catch (error) {
          logger.warn(`Failed to extract text from EPUB file: ${filePath}`, error);
        }
      }

      fullText = fullText.trim();
      return fullText ? fullText.substring(0, 10000) : "";
    } catch (error: any) {
      logger.error("Failed to extract text from EPUB", { error: error.message });
      return "";
    }
  }

  /**
   * Extract multiple audio samples from different segments (spread across the timeline).
   */
  private async extractMultipleAudioSamples(
    mediaBuffer: Buffer,
    mimeType: string,
    totalDuration: number
  ): Promise<Array<{ audioBuffer: Buffer; duration?: number }>> {
    const sampleDuration = 60;
    const maxSegments = Math.min(
      12,
      Math.max(3, Number(process.env.VERIFICATION_MAX_AUDIO_SEGMENTS || 5))
    );
    const offsets = computeDistributedAudioSampleOffsets(
      totalDuration,
      sampleDuration,
      maxSegments
    );

    return Promise.all(
      offsets.map((start) =>
        this.extractAudioSample(mediaBuffer, mimeType, sampleDuration, start)
      )
    );
  }

  /**
   * Extract audio sample (N seconds starting from offset) for faster transcription
   */
  private async extractAudioSample(
    mediaBuffer: Buffer,
    mimeType: string,
    maxDuration: number,
    startOffset: number = 0
  ): Promise<{ audioBuffer: Buffer; duration?: number }> {
    const ffmpegAvailable = await this.checkFFmpegAvailable();
    if (!ffmpegAvailable) {
      throw new Error("FFmpeg is required for audio extraction");
    }

    const tempId = `audio-sample-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const inputPath = path.join(this.tempDir, `${tempId}-input`);
    const outputPath = path.join(this.tempDir, `${tempId}-output.mp3`);

    try {
      // Write media buffer to temp file
      fs.writeFileSync(inputPath, mediaBuffer);

      // Extract N seconds of audio starting from offset
      // If startOffset is 0, extract from beginning
      // Otherwise, seek to offset first
      const command = startOffset > 0
        ? `ffmpeg -i "${inputPath}" -ss ${startOffset} -t ${maxDuration} -vn -acodec libmp3lame -ar 44100 -ac 2 -y "${outputPath}"`
        : `ffmpeg -i "${inputPath}" -t ${maxDuration} -vn -acodec libmp3lame -ar 44100 -ac 2 -y "${outputPath}"`;

      await execAsync(command);

      // Read extracted audio
      const audioBuffer = fs.readFileSync(outputPath);

      // Cleanup
      this.cleanupFile(inputPath);
      this.cleanupFile(outputPath);

      return { audioBuffer, duration: maxDuration };
    } catch (error: any) {
      this.cleanupFile(inputPath);
      this.cleanupFile(outputPath);
      logger.error("Error extracting audio sample:", error);
      throw new Error(`Audio extraction failed: ${error.message}`);
    }
  }

  /**
   * Optimized video frame extraction - extracts frames more efficiently
   */
  private async extractVideoFramesOptimized(
    videoBuffer: Buffer,
    videoMimeType: string,
    frameCount: number,
    duration: number
  ): Promise<{ frames: string[] }> {
    const ffmpegAvailable = await this.checkFFmpegAvailable();
    if (!ffmpegAvailable) {
      throw new Error("FFmpeg is required for frame extraction");
    }

    const tempId = `frames-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const inputPath = path.join(this.tempDir, `${tempId}-input`);
    const framesDir = path.join(this.tempDir, tempId);

    if (!fs.existsSync(framesDir)) {
      fs.mkdirSync(framesDir, { recursive: true });
    }

    try {
      // Write video buffer to temp file
      fs.writeFileSync(inputPath, videoBuffer);

      const frames: string[] = [];

      // Extract frames at strategic points for maximum coverage
      // Critical: Always check beginning to catch immediate inappropriate content
      const timestamps: number[] = [];
      if (frameCount === 1) {
        timestamps.push(Math.max(5, duration * 0.5)); // Middle or first 5 seconds
      } else if (frameCount === 2) {
        // Beginning and middle for safety
        timestamps.push(Math.max(5, duration * 0.1), duration * 0.5);
      } else if (frameCount === 3) {
        // Beginning, middle, end - optimal coverage
        timestamps.push(Math.max(5, duration * 0.05), duration * 0.5, Math.max(duration - 10, duration * 0.9));
      } else {
        // More frames: beginning, distributed middle, end
        timestamps.push(Math.max(5, duration * 0.05)); // Beginning
        for (let i = 1; i < frameCount - 1; i++) {
          timestamps.push((duration / frameCount) * i); // Middle frames
        }
        timestamps.push(Math.max(duration - 10, duration * 0.95)); // End
      }

      // Extract frames in parallel for speed
      const framePromises = timestamps.map(async (timestamp, index) => {
        const framePath = path.join(framesDir, `frame-${index}.jpg`);
        // Use faster extraction settings: lower quality for speed, skip to exact timestamp
        const command = `ffmpeg -ss ${timestamp} -i "${inputPath}" -vframes 1 -vf "scale=320:-1" -q:v 5 -y "${framePath}"`;
        await execAsync(command);

        if (fs.existsSync(framePath)) {
          const frameBuffer = fs.readFileSync(framePath);
          const base64 = frameBuffer.toString("base64");
          return `data:image/jpeg;base64,${base64}`;
        }
        return null;
      });

      const frameResults = await Promise.all(framePromises);
      frames.push(...frameResults.filter((f): f is string => f !== null));

      // Cleanup
      this.cleanupFile(inputPath);
      if (fs.existsSync(framesDir)) {
        fs.readdirSync(framesDir).forEach((file) => {
          this.cleanupFile(path.join(framesDir, file));
        });
        fs.rmdirSync(framesDir);
      }

      return { frames };
    } catch (error: any) {
      this.cleanupFile(inputPath);
      if (fs.existsSync(framesDir)) {
        try {
          fs.readdirSync(framesDir).forEach((file) => {
            this.cleanupFile(path.join(framesDir, file));
          });
          fs.rmdirSync(framesDir);
        } catch { }
      }
      logger.error("Error extracting video frames:", error);
      throw new Error(`Frame extraction failed: ${error.message}`);
    }
  }

  /**
   * Get video duration quickly
   */
  private async getVideoDuration(
    videoBuffer: Buffer,
    videoMimeType: string
  ): Promise<number> {
    const ffmpegAvailable = await this.checkFFmpegAvailable();
    if (!ffmpegAvailable) {
      return 10; // Default fallback
    }

    const tempId = `duration-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const inputPath = path.join(this.tempDir, `${tempId}-input`);

    try {
      fs.writeFileSync(inputPath, videoBuffer);
      const durationCommand = `ffprobe -i "${inputPath}" -show_entries format=duration -v quiet -of csv="p=0"`;
      const { stdout } = await execAsync(durationCommand);
      const duration = parseFloat(stdout.trim()) || 10;

      this.cleanupFile(inputPath);
      return duration;
    } catch (error) {
      this.cleanupFile(inputPath);
      logger.warn("Could not get video duration, using default");
      return 10;
    }
  }

  /**
   * Get audio duration quickly
   */
  private async getAudioDuration(
    audioBuffer: Buffer,
    audioMimeType: string
  ): Promise<number> {
    const ffmpegAvailable = await this.checkFFmpegAvailable();
    if (!ffmpegAvailable) {
      return 60; // Default fallback
    }

    const tempId = `duration-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const inputPath = path.join(this.tempDir, `${tempId}-input`);

    try {
      fs.writeFileSync(inputPath, audioBuffer);
      const durationCommand = `ffprobe -i "${inputPath}" -show_entries format=duration -v quiet -of csv="p=0"`;
      const { stdout } = await execAsync(durationCommand);
      const duration = parseFloat(stdout.trim()) || 60;

      this.cleanupFile(inputPath);
      return duration;
    } catch (error) {
      this.cleanupFile(inputPath);
      logger.warn("Could not get audio duration, using default");
      return 60;
    }
  }

  /**
   * Check if FFmpeg is available
   */
  private async checkFFmpegAvailable(): Promise<boolean> {
    try {
      await execAsync("ffmpeg -version");
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Cleanup temporary file
   */
  private cleanupFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      logger.warn(`Failed to cleanup file ${filePath}:`, error);
    }
  }
}

// Export singleton instance
export const optimizedVerificationService = new OptimizedVerificationService();

