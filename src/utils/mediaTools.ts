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
