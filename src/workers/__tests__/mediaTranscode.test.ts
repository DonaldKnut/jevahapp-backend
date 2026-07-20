import { selectRenditions } from "../mediaTranscode";

describe("adaptive video rendition selection", () => {
  it("does not upscale a low-resolution upload", () => {
    const renditions = selectRenditions(480, 270);
    expect(renditions).toHaveLength(1);
    expect(renditions[0].height).toBe(270);
    expect(renditions[0].width).toBe(480);
  });

  it("builds a bounded ladder for 1080p input", () => {
    expect(selectRenditions(1920, 1080).map(r => r.name)).toEqual([
      "360p",
      "720p",
      "1080p",
    ]);
  });

  it("keeps portrait rendition widths even", () => {
    const renditions = selectRenditions(1080, 1920);
    expect(renditions.every(r => r.width % 2 === 0)).toBe(true);
    expect(renditions.every(r => r.height <= 1080)).toBe(true);
  });
});
