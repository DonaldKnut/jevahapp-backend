import {
  livePrefix,
  playbackMp4Key,
  hlsMasterKey,
  hlsRenditionKey,
  posterKey,
  originalKey,
  sourceKey,
} from "../mediaKeys";

describe("mediaKeys version paths", () => {
  const mediaId = "65f0abc1234567890abcdef0";
  const version = 3;

  it("builds the live prefix", () => {
    expect(livePrefix(mediaId, version)).toBe(
      `media/${mediaId}/v${version}`
    );
  });

  it("builds playback, poster, and original keys", () => {
    expect(playbackMp4Key(mediaId, version)).toBe(
      `media/${mediaId}/v3/playback.mp4`
    );
    expect(posterKey(mediaId, version)).toBe(
      `media/${mediaId}/v3/poster.jpg`
    );
    expect(originalKey(mediaId, version, "mp4")).toBe(
      `media/${mediaId}/v3/original.mp4`
    );
    expect(originalKey(mediaId, version, ".wav")).toBe(
      `media/${mediaId}/v3/original.wav`
    );
  });

  it("builds HLS master and rendition keys", () => {
    expect(hlsMasterKey(mediaId, version)).toBe(
      `media/${mediaId}/v3/hls/master.m3u8`
    );
    expect(hlsRenditionKey(mediaId, version, "720p", "index.m3u8")).toBe(
      `media/${mediaId}/v3/hls/720p/index.m3u8`
    );
    expect(hlsRenditionKey(mediaId, version, "360p", "seg_00001.ts")).toBe(
      `media/${mediaId}/v3/hls/360p/seg_00001.ts`
    );
  });

  it("builds source key for staged audio/book promotion", () => {
    expect(sourceKey(mediaId, version, "mp3")).toBe(
      `media/${mediaId}/v3/source.mp3`
    );
  });

  it("rejects invalid versions", () => {
    expect(() => livePrefix(mediaId, 0)).toThrow(/positive integer/);
    expect(() => livePrefix(mediaId, 1.5)).toThrow(/positive integer/);
    expect(() => livePrefix("", 1)).toThrow(/mediaId/);
  });

  it("never collides across versions", () => {
    expect(playbackMp4Key(mediaId, 1)).not.toBe(playbackMp4Key(mediaId, 2));
    expect(livePrefix(mediaId, 1)).not.toBe(livePrefix(mediaId, 2));
  });
});
