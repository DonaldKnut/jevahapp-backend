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
import { cleanupFile, getVerificationTempDir } from "./tempWorkspace";
import { hasFfmpeg, MediaToolsError } from "../../utils/mediaTools";

const execAsync = promisify(exec);

export async function processVideoPath(
  inputPath: string,
  videoMimeType: string,
  uploadId: string,
  reportProgress: (progress: number, stage: string, message: string) => void,
  onComplete: (transcript: string, frames: string[]) => void
): Promise<void> {
  if (!(await hasFfmpeg())) {
    throw new MediaToolsError();
  }

  const duration = await getVideoDurationFromPath(inputPath);
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
  const framesResult = await extractVideoFramesFromPath(
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

export async function getVideoDurationFromPath(inputPath: string): Promise<number> {
  try {
    const durationCommand = `ffprobe -i "${inputPath}" -show_entries format=duration -v quiet -of csv="p=0"`;
    const { stdout } = await execAsync(durationCommand, { timeout: 30_000 });
    return parseFloat(stdout.trim()) || 10;
  } catch {
    return 10;
  }
}

export async function extractAudioSampleFromPath(
  inputPath: string,
  maxDuration: number,
  startOffset = 0
): Promise<{ audioBuffer: Buffer; duration?: number }> {
  if (!(await hasFfmpeg())) {
    throw new MediaToolsError();
  }
  const tempId = `audio-sample-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  const outputPath = path.join(getVerificationTempDir(), `${tempId}-output.mp3`);
  try {
    const command =
      startOffset > 0
        ? `ffmpeg -i "${inputPath}" -ss ${startOffset} -t ${maxDuration} -vn -acodec libmp3lame -ar 44100 -ac 2 -y "${outputPath}"`
        : `ffmpeg -i "${inputPath}" -t ${maxDuration} -vn -acodec libmp3lame -ar 44100 -ac 2 -y "${outputPath}"`;
    await execAsync(command, { timeout: 120_000 });
    const audioBuffer = fs.readFileSync(outputPath);
    return { audioBuffer, duration: maxDuration };
  } catch (error: any) {
    if (
      /not recognized|ENOENT|not found/i.test(String(error?.message || ""))
    ) {
      throw new MediaToolsError();
    }
    throw error;
  } finally {
    cleanupFile(outputPath);
  }
}

export async function extractMultipleAudioSamplesFromPath(
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
      await extractAudioSampleFromPath(
        inputPath,
        planned.clipSeconds,
        offset
      )
    );
  }
  return samples;
}

export async function extractVideoFramesFromPath(
  inputPath: string,
  frameCount: number,
  duration: number
): Promise<{ frames: string[] }> {
  if (!(await hasFfmpeg())) {
    throw new MediaToolsError();
  }
  const tempId = `frames-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  const framesDir = path.join(getVerificationTempDir(), tempId);
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
            if (!fs.existsSync(out)) return null;
            const frameBuffer = fs.readFileSync(out);
            return `data:image/jpeg;base64,${frameBuffer.toString("base64")}`;
          } catch (error: any) {
            if (
              /not recognized|ENOENT|not found/i.test(
                String(error?.message || "")
              )
            ) {
              throw new MediaToolsError();
            }
            logger.warn("Frame extract failed", {
              error: error?.message,
              ts,
            });
            return null;
          } finally {
            cleanupFile(out);
          }
        })
      );
      frames.push(...batchFrames.filter((f): f is string => !!f));
    }
    return { frames };
  } finally {
    if (fs.existsSync(framesDir)) {
      try {
        for (const file of fs.readdirSync(framesDir)) {
          cleanupFile(path.join(framesDir, file));
        }
        fs.rmdirSync(framesDir);
      } catch {
        /* ignore */
      }
    }
  }
}
