import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

let ffmpegCache: boolean | null = null;
let ffprobeCache: boolean | null = null;

/** Thrown when video/audio verification needs FFmpeg but it is missing from PATH. */
export class MediaToolsError extends Error {
  readonly code = "FFMPEG_REQUIRED";
  readonly status = 503;

  constructor(
    message = "FFmpeg is required for video/audio upload verification. Install FFmpeg and ensure ffmpeg/ffprobe are on PATH, then restart the API."
  ) {
    super(message);
    this.name = "MediaToolsError";
  }
}

export function isMediaToolsError(err: unknown): err is MediaToolsError {
  return (
    err instanceof MediaToolsError ||
    (typeof err === "object" &&
      err !== null &&
      (err as any).code === "FFMPEG_REQUIRED")
  );
}

export async function hasFfmpeg(forceRefresh = false): Promise<boolean> {
  if (!forceRefresh && ffmpegCache !== null) return ffmpegCache;
  try {
    await execFileAsync("ffmpeg", ["-version"], { timeout: 5000 });
    ffmpegCache = true;
  } catch {
    ffmpegCache = false;
  }
  return ffmpegCache;
}

export async function hasFfprobe(forceRefresh = false): Promise<boolean> {
  if (!forceRefresh && ffprobeCache !== null) return ffprobeCache;
  try {
    await execFileAsync("ffprobe", ["-version"], { timeout: 5000 });
    ffprobeCache = true;
  } catch {
    ffprobeCache = false;
  }
  return ffprobeCache;
}

/** Content types that extract audio/frames via FFmpeg during pre-upload verification. */
export function contentTypeNeedsFfmpeg(contentType: string): boolean {
  const t = String(contentType || "").toLowerCase();
  return (
    t === "videos" ||
    t === "video" ||
    t === "sermon" ||
    t === "sermons" ||
    t === "music" ||
    t === "audio"
  );
}

export async function assertFfmpegForContentType(
  contentType: string
): Promise<void> {
  if (!contentTypeNeedsFfmpeg(contentType)) return;
  if (await hasFfmpeg()) return;
  throw new MediaToolsError();
}

/** Positive duration in seconds (1 decimal). Null if unknown / invalid. */
export function parseDurationSeconds(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : parseFloat(String(raw ?? ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 10) / 10;
}

export type MediaProbeResult = {
  durationSeconds: number | null;
  width: number;
  height: number;
  videoCodec: string;
  audioCodec: string;
};

/**
 * ffprobe a local media file for duration + stream metadata.
 * Duration is what mobile scrubbers need (seconds).
 */
export async function probeMediaFile(
  filePath: string,
  options?: { timeoutMs?: number }
): Promise<MediaProbeResult> {
  const { stdout } = await execFileAsync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration:stream=index,codec_type,codec_name,width,height",
      "-of",
      "json",
      filePath,
    ],
    { timeout: options?.timeoutMs ?? 60_000 }
  );
  const parsed = JSON.parse(String(stdout || "{}"));
  const videoStream = (parsed?.streams || []).find(
    (s: any) => s.codec_type === "video" || s.width
  );
  const audioStream = (parsed?.streams || []).find(
    (s: any) => s.codec_type === "audio"
  );
  return {
    durationSeconds: parseDurationSeconds(parsed?.format?.duration),
    width: Number(videoStream?.width || 0) || 0,
    height: Number(videoStream?.height || 0) || 0,
    videoCodec: String(videoStream?.codec_name || ""),
    audioCodec: String(audioStream?.codec_name || ""),
  };
}
