import logger from "../utils/logger";
import { mediaProcessingService } from "./mediaProcessing.service";
import { transcriptionService } from "./transcription.service";
import { contentModerationService } from "./contentModeration.service";
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
    thumbnailMimeType?: string
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
      if (contentType === "videos" && fileMimeType.startsWith("video")) {
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

    // Get video duration first (quick operation)
    const duration = await this.getVideoDuration(videoBuffer, videoMimeType);
    logger.info("Video duration detected", { duration, uploadId });

    reportProgress(30, "analyzing", "Extracting audio and frames...");

    // Determine optimal sampling strategy based on video length
    // For safety: Always check beginning, and check middle/end for longer videos
    const shouldSampleMultiple = duration > 120; // If longer than 2 minutes, sample multiple segments
    
    // Run audio extraction and frame extraction in parallel for speed
    const [audioResult, framesResult] = await Promise.all([
      // Extract audio sample(s) - multiple segments for longer videos to catch inappropriate content anywhere
      shouldSampleMultiple
        ? this.extractMultipleAudioSamples(videoBuffer, videoMimeType, duration)
        : this.extractAudioSample(videoBuffer, videoMimeType, Math.min(60, duration)),
      // Extract 3 frames for better coverage: beginning, middle, end
      this.extractVideoFramesOptimized(videoBuffer, videoMimeType, 3, duration),
    ]);

    reportProgress(50, "analyzing", "Transcribing audio...");

    // Transcribe the audio sample(s)
    let transcript = "";
    try {
      // If multiple samples, combine transcripts
      if (Array.isArray(audioResult)) {
        const transcripts = await Promise.all(
          audioResult.map(sample => 
            transcriptionService.transcribeAudio(sample.audioBuffer, "audio/mp3")
          )
        );
        transcript = transcripts.map(t => t.transcript).join(" ");
      } else {
        const transcriptionResult = await transcriptionService.transcribeAudio(
          audioResult.audioBuffer,
          "audio/mp3"
        );
        transcript = transcriptionResult.transcript;
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

    reportProgress(30, "analyzing", "Preparing audio sample...");

    // For longer audio files, sample multiple segments to catch inappropriate content
    // For safety: Always check beginning, and check middle/end for longer files
    const shouldSampleMultiple = duration > 120; // If longer than 2 minutes
    
    const audioSample = shouldSampleMultiple
      ? await this.extractMultipleAudioSamples(audioBuffer, audioMimeType, duration)
      : await this.extractAudioSample(audioBuffer, audioMimeType, Math.min(60, duration));

    reportProgress(40, "analyzing", "Transcribing audio...");

    let transcript = "";
    try {
      // If multiple samples, combine transcripts
      if (Array.isArray(audioSample)) {
        const transcripts = await Promise.all(
          audioSample.map(sample => 
            transcriptionService.transcribeAudio(
              sample.audioBuffer,
              audioMimeType === "audio/mpeg" ? "audio/mp3" : audioMimeType
            )
          )
        );
        transcript = transcripts.map(t => t.transcript).join(" ");
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
      if (fileMimeType === "application/pdf") {
        reportProgress(30, "analyzing", "Extracting text from PDF...");
        text = await this.extractTextFromPDF(fileBuffer);
        // Limit to first 5000 characters for faster moderation
        text = text.substring(0, 5000);
        logger.info("PDF text extraction completed", {
          textLength: text.length,
          uploadId,
        });
      } else if (fileMimeType === "application/epub+zip") {
        reportProgress(30, "analyzing", "Extracting text from EPUB...");
        text = await this.extractTextFromEPUB(fileBuffer);
        text = text.substring(0, 5000);
        logger.info("EPUB text extraction completed", {
          textLength: text.length,
          uploadId,
        });
      } else {
        logger.warn("Unsupported book file type", { fileMimeType, uploadId });
      }
    } catch (error: any) {
      logger.warn("Book text extraction failed:", error);
    }

    reportProgress(70, "analyzing", "Processing complete!");

    onComplete(text);
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
   * Extract multiple audio samples from different segments
   * For safety: checks beginning, middle, and end to catch inappropriate content anywhere
   */
  private async extractMultipleAudioSamples(
    mediaBuffer: Buffer,
    mimeType: string,
    totalDuration: number
  ): Promise<Array<{ audioBuffer: Buffer; duration?: number }>> {
    const samples: Array<{ audioBuffer: Buffer; duration?: number }> = [];
    const sampleDuration = 60; // 60 seconds per sample
    
    // Sample 1: Beginning (first 60 seconds) - catches immediate inappropriate content
    samples.push(await this.extractAudioSample(mediaBuffer, mimeType, sampleDuration, 0));
    
    // Sample 2: Middle (around midpoint) - catches mid-video issues
    if (totalDuration > 180) {
      const middleStart = Math.max(0, (totalDuration / 2) - 30);
      samples.push(await this.extractAudioSample(mediaBuffer, mimeType, sampleDuration, middleStart));
    }
    
    // Sample 3: End (last 60 seconds) - catches inappropriate endings
    if (totalDuration > 120) {
      const endStart = Math.max(0, totalDuration - sampleDuration);
      samples.push(await this.extractAudioSample(mediaBuffer, mimeType, sampleDuration, endStart));
    }
    
    return samples;
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
        } catch {}
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

