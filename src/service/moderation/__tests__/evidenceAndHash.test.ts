import {
  getEvidenceProfile,
  clipDurationsWithinBudget,
  hasMinimumEvidence,
  distributedOffsets,
  suggestedFrameCount,
} from "../evidenceProfile";
import { sha256Buffer } from "../contentHashDedup";

describe("evidence profiles", () => {
  it("distributes video samples across full duration (not first N minutes only)", () => {
    const profile = getEvidenceProfile("videos", "video/mp4");
    const { offsets, clipSeconds } = clipDurationsWithinBudget(profile, 3600);
    expect(offsets.length).toBeGreaterThanOrEqual(profile.minAudioClips);
    expect(offsets[0]).toBeLessThan(60);
    expect(offsets[offsets.length - 1]).toBeGreaterThan(1800);
    expect(offsets.length * clipSeconds).toBeLessThanOrEqual(
      profile.maxTranscribedSeconds + clipSeconds
    );
  });

  it("caps audio transcription budget for long music", () => {
    const profile = getEvidenceProfile("music", "audio/mpeg");
    const { offsets, clipSeconds } = clipDurationsWithinBudget(profile, 900);
    expect(offsets.length * clipSeconds).toBeLessThanOrEqual(
      profile.maxTranscribedSeconds + clipSeconds
    );
  });

  it("requires transcript or frames for video minimum evidence", () => {
    const profile = getEvidenceProfile("sermon", "video/mp4");
    expect(
      hasMinimumEvidence(profile, {
        title: true,
        description: false,
        transcript: false,
        transcriptChars: 0,
        frames: false,
        frameCount: 0,
        thumbnail: false,
        textChars: 0,
      })
    ).toBe(false);
    expect(
      hasMinimumEvidence(profile, {
        title: true,
        description: false,
        transcript: true,
        transcriptChars: 80,
        frames: true,
        frameCount: 6,
        thumbnail: true,
        textChars: 0,
      })
    ).toBe(true);
  });

  it("distributedOffsets covers start and end", () => {
    const offs = distributedOffsets(100, 5);
    expect(offs[0]).toBeLessThan(5);
    expect(offs[offs.length - 1]).toBeGreaterThan(90);
  });

  it("scales audio windows with long sermon duration", () => {
    const profile = getEvidenceProfile("videos", "video/mp4");
    const short = clipDurationsWithinBudget(profile, 90);
    const long = clipDurationsWithinBudget(profile, 2400);
    expect(long.offsets.length).toBeGreaterThan(short.offsets.length);
    expect(long.offsets[long.offsets.length - 1]).toBeGreaterThan(1800);
  });

  it("suggests denser frames for longer videos", () => {
    const profile = getEvidenceProfile("videos", "video/mp4");
    expect(suggestedFrameCount(profile, 60)).toBeGreaterThanOrEqual(
      profile.minFrames
    );
    expect(suggestedFrameCount(profile, 1800)).toBeGreaterThan(
      suggestedFrameCount(profile, 60)
    );
  });
});

describe("content hash", () => {
  it("sha256Buffer is stable", () => {
    const a = sha256Buffer(Buffer.from("hello-jevah"));
    const b = sha256Buffer(Buffer.from("hello-jevah"));
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });
});
