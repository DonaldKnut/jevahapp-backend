import fs from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { Media } from "../models/media.model";
import fileUploadService from "../service/fileUpload.service";
import {
  livePrefix,
  playbackMp4Key,
  hlsMasterKey,
  hlsRenditionKey,
  posterKey,
} from "../service/media/delivery/mediaKeys";
import {
  reserveNextAssetVersion,
  markMediaLive,
} from "../service/media/delivery/publishLive";
import logger from "../utils/logger";
import { probeMediaFile } from "../utils/mediaTools";

const execFileAsync = promisify(execFile);

interface Rendition {
  name: string;
  height: number;
  width: number;
  videoBitrateKbps: number;
  audioBitrateKbps: number;
}

function even(value: number): number {
  return Math.max(2, Math.round(value / 2) * 2);
}

export function selectRenditions(
  sourceWidth: number,
  sourceHeight: number
): Rendition[] {
  const candidates = [
    { name: "360p", height: 360, videoBitrateKbps: 800, audioBitrateKbps: 96 },
    { name: "720p", height: 720, videoBitrateKbps: 2500, audioBitrateKbps: 128 },
    { name: "1080p", height: 1080, videoBitrateKbps: 5000, audioBitrateKbps: 160 },
  ];
  const sourceH = Math.max(2, sourceHeight || 720);
  const sourceW = Math.max(2, sourceWidth || 1280);
  const selected = candidates.filter(c => c.height <= sourceH);
  if (selected.length === 0) {
    selected.push({
      name: `${sourceH}p`,
      height: sourceH,
      videoBitrateKbps: 650,
      audioBitrateKbps: 96,
    });
  }
  return selected.map(c => ({
    ...c,
    height: Math.min(c.height, sourceH),
    width: even((sourceW / sourceH) * Math.min(c.height, sourceH)),
  }));
}

async function bestEffortDeleteKeys(
  mediaId: string,
  keys: string[],
  reason: string
): Promise<void> {
  const unique = [...new Set(keys.filter(Boolean))];
  await Promise.all(
    unique.map(key =>
      fileUploadService.deleteMedia(key).catch((err: any) => {
        logger.warn(`Failed to delete ${reason}`, {
          mediaId,
          key,
          error: err?.message,
        });
      })
    )
  );
}

/**
 * Bounded video processing: optimized MP4 + adaptive HLS + poster.
 * Each run reserves a new assetVersion and writes under media/{id}/v{N}/ —
 * prior version prefixes are never overwritten.
 */
