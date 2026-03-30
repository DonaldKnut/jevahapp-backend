import { computeDistributedAudioSampleOffsets } from "../verificationAudio.util";

describe("computeDistributedAudioSampleOffsets", () => {
  it("returns [0] for very short media", () => {
    expect(computeDistributedAudioSampleOffsets(0.5, 60, 7)).toEqual([0]);
  });

  it("includes start and end for media longer than sample duration", () => {
    const o = computeDistributedAudioSampleOffsets(300, 60, 7);
    expect(o[0]).toBe(0);
    expect(o).toContain(240);
  });

  it("spreads more offsets for long media", () => {
    const o = computeDistributedAudioSampleOffsets(1200, 60, 7);
    expect(o.length).toBeGreaterThanOrEqual(4);
    expect(o[0]).toBe(0);
    const last = o[o.length - 1];
    expect(last).toBeGreaterThan(600);
  });

  it("respects maxSegments cap", () => {
    const o = computeDistributedAudioSampleOffsets(2000, 60, 3);
    expect(o.length).toBeLessThanOrEqual(3);
  });
});
