/**
 * Immutable versioned R2 key layout for live media assets.
 * Each reprocess writes under a new `v{N}` prefix — never overwrite prior versions.
 */

export function livePrefix(mediaId: string, version: number): string {
  if (!mediaId) throw new Error("mediaId is required");
  if (!Number.isInteger(version) || version < 1) {
    throw new Error(`asset version must be a positive integer, got ${version}`);
  }
  return `media/${mediaId}/v${version}`;
}

export function playbackMp4Key(mediaId: string, version: number): string {
  return `${livePrefix(mediaId, version)}/playback.mp4`;
}

export function hlsMasterKey(mediaId: string, version: number): string {
  return `${livePrefix(mediaId, version)}/hls/master.m3u8`;
}

export function hlsRenditionKey(
  mediaId: string,
  version: number,
  rendition: string,
  filename: string
): string {
  return `${livePrefix(mediaId, version)}/hls/${rendition}/${filename}`;
}

export function posterKey(mediaId: string, version: number): string {
  return `${livePrefix(mediaId, version)}/poster.jpg`;
}

/** Canonical original under the live version prefix. */
export function originalKey(
  mediaId: string,
  version: number,
  ext: string
): string {
  const clean = ext.replace(/^\./, "");
  return `${livePrefix(mediaId, version)}/original.${clean}`;
}

/** Staged-audio/book promotion key (source.ext under the live version). */
export function sourceKey(
  mediaId: string,
  version: number,
  ext: string
): string {
  const clean = ext.replace(/^\./, "");
  return `${livePrefix(mediaId, version)}/source.${clean}`;
}
