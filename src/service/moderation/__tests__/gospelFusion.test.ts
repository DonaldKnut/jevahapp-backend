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

  it("does not approve a church scene without a spoken Christ/Scripture anchor", () => {
    const out = fuseGuardianScores(
      baseScores({
        gospel_score: 0.6,
        christian_scene_score: 0.7,
        nsfw_score: 0.1,
      }),
      "videos",
      { transcriptChars: 200, transcriptHasGospel: false }
    );
    expect(out.decision).toBe("review");
    expect(out.signals).toContain("church_scene_needs_spoken_anchor");
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

  it("approves mid gospel_score when spoken Christian lexicon is strong", () => {
    const out = fuseGuardianScores(
      baseScores({
        gospel_score: 0.4,
        nsfw_score: 0.05,
        secular_scene_score: 0.2,
        christian_scene_score: 0.2,
      }),
      "videos",
      {
        transcriptChars: 120,
        transcriptHasGospel: true,
        bodyHasGospel: true,
        bodyGospelStrength: "strong",
      }
    );
    expect(out.decision).toBe("approve");
    expect(out.signals).toContain("lexicon_strong_christian_body");
  });

  it("approves when STT is empty but description has strong Scripture + church frames", () => {
    const out = fuseGuardianScores(
      baseScores({
        gospel_score: 0.75,
        nsfw_score: 0.05,
        secular_scene_score: 0.2,
        christian_scene_score: 0.6,
      }),
      "videos",
      {
        transcriptChars: 0,
        transcriptHasGospel: false,
        bodyHasGospel: true,
        bodyGospelStrength: "strong",
        hasFrames: true,
      }
    );
    expect(out.decision).toBe("approve");
  });

  it("does not let Scripture description override long hustle transcript", () => {
    const out = fuseGuardianScores(
      baseScores({
        gospel_score: 0.85,
        nsfw_score: 0.05,
        secular_scene_score: 0.2,
        christian_scene_score: 0.6,
      }),
      "videos",
      {
        transcriptChars: 200,
        transcriptHasGospel: false,
        bodyHasGospel: true,
        bodyGospelStrength: "strong",
        hasFrames: true,
      }
    );
    expect(out.decision).toBe("review");
  });

  it("approves silent Scripture slides via frame OCR", () => {
    const out = fuseGuardianScores(
      baseScores({
        gospel_score: 0.55,
        nsfw_score: 0.05,
        secular_scene_score: 0.2,
        christian_scene_score: 0.5,
      }),
      "videos",
      {
        transcriptChars: 0,
        transcriptHasGospel: false,
        ocrHasGospel: true,
        hasFrames: true,
      }
    );
    expect(out.decision).toBe("approve");
    expect(
      out.signals.some(s =>
        ["frame_ocr_gospel", "lexicon_strong_christian_body", "spoken_word_of_god"].includes(
          s
        )
      )
    ).toBe(true);
  });

  it("trusted creator fast-lane auto-approves Christian gray zone", () => {
    const out = fuseGuardianScores(
      baseScores({
        gospel_score: 0.4,
        nsfw_score: 0.05,
        secular_scene_score: 0.2,
        christian_scene_score: 0.5,
      }),
      "videos",
      {
        transcriptChars: 120,
        transcriptHasGospel: true,
        trustedCreator: true,
        trustTier: "trusted",
        hasFrames: true,
      }
    );
    expect(out.decision).toBe("approve");
    expect(
      out.signals.some(s =>
        ["trusted_creator_fast_lane", "lexicon_strong_christian_body", "spoken_word_of_god"].includes(
          s
        )
      )
    ).toBe(true);
  });

  it("does not approve violence-style video with gospel title but no gospel in transcript", () => {
    const out = fuseGuardianScores(
      baseScores({
        gospel_score: 0.9,
        nsfw_score: 0.05,
        secular_scene_score: 0.2,
        christian_scene_score: 0.05,
      }),
      "videos",
      {
        transcriptChars: 200,
        transcriptHasGospel: false,
      }
    );
    expect(out.decision).toBe("review");
    expect(out.signals).toContain("strong_gospel_text_needs_spoken_or_visual");
  });

  it("approves video strong gospel text when christian scene corroborates a spoken anchor", () => {
    const out = fuseGuardianScores(
      baseScores({
        gospel_score: 0.85,
        nsfw_score: 0.05,
        secular_scene_score: 0.2,
        christian_scene_score: 0.55,
      }),
      "videos",
      { transcriptChars: 120, transcriptHasGospel: true }
    );
    expect(out.decision).toBe("approve");
    expect(
      out.signals.some(s =>
        [
          "video_visual_corroboration",
          "church_scene_gospel",
          "lexicon_strong_christian_body",
        ].includes(s)
      )
    ).toBe(true);
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

  it("approves church scene + spoken gospel anchor", () => {
    const out = fuseGuardianScores(
      baseScores({
        gospel_score: 0.6,
        christian_scene_score: 0.7,
        nsfw_score: 0.1,
      }),
      "videos",
      { transcriptChars: 120, transcriptHasGospel: true }
    );
    expect(out.decision).toBe("approve");
    expect(out.signals).toContain("church_scene_gospel");
  });

  it("rejects generic motivation with no gospel anchor", () => {
    const out = fuseGuardianScores(
      baseScores({
        gospel_score: 0.2,
        secular_text_score: 0.2,
        christian_scene_score: 0.1,
        signals: ["motivation_lexicon"],
      }),
      "videos"
    );
    expect(out.decision).toBe("reject");
    expect(out.signals).toContain("secular_motivation");
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
        nsfw_score: 0.5,
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
      "videos",
      { transcriptChars: 120, transcriptHasGospel: true }
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
