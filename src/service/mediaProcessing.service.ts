import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import logger from "../utils/logger";

const execAsync = promisify(exec);

export interface AudioExtractionResult {
  audioPath: string;
  audioBuffer: Buffer;
  duration?: number;
}

export interface FrameExtractionResult {
  frames: string[]; // Base64 encoded images
  framePaths: string[];
}

export class MediaProcessingService {
  private tempDir: string;

  constructor() {
    // Create temp directory for processing
    this.tempDir = path.join(os.tmpdir(), "jevah-media-processing");
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Check if FFmpeg is available
   */
  async checkFFmpegAvailable(): Promise<boolean> {
    try {
      await execAsync("ffmpeg -version");
      return true;
    } catch (error) {
      logger.warn("FFmpeg not found. Media processing will be limited.");
      return false;
    }
  }

  /**
   * Extract audio from video file
   */
  async extractAudio(
    videoBuffer: Buffer,
    videoMimeType: string,
    outputFormat: "mp3" | "wav" = "mp3"
  ): Promise<AudioExtractionResult> {
    const ffmpegAvailable = await this.checkFFmpegAvailable();
    if (!ffmpegAvailable) {
      throw new Error("FFmpeg is required for audio extraction");
    }

    const tempId = `audio-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const inputPath = path.join(this.tempDir, `${tempId}-input`);
    const outputPath = path.join(this.tempDir, `${tempId}-output.${outputFormat}`);

    try {
      // Write video buffer to temp file
      fs.writeFileSync(inputPath, videoBuffer);

      // Extract audio using FFmpeg
      const command = `ffmpeg -i "${inputPath}" -vn -acodec ${outputFormat === "mp3" ? "libmp3lame" : "pcm_s16le"} -ar 44100 -ac 2 -y "${outputPath}"`;
      
      await execAsync(command);

      // Read extracted audio
      const audioBuffer = fs.readFileSync(outputPath);

      // Get duration if possible
      let duration: number | undefined;
      try {
        const durationCommand = `ffprobe -i "${inputPath}" -show_entries format=duration -v quiet -of csv="p=0"`;
        const { stdout } = await execAsync(durationCommand);
        duration = parseFloat(stdout.trim());
      } catch (error) {
        // Duration extraction failed, continue without it
      }

      // Cleanup temp files
      this.cleanupFile(inputPath);
      this.cleanupFile(outputPath);

      return {
        audioPath: outputPath,
        audioBuffer,
        duration,
      };
    } catch (error: any) {
      // Cleanup on error
      this.cleanupFile(inputPath);
      this.cleanupFile(outputPath);
      logger.error("Error extracting audio:", error);
      throw new Error(`Audio extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract key frames from video
   */
  async extractVideoFrames(
    videoBuffer: Buffer,
    videoMimeType: string,
    frameCount: number = 3
  ): Promise<FrameExtractionResult> {
    const ffmpegAvailable = await this.checkFFmpegAvailable();
    if (!ffmpegAvailable) {
      throw new Error("FFmpeg is required for frame extraction");
    }

    const tempId = `frames-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const inputPath = path.join(this.tempDir, `${tempId}-input`);
    const framesDir = path.join(this.tempDir, tempId);
    
    if (!fs.existsSync(framesDir)) {
      fs.mkdirSync(framesDir, { recursive: true });
    }

    try {
      // Write video buffer to temp file
      fs.writeFileSync(inputPath, videoBuffer);

      // Extract frames evenly distributed throughout the video
      // First, get video duration
      let duration = 10; // Default fallback
      try {
        const durationCommand = `ffprobe -i "${inputPath}" -show_entries format=duration -v quiet -of csv="p=0"`;
        const { stdout } = await execAsync(durationCommand);
        duration = parseFloat(stdout.trim()) || 10;
      } catch (error) {
        logger.warn("Could not get video duration, using default");
      }

      // Calculate frame timestamps
      const framePaths: string[] = [];
      const frames: string[] = [];

      for (let i = 0; i < frameCount; i++) {
        const timestamp = (duration / (frameCount + 1)) * (i + 1);
        const framePath = path.join(framesDir, `frame-${i}.jpg`);

        // Extract frame at specific timestamp
        const command = `ffmpeg -i "${inputPath}" -ss ${timestamp} -vframes 1 -q:v 2 -y "${framePath}"`;
        await execAsync(command);

        if (fs.existsSync(framePath)) {
          const frameBuffer = fs.readFileSync(framePath);
          const base64 = frameBuffer.toString("base64");
          frames.push(`data:image/jpeg;base64,${base64}`);
          framePaths.push(framePath);
        }
      }

      // Cleanup temp files
      this.cleanupFile(inputPath);
      framePaths.forEach(framePath => this.cleanupFile(framePath));
      if (fs.existsSync(framesDir)) {
        fs.rmdirSync(framesDir);
      }

      return {
        frames,
        framePaths: [], // Already cleaned up
      };
    } catch (error: any) {
      // Cleanup on error
      this.cleanupFile(inputPath);
      if (fs.existsSync(framesDir)) {
        fs.readdirSync(framesDir).forEach(file => {
          this.cleanupFile(path.join(framesDir, file));
        });
        fs.rmdirSync(framesDir);
      }
      logger.error("Error extracting video frames:", error);
      throw new Error(`Frame extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract audio from audio file (for transcription)
   * This is mainly for format conversion if needed
   */
  async prepareAudioForTranscription(
    audioBuffer: Buffer,
    audioMimeType: string
  ): Promise<Buffer> {
    // If already in a supported format, return as-is
    if (audioMimeType === "audio/wav" || audioMimeType === "audio/mpeg") {
      return audioBuffer;
    }

    // Otherwise, convert to WAV using FFmpeg
    const ffmpegAvailable = await this.checkFFmpegAvailable();
    if (!ffmpegAvailable) {
      // Return original if FFmpeg not available
      return audioBuffer;
    }

    const tempId = `transcribe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const inputPath = path.join(this.tempDir, `${tempId}-input`);
    const outputPath = path.join(this.tempDir, `${tempId}-output.wav`);

    try {
      fs.writeFileSync(inputPath, audioBuffer);
      const command = `ffmpeg -i "${inputPath}" -ar 16000 -ac 1 -y "${outputPath}"`;
      await execAsync(command);

      const convertedBuffer = fs.readFileSync(outputPath);

      this.cleanupFile(inputPath);
      this.cleanupFile(outputPath);

      return convertedBuffer;
    } catch (error: any) {
      this.cleanupFile(inputPath);
      this.cleanupFile(outputPath);
      logger.warn("Audio conversion failed, using original:", error);
      return audioBuffer;
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

  /**
   * Cleanup all temp files (for periodic cleanup)
   */
  async cleanupTempFiles(): Promise<void> {
    try {
      if (fs.existsSync(this.tempDir)) {
        const files = fs.readdirSync(this.tempDir);
        for (const file of files) {
          const filePath = path.join(this.tempDir, file);
          const stats = fs.statSync(filePath);
          // Delete files older than 1 hour
          if (Date.now() - stats.mtimeMs > 3600000) {
            if (stats.isDirectory()) {
              fs.rmSync(filePath, { recursive: true, force: true });
            } else {
              fs.unlinkSync(filePath);
            }
          }
        }
      }
    } catch (error) {
      logger.warn("Failed to cleanup temp files:", error);
    }
  }
}

// Export singleton instance
export const mediaProcessingService = new MediaProcessingService();


