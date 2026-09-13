import {
  fuseGuardianScores,
  fusionToModerationResult,
} from "../gospelFusion";
import type { GuardianScoreResult } from "../guardianClient";

function baseScores(
  overrides: Partial<GuardianScoreResult> = {}
): GuardianScoreResult {
  return {
    gospel_score: 0,
    anti_gospel_score: 0,
    secular_text_score: 0,
    nsfw_score: 0,
    christian_scene_score: 0,
    secular_scene_score: 0,
    violence_score: 0,
    gore_score: 0,
    weapons_score: 0,
    drugs_score: 0,
    sexual_scene_score: 0,
    decision_hint: "review",
    confidence: 0.5,
    signals: [],
    ...overrides,
  };
}

describe("fuseGuardianScores", () => {
  it("rejects high NSFW even with gospel text", () => {
    const out = fuseGuardianScores(
      baseScores({
        gospel_score: 0.9,
        nsfw_score: 0.8,
        christian_scene_score: 0.9,
      })
    );
    expect(out.decision).toBe("reject");
    expect(out.signals).toContain("nsfw_reject");
  });

  it("routes video strong gospel text without spoken/visual corroboration to review", () => {
    const out = fuseGuardianScores(
      baseScores({
        gospel_score: 0.85,
        nsfw_score: 0.05,
        secular_scene_score: 0.2,
        christian_scene_score: 0.1,
      }),
      "videos",
      { transcriptChars: 10 }
    );
    expect(out.decision).toBe("review");
    expect(out.signals).toContain("strong_gospel_text_needs_spoken_or_visual");
  });

  it("approves video with strong gospel transcript even without church scene", () => {
    const out = fuseGuardianScores(
      baseScores({
        gospel_score: 0.85,
        nsfw_score: 0.05,
        secular_scene_score: 0.2,
        christian_scene_score: 0.1,
      }),
      "videos",
      {
        transcriptChars: 120,
        transcriptHasGospel: true,
      }
    );
    expect(out.decision).toBe("approve");
    expect(out.signals).toContain("spoken_word_of_god");
  });

  it("does not approve violence-style video with gospel title but no gospel in transcript", () => {
    const out = fuseGuardianScores(
      baseScores({
        gospel_score: 0.9, // title-inflated
        nsfw_score: 0.05,
        secular_scene_score: 0.2,
        christian_scene_score: 0.05,
      }),
      "videos",
      {
        transcriptChars: 200, // long screams / non-gospel speech
        transcriptHasGospel: false,
      }
    );
    expect(out.decision).toBe("review");
    expect(out.signals).toContain("strong_gospel_text_needs_spoken_or_visual");
  });

  it("approves video strong gospel text when christian scene corroborates", () => {
    const out = fuseGuardianScores(
      baseScores({
        gospel_score: 0.85,
        nsfw_score: 0.05,
        secular_scene_score: 0.2,
        christian_scene_score: 0.55,
      }),
      "videos"
    );
    expect(out.decision).toBe("approve");
    expect(out.signals).toContain("video_visual_corroboration");
  });

  it("does not approve video on mid christian score + gospel title text only", () => {
    const out = fuseGuardianScores(
      baseScores({
        gospel_score: 0.85,
        nsfw_score: 0.05,
        secular_scene_score: 0.2,
        christian_scene_score: 0.45,
      }),
      "videos",
      { transcriptChars: 0 }
    );
    expect(out.decision).toBe("review");
    expect(out.signals).toContain("strong_gospel_text_needs_spoken_or_visual");
  });

  it("approves non-video strong gospel text with safe vision", () => {
    const out = fuseGuardianScores(
      baseScores({
        gospel_score: 0.85,
        nsfw_score: 0.05,
        secular_scene_score: 0.2,
      }),
      "image"
    );
    expect(out.decision).toBe("approve");
    expect(out.signals).toContain("strong_gospel_text");
  });

  it("approves church scene + gospel", () => {
    const out = fuseGuardianScores(
      baseScores({
        gospel_score: 0.6,
        christian_scene_score: 0.7,
        nsfw_score: 0.1,
      })
    );
    expect(out.decision).toBe("approve");
    expect(out.signals).toContain("church_scene_gospel");
  });

  it("rejects weak gospel + secular scene", () => {
    const out = fuseGuardianScores(
      baseScores({
        gospel_score: 0.15,
        anti_gospel_score: 0.6,
        secular_scene_score: 0.7,
      })
    );
    expect(out.decision).toBe("reject");
  });

  it("approves music with strong gospel text", () => {
    const out = fuseGuardianScores(
      baseScores({
        gospel_score: 0.75,
        anti_gospel_score: 0.1,
        nsfw_score: 0.05,
        secular_scene_score: 0.2,
      }),
      "music"
    );
    expect(out.decision).toBe("approve");
    // strong_gospel_text may win before audio_book_gospel; either is correct
    expect(
      out.signals.some(s =>
        ["strong_gospel_text", "audio_book_gospel"].includes(s)
      )
    ).toBe(true);
  });

  it("approves books via audio_book path at threshold", () => {
    const out = fuseGuardianScores(
      baseScores({
        gospel_score: 0.7,
        anti_gospel_score: 0.1,
        nsfw_score: 0.5, // blocks strong_gospel_text (needs nsfw < 0.25)
        secular_scene_score: 0.5,
      }),
      "books"
    );
    expect(out.decision).toBe("approve");
    expect(out.signals).toContain("audio_book_gospel");
  });

  it("returns review for gray zone", () => {
    const out = fuseGuardianScores(
      baseScores({
        gospel_score: 0.45,
        christian_scene_score: 0.4,
        secular_scene_score: 0.4,
        decision_hint: "review",
        confidence: 0.4,
      })
    );
    expect(out.decision).toBe("review");
    expect(out.signals).toContain("gray_zone");
  });
  it("rejects violence even with gospel title scores", () => {
    const out = fuseGuardianScores(
      baseScores({
        gospel_score: 0.95,
        nsfw_score: 0.05,
        violence_score: 0.7,
        christian_scene_score: 0.1,
      }),
      "videos",
      { transcriptChars: 10, transcriptHasGospel: false }
    );
    expect(out.decision).toBe("reject");
    expect(out.signals).toContain("violence_reject");
  });

  it("rejects pornographic sexual scene score", () => {
    const out = fuseGuardianScores(
      baseScores({
        gospel_score: 0.9,
        sexual_scene_score: 0.7,
        nsfw_score: 0.1,
      }),
      "videos"
    );
    expect(out.decision).toBe("reject");
    expect(out.signals).toContain("sexual_scene_reject");
  });

  it("rejects weapons threats", () => {
    const out = fuseGuardianScores(
      baseScores({
        gospel_score: 0.2,
        weapons_score: 0.6,
      }),
      "videos"
    );
    expect(out.decision).toBe("reject");
    expect(out.signals).toContain("weapons_reject");
  });
});

describe("fusionToModerationResult", () => {
  it("maps approve to auto-publish flags", () => {
    const outcome = fuseGuardianScores(
      baseScores({
        gospel_score: 0.9,
        nsfw_score: 0.05,
        christian_scene_score: 0.6,
      }),
      "videos"
    );
    const result = fusionToModerationResult(outcome, {
      contentType: "videos",
      title: "Jesus is Lord",
    });
    expect(result.isApproved).toBe(true);
    expect(result.requiresReview).toBe(false);
    expect(result.flags).toContain("auto_publish");
    expect(result.modelId).toBe("content-guardian");
  });

  it("maps reject without requiring review", () => {
    const outcome = fuseGuardianScores(
      baseScores({ nsfw_score: 0.9, gospel_score: 0 })
    );
    const result = fusionToModerationResult(outcome, { contentType: "videos" });
    expect(result.isApproved).toBe(false);
    expect(result.requiresReview).toBe(false);
    expect(result.flags).toContain("off_theme_or_unsafe");
  });
});
