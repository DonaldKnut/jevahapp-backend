import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import logger from "../../utils/logger";
import { computeDistributedAudioSampleOffsets } from "../../utils/verificationAudio.util";
import { transcriptionService } from "../transcription.service";
import {
  clipDurationsWithinBudget,
  getEvidenceProfile,
} from "../moderation/evidenceProfile";
import {
  checkFFmpegAvailable,
  cleanupFile,
  getVerificationTempDir,
} from "./tempWorkspace";
import {
  extractAudioSampleFromPath,
  extractMultipleAudioSamplesFromPath,
  processVideoPath,
} from "./videoPathEvidence";

const execAsync = promisify(exec);

export async function processVideoContent(
  videoBuffer: Buffer,
  videoMimeType: string,
  uploadId: string,
  reportProgress: (progress: number, stage: string, message: string) => void,
  onComplete: (transcript: string, frames: string[]) => void
): Promise<void> {
  reportProgress(20, "validating", "Validating video format...");

  // Write the source once and reuse for duration/audio/frames (avoids multi-GB temp duplication)
  const sharedId = `video-${uploadId}-${Date.now()}`;
  const sharedInputPath = path.join(getVerificationTempDir(), `${sharedId}-input`);
  fs.writeFileSync(sharedInputPath, videoBuffer);

  try {
    await processVideoPath(
      sharedInputPath,
      videoMimeType,
      uploadId,
      reportProgress,
      onComplete
    );
  } finally {
    cleanupFile(sharedInputPath);
  }
}

export async function processVideoContentLegacyBuffer(
  videoBuffer: Buffer,
  videoMimeType: string,
  uploadId: string,
  reportProgress: (progress: number, stage: string, message: string) => void,
  onComplete: (transcript: string, frames: string[]) => void
): Promise<void> {
  return processVideoContent(
    videoBuffer,
    videoMimeType,
    uploadId,
    reportProgress,
    onComplete
  );
}

export async function processAudioContent(
  audioBuffer: Buffer,
  audioMimeType: string,
  uploadId: string,
  reportProgress: (progress: number, stage: string, message: string) => void,
  onComplete: (transcript: string) => void
): Promise<void> {
  reportProgress(20, "validating", "Validating audio format...");

  // Get audio duration
  const duration = await getAudioDuration(audioBuffer, audioMimeType);
  logger.info("Audio duration detected", { duration, uploadId });

  reportProgress(30, "analyzing", "Preparing distributed audio samples...");

  const profile = getEvidenceProfile("music", audioMimeType);
  const { offsets, clipSeconds } = clipDurationsWithinBudget(profile, duration);

  // Write once for multi-offset extraction when possible
  const tempId = `audio-${uploadId}-${Date.now()}`;
  const inputPath = path.join(getVerificationTempDir(), `${tempId}-input`);
  fs.writeFileSync(inputPath, audioBuffer);

  let audioSample: { audioBuffer: Buffer; duration?: number } | Array<{ audioBuffer: Buffer; duration?: number }>;
  try {
    audioSample =
      offsets.length > 1
        ? await extractMultipleAudioSamplesFromPath(
            inputPath,
            duration,
            offsets,
            clipSeconds
          )
        : await extractAudioSampleFromPath(
            inputPath,
            Math.min(clipSeconds, duration)
          );
  } finally {
    cleanupFile(inputPath);
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

export async function extractMultipleAudioSamples(
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
      extractAudioSample(mediaBuffer, mimeType, sampleDuration, start)
    )
  );
}

export async function extractAudioSample(
  mediaBuffer: Buffer,
  mimeType: string,
  maxDuration: number,
  startOffset: number = 0
): Promise<{ audioBuffer: Buffer; duration?: number }> {
  const ffmpegAvailable = await checkFFmpegAvailable();
  if (!ffmpegAvailable) {
    throw new Error("FFmpeg is required for audio extraction");
  }

  const tempId = `audio-sample-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  const inputPath = path.join(getVerificationTempDir(), `${tempId}-input`);
  const outputPath = path.join(getVerificationTempDir(), `${tempId}-output.mp3`);

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
    cleanupFile(inputPath);
    cleanupFile(outputPath);

    return { audioBuffer, duration: maxDuration };
  } catch (error: any) {
    cleanupFile(inputPath);
    cleanupFile(outputPath);
    logger.error("Error extracting audio sample:", error);
    throw new Error(`Audio extraction failed: ${error.message}`);
  }
}

export async function extractVideoFramesOptimized(
  videoBuffer: Buffer,
  videoMimeType: string,
  frameCount: number,
  duration: number
): Promise<{ frames: string[] }> {
  const ffmpegAvailable = await checkFFmpegAvailable();
  if (!ffmpegAvailable) {
    throw new Error("FFmpeg is required for frame extraction");
  }

  const tempId = `frames-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  const inputPath = path.join(getVerificationTempDir(), `${tempId}-input`);
  const framesDir = path.join(getVerificationTempDir(), tempId);

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
    cleanupFile(inputPath);
    if (fs.existsSync(framesDir)) {
      fs.readdirSync(framesDir).forEach((file) => {
        cleanupFile(path.join(framesDir, file));
      });
      fs.rmdirSync(framesDir);
    }

    return { frames };
  } catch (error: any) {
    cleanupFile(inputPath);
    if (fs.existsSync(framesDir)) {
      try {
        fs.readdirSync(framesDir).forEach((file) => {
          cleanupFile(path.join(framesDir, file));
        });
        fs.rmdirSync(framesDir);
      } catch { }
    }
    logger.error("Error extracting video frames:", error);
    throw new Error(`Frame extraction failed: ${error.message}`);
  }
}

export async function getVideoDuration(
  videoBuffer: Buffer,
  videoMimeType: string
): Promise<number> {
  const ffmpegAvailable = await checkFFmpegAvailable();
  if (!ffmpegAvailable) {
    return 10; // Default fallback
  }

  const tempId = `duration-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  const inputPath = path.join(getVerificationTempDir(), `${tempId}-input`);

  try {
    fs.writeFileSync(inputPath, videoBuffer);
    const durationCommand = `ffprobe -i "${inputPath}" -show_entries format=duration -v quiet -of csv="p=0"`;
    const { stdout } = await execAsync(durationCommand);
    const duration = parseFloat(stdout.trim()) || 10;

    cleanupFile(inputPath);
    return duration;
  } catch (error) {
    cleanupFile(inputPath);
    logger.warn("Could not get video duration, using default");
    return 10;
  }
}

export async function getAudioDuration(
  audioBuffer: Buffer,
  audioMimeType: string
): Promise<number> {
  const ffmpegAvailable = await checkFFmpegAvailable();
  if (!ffmpegAvailable) {
    return 60; // Default fallback
  }

  const tempId = `duration-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  const inputPath = path.join(getVerificationTempDir(), `${tempId}-input`);

  try {
    fs.writeFileSync(inputPath, audioBuffer);
    const durationCommand = `ffprobe -i "${inputPath}" -show_entries format=duration -v quiet -of csv="p=0"`;
    const { stdout } = await execAsync(durationCommand);
    const duration = parseFloat(stdout.trim()) || 60;

    cleanupFile(inputPath);
    return duration;
  } catch (error) {
    cleanupFile(inputPath);
    logger.warn("Could not get audio duration, using default");
    return 60;
  }
}