export async function processVideoTranscode(params: {
  mediaId: string;
  inputUrl: string;
}): Promise<{ playbackUrl?: string; hlsUrl?: string; thumbnailUrl?: string; duration?: number }> {
  const { mediaId, inputUrl } = params;
  const workDir = path.join(os.tmpdir(), `jevah-transcode-${mediaId}`);
  fs.mkdirSync(workDir, { recursive: true });

  const inputPath = path.join(workDir, "input");
  const mp4Path = path.join(workDir, "playback.mp4");
  const posterPath = path.join(workDir, "poster.jpg");
  const hlsDir = path.join(workDir, "hls");
  fs.mkdirSync(hlsDir, { recursive: true });

  try {
    await Media.findByIdAndUpdate(mediaId, {
      processing: {
        status: "transcoding",
        jobType: "transcode",
        updatedAt: new Date(),
        progress: 20,
      },
    });

    // Download / copy source
    if (inputUrl.startsWith("http")) {
      const res = await fetch(inputUrl);
      if (!res.ok) throw new Error(`Failed to download source: ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(inputPath, buf);
    } else {
      fs.copyFileSync(inputUrl, inputPath);
    }

    // Probe source for dimensions / codecs (duration re-probed on output MP4)
    let duration = 0;
    let width = 0;
    let height = 0;
    let sourceVideoCodec = "";
    let sourceAudioCodec = "";
    try {
      const sourceProbe = await probeMediaFile(inputPath);
      duration = sourceProbe.durationSeconds ?? 0;
      width = sourceProbe.width;
      height = sourceProbe.height;
      sourceVideoCodec = sourceProbe.videoCodec;
      sourceAudioCodec = sourceProbe.audioCodec;
    } catch (err: any) {
      logger.warn("ffprobe failed during transcode (source)", {
        mediaId,
        error: err?.message,
      });
    }

    // Do not upscale small mobile uploads — cap scale at source width
    const targetWidth = width > 0 && width < 1280 ? width : 1280;
    const renditions = selectRenditions(width, height);

    await Media.findByIdAndUpdate(mediaId, {
      "processing.progress": 40,
      "processing.updatedAt": new Date(),
    });

    // Optimized MP4 (H.264 + AAC, faststart)
    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-i",
        inputPath,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-vf",
        `scale='min(${targetWidth},iw)':-2`,
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-movflags",
        "+faststart",
        mp4Path,
      ],
      { timeout: 600_000 }
    );

    // Authoritative duration from seekable progressive MP4 (moov at start)
    try {
      const outProbe = await probeMediaFile(mp4Path);
      if (outProbe.durationSeconds != null) {
        duration = outProbe.durationSeconds;
      }
      if (!width && outProbe.width) width = outProbe.width;
      if (!height && outProbe.height) height = outProbe.height;
    } catch (err: any) {
      logger.warn("ffprobe failed during transcode (output MP4)", {
        mediaId,
        error: err?.message,
      });
    }
    if (!(duration > 0)) {
      logger.warn("Transcode finished without known duration", { mediaId });
    }

    // Poster frame
    try {
      await execFileAsync(
        "ffmpeg",
        ["-y", "-ss", "1", "-i", inputPath, "-frames:v", "1", "-q:v", "4", posterPath],
        { timeout: 60_000 }
      );
    } catch {
      // non-fatal
    }

    await Media.findByIdAndUpdate(mediaId, {
      "processing.progress": 70,
      "processing.updatedAt": new Date(),
    });

    // Adaptive HLS. Renditions are capped at source resolution so small mobile
    // uploads are never upscaled.
    let hlsMasterPath = path.join(hlsDir, "master.m3u8");
    try {
      const masterLines = ["#EXTM3U", "#EXT-X-VERSION:3"];
      for (const rendition of renditions) {
        const renditionDir = path.join(hlsDir, rendition.name);
        fs.mkdirSync(renditionDir, { recursive: true });
        const playlistPath = path.join(renditionDir, "index.m3u8");
        await execFileAsync(
          "ffmpeg",
          [
            "-y",
            "-i",
            mp4Path,
            "-vf",
            `scale=-2:'min(${rendition.height},ih)'`,
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-profile:v",
            "main",
            "-crf",
            "23",
            "-maxrate",
            `${rendition.videoBitrateKbps}k`,
            "-bufsize",
            `${rendition.videoBitrateKbps * 2}k`,
            "-g",
            "120",
            "-keyint_min",
            "120",
            "-sc_threshold",
            "0",
            "-c:a",
            "aac",
            "-b:a",
            `${rendition.audioBitrateKbps}k`,
            "-hls_time",
            "4",
            "-hls_playlist_type",
            "vod",
            "-hls_flags",
            "independent_segments",
            "-hls_segment_filename",
            path.join(renditionDir, "seg_%05d.ts"),
            playlistPath,
          ],
          { timeout: 900_000 }
        );
        masterLines.push(
          `#EXT-X-STREAM-INF:BANDWIDTH=${(rendition.videoBitrateKbps + rendition.audioBitrateKbps) * 1000},RESOLUTION=${rendition.width}x${rendition.height},CODECS="avc1.4d401f,mp4a.40.2"`,
          `${rendition.name}/index.m3u8`
        );
      }
      fs.writeFileSync(hlsMasterPath, `${masterLines.join("\n")}\n`);
    } catch (err: any) {
      logger.warn("HLS generation failed; continuing with MP4 only", {
        mediaId,
        error: err?.message,
      });
      hlsMasterPath = "";
    }

    // Snapshot prior prefix before reserving the next version (never overwrite it)
    const prior = await Media.findById(mediaId)
      .select(
        "storagePrefix derivativeKeys moderationStatus uploadedBy uploadIntent.stagingKey uploadIntent.thumbnailStagingKey"
      )
      .lean();
    const priorStoragePrefix = (prior as any)?.storagePrefix as
      | string
      | undefined;
    const priorDerivativeKeys = ((prior as any)?.derivativeKeys ||
      []) as string[];

    const assetVersion = await reserveNextAssetVersion(mediaId);
    const storagePrefix = livePrefix(mediaId, assetVersion);
    const derivativeKeys: string[] = [];

    // Upload derivatives under media/{id}/v{N}/ via exact keys only
    const mp4ObjectKey = playbackMp4Key(mediaId, assetVersion);
    const mp4Upload = await fileUploadService.uploadObjectExact(
      mp4ObjectKey,
      fs.readFileSync(mp4Path),
      "video/mp4"
    );
    derivativeKeys.push(mp4ObjectKey);
    await fileUploadService.headObject(mp4ObjectKey);

    let posterUrl: string | undefined;
    let posterObjectKey: string | undefined;
    if (fs.existsSync(posterPath)) {
      posterObjectKey = posterKey(mediaId, assetVersion);
      const posterUpload = await fileUploadService.uploadObjectExact(
        posterObjectKey,
        fs.readFileSync(posterPath),
        "image/jpeg"
      );
      posterUrl = posterUpload.secure_url;
      derivativeKeys.push(posterObjectKey);
    }

    let hlsUrl: string | undefined;
    const derivatives: any[] = [
      {
        kind: "mp4",
        objectKey: mp4Upload.objectKey,
        url: mp4Upload.secure_url,
        width: Math.min(width || 1280, 1280),
        height: height || undefined,
        videoCodec: "h264",
        audioCodec: "aac",
      },
    ];
    if (hlsMasterPath && fs.existsSync(hlsMasterPath)) {
      // A playlist is published only after every referenced child object is
      // uploaded. Partial HLS is worse than falling back to MP4.
      for (const rendition of renditions) {
        const renditionDir = path.join(hlsDir, rendition.name);
        const childFiles = fs.readdirSync(renditionDir).sort();
        for (const filename of childFiles) {
          const isPlaylist = filename.endsWith(".m3u8");
          const objectKey = hlsRenditionKey(
            mediaId,
            assetVersion,
            rendition.name,
            filename
          );
          await fileUploadService.uploadObjectExact(
            objectKey,
            fs.readFileSync(path.join(renditionDir, filename)),
            isPlaylist ? "application/vnd.apple.mpegurl" : "video/mp2t"
          );
          derivativeKeys.push(objectKey);
        }
        const renditionPlaylistKey = hlsRenditionKey(
          mediaId,
          assetVersion,
          rendition.name,
          "index.m3u8"
        );
        derivatives.push({
          kind: "hls",
          objectKey: renditionPlaylistKey,
          url: fileUploadService.generatePublicUrl(renditionPlaylistKey),
          width: rendition.width,
          height: rendition.height,
          videoCodec: "h264",
          audioCodec: "aac",
          bitrate:
            (rendition.videoBitrateKbps + rendition.audioBitrateKbps) * 1000,
        });
      }
      const masterObjectKey = hlsMasterKey(mediaId, assetVersion);
      const hlsUpload = await fileUploadService.uploadObjectExact(
        masterObjectKey,
        fs.readFileSync(hlsMasterPath),
        "application/vnd.apple.mpegurl"
      );
      hlsUrl = hlsUpload.secure_url;
      derivativeKeys.push(masterObjectKey);
      await fileUploadService.headObject(masterObjectKey);
    }

    const urls = {
      playbackUrl: mp4Upload.secure_url,
      fileUrl: mp4Upload.secure_url,
      fileObjectKey: mp4Upload.objectKey,
      ...(posterUrl
        ? {
            thumbnailUrl: posterUrl,
            coverImageUrl: posterUrl,
            thumbnailObjectKey: posterObjectKey,
          }
        : {}),
      ...(hlsUrl ? { hlsUrl } : {}),
    };

    const extra: Record<string, unknown> = {
      derivatives,
      processingMetadata: {
        sourceWidth: width || undefined,
        sourceHeight: height || undefined,
        durationSeconds: duration > 0 ? duration : undefined,
        videoCodec: sourceVideoCodec || undefined,
        audioCodec: sourceAudioCodec || undefined,
        verifiedAt: new Date(),
      },
      processing: {
        status: "ready",
        jobType: "transcode",
        updatedAt: new Date(),
        progress: 100,
      },
    };
    // Persist top-level duration for feed/detail scrubbers (seconds)
    if (duration > 0) {
      extra.duration = duration;
    }
    if (width > 0) extra.width = width;
    if (height > 0) extra.height = height;

    const approved = (prior as any)?.moderationStatus === "approved";
    const userId = String((prior as any)?.uploadedBy || "");

    if (approved) {
      await markMediaLive({
        mediaId,
        userId,
        urls,
        storagePrefix,
        derivativeKeys,
        assetVersion,
        extra,
      });

      // Delete staging only after live
      const stagingKey = (prior as any)?.uploadIntent?.stagingKey;
      const stagingKeys: string[] = [];
      if (stagingKey?.startsWith("staging/")) stagingKeys.push(stagingKey);
      const stagingThumbnailKey = (prior as any)?.uploadIntent
        ?.thumbnailStagingKey;
      if (stagingThumbnailKey?.startsWith("staging/")) {
        stagingKeys.push(stagingThumbnailKey);
      }
      if (stagingKeys.length) {
        await bestEffortDeleteKeys(
          mediaId,
          stagingKeys,
          "promoted staging video"
        );
      }

      // Best-effort cleanup of previous version prefix (never the one we just wrote)
      if (
        priorStoragePrefix &&
        priorStoragePrefix !== storagePrefix &&
        priorDerivativeKeys.length
      ) {
        await bestEffortDeleteKeys(
          mediaId,
          priorDerivativeKeys,
          "previous storagePrefix derivative"
        );
      }
    } else {
      // Derivatives ready but stay hidden until moderation approves
      await Media.findByIdAndUpdate(mediaId, {
        $set: {
          ...urls,
          ...extra,
          storagePrefix,
          derivativeKeys,
          assetVersion,
        },
      });
    }

    return {
      playbackUrl: mp4Upload.secure_url,
      hlsUrl,
      thumbnailUrl: posterUrl,
      duration: duration || undefined,
    };
  } finally {
    try {
      fs.rmSync(workDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}
