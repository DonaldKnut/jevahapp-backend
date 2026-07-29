import {
  contentTypeNeedsFfmpeg,
  isMediaToolsError,
  MediaToolsError,
} from "../../../utils/mediaTools";

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
});
