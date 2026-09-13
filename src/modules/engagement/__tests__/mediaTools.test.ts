import {
  contentTypeNeedsFfmpeg,
  isMediaToolsError,
  MediaToolsError,
  parseDurationSeconds,
} from "../../../utils/mediaTools";
import {
  enrichMediaPlaybackFields,
  resolveDurationSeconds,
  resolveProcessingStatus,
} from "../../../service/media/playbackFields";

describe("mediaTools", () => {
  it("flags video/audio content types", () => {
    expect(contentTypeNeedsFfmpeg("videos")).toBe(true);
    expect(contentTypeNeedsFfmpeg("sermon")).toBe(true);
    expect(contentTypeNeedsFfmpeg("music")).toBe(true);
    expect(contentTypeNeedsFfmpeg("books")).toBe(false);
    expect(contentTypeNeedsFfmpeg("live")).toBe(false);
  });

  it("MediaToolsError has stable code", () => {
    const err = new MediaToolsError();
    expect(err.code).toBe("FFMPEG_REQUIRED");
    expect(err.status).toBe(503);
    expect(isMediaToolsError(err)).toBe(true);
  });

  it("parseDurationSeconds keeps one decimal and rejects invalid", () => {
    expect(parseDurationSeconds(142.56)).toBe(142.6);
    expect(parseDurationSeconds("10.04")).toBe(10);
    expect(parseDurationSeconds(0)).toBeNull();
    expect(parseDurationSeconds(-1)).toBeNull();
    expect(parseDurationSeconds("x")).toBeNull();
  });
});

describe("playbackFields", () => {
  it("resolves duration from top-level or processingMetadata", () => {
    expect(resolveDurationSeconds({ duration: 12.3 })).toBe(12.3);
    expect(
      resolveDurationSeconds({
        processingMetadata: { durationSeconds: 44.1 },
      })
    ).toBe(44.1);
    expect(resolveDurationSeconds({})).toBeNull();
  });

  it("maps processingStatus for scrubber gating", () => {
    expect(
      resolveProcessingStatus({ processing: { status: "ready" } })
    ).toBe("ready");
    expect(
      resolveProcessingStatus({ processing: { status: "failed" } })
    ).toBe("failed");
    expect(
      resolveProcessingStatus({
        moderationStatus: "approved",
        fileUrl: "https://cdn.example/v.mp4",
      })
    ).toBe("ready");
    expect(
      resolveProcessingStatus({
        processing: { status: "processing" },
        fileUrl: "https://cdn.example/sermon.mp3",
        contentType: "sermon",
      })
    ).toBe("ready");
  });

  it("enrichMediaPlaybackFields attaches both fields", () => {
    const out = enrichMediaPlaybackFields({
      _id: "1",
      duration: 9.9,
      processing: { status: "completed" },
    });
    expect(out.duration).toBe(9.9);
    expect(out.processingStatus).toBe("ready");
  });

  it("always emits moderationStatus and does not set videoUrl on ebooks", () => {
    const ebook = enrichMediaPlaybackFields({
      title: "Fasting",
      contentType: "ebook",
      fileUrl: "https://cdn.example/book.pdf",
      isDefaultContent: true,
    });
    expect(ebook.moderationStatus).toBe("approved");
    expect(ebook.processingStatus).toBe("ready");
    expect(ebook.videoUrl).toBeNull();

    const sermon = enrichMediaPlaybackFields({
      contentType: "sermon",
      fileUrl: "https://cdn.example/talk.mp3",
      processing: { status: "pending" },
    });
    expect(sermon.processingStatus).toBe("ready");
    expect(sermon.audioUrl).toContain(".mp3");
    expect(sermon.videoUrl).toBeNull();
  });
});
