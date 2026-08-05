import { createHash } from "crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { matchModerationBlocklist } from "../config/moderationBlocklist";
import { ModerationCase } from "../models/moderationCase.model";
import { reserveAiBudget, recordAiUsage } from "./moderation/aiBudget.service";
import {
  getActiveModerationModelId,
  getGoogleAiApiKey,
  MODERATION_POLICY_VERSION,
  MODERATION_PROMPT_VERSION,
  assertSupportedGeminiModel,
} from "./moderation/geminiConfig";
import { generateContentWithRetry } from "./moderation/geminiClient";
import {
  getEvidenceProfile,
  hasMinimumEvidence,
} from "./moderation/evidenceProfile";
import { offlineModeration } from "./moderation/offlineModeration";
import { buildModerationPrompt } from "./moderation/moderationPrompt";
import { parseModerationResponse } from "./moderation/parseModerationResponse";
import {
  policyText,
  detectLanguageCandidates,
  sampleVideoFramesForModeration,
  MODERATION_MAX_VIDEO_FRAMES,
} from "./moderation/types";
import type { ModerationInput, ModerationResult } from "./moderation/types";
import {
  isGuardianConfigured,
  scoreWithGuardian,
} from "./moderation/guardianClient";
import {
  fuseGuardianScores,
  fusionToModerationResult,
} from "./moderation/gospelFusion";
import logger from "../utils/logger";

export type { ModerationResult, ModerationInput } from "./moderation/types";

function fusionMode(): "guardian_first" | "gemini_first" | "offline_only" {
  const m = (process.env.MODERATION_FUSION_MODE || "guardian_first").toLowerCase();
  if (m === "gemini_first" || m === "offline_only") return m;
  return "guardian_first";
}

export class ContentModerationService {
  private genAI: GoogleGenerativeAI | null;
  private model: any;
  private modelId: string | null = null;

  private async persistCase(
    input: ModerationInput,
    result: ModerationResult,
    softSignal?: boolean,
    opts?: {
      provider?: string;
      scores?: Record<string, number>;
    }
  ): Promise<void> {
    if (!input.mediaId) return;
    try {
      const evidenceHashes = [
        createHash("sha256")
          .update(policyText(input).slice(0, 8000))
          .digest("hex")
          .slice(0, 32),
      ];
      const provider =
        opts?.provider ||
        (result.modelId === "content-guardian"
          ? "content-guardian"
          : result.modelId
            ? "google-gemini"
            : "offline");
      await ModerationCase.create({
        mediaId: input.mediaId,
        contentHash: input.contentHash,
        provider,
        modelId: result.modelId || this.modelId || undefined,
        promptVersion: MODERATION_PROMPT_VERSION,
        policyVersion: MODERATION_POLICY_VERSION,
        evidenceHashes,
        modalityCoverage: {
          title: !!input.title,
          description: !!input.description,
          transcript: !!input.transcript,
          thumbnail: !!input.thumbnail,
          frames: !!(input.videoFrames && input.videoFrames.length),
          frameCount: input.videoFrames?.length || 0,
        },
        languageCandidates:
          result.languageCandidates ||
          detectLanguageCandidates(policyText(input)),
        decision: {
          isApproved: result.isApproved,
          confidence: result.confidence,
          reason: result.reason,
          flags: [
            ...(result.flags || []),
            ...(softSignal ? ["soft_blocklist_signal"] : []),
          ],
          requiresReview: result.requiresReview,
        },
        scores: opts?.scores,
      });
    } catch (err) {
      logger.warn("Failed to persist moderation case", { err });
    }
  }

  constructor() {
    const apiKey = getGoogleAiApiKey();
    if (!apiKey) {
      logger.warn(
        "GOOGLE_AI_API_KEY not found. Gray-zone AI unavailable; Guardian + offline rules apply."
      );
      this.genAI = null;
      this.model = null;
      return;
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    const modelId = getActiveModerationModelId();
    assertSupportedGeminiModel(modelId, "moderation");
    this.modelId = modelId;
    this.model = this.genAI.getGenerativeModel({
      model: modelId,
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
      },
    });
    logger.info("Content moderation model configured", { modelId });
  }

  /**
   * Guardian-first path. Returns a definitive result when fusion is clear;
   * returns null when gray (caller may escalate to Gemini).
   */
  private async tryGuardianPath(
    input: ModerationInput,
    languages: string[],
    softSignal: boolean
  ): Promise<ModerationResult | null> {
    if (fusionMode() === "offline_only") return null;
    if (fusionMode() !== "guardian_first") return null;
    if (!isGuardianConfigured()) return null;

    const scored = await scoreWithGuardian({
      title: input.title,
      description: input.description,
      transcript: input.transcript,
      contentType: input.contentType,
      thumbnail: input.thumbnail,
      frames: input.videoFrames,
      runVision: true,
    });
    if (!scored) {
      logger.info("Guardian unavailable — falling through to Gemini/offline");
      return null;
    }

    const outcome = fuseGuardianScores(scored, input.contentType);
    const result = fusionToModerationResult(outcome, input);
    result.languageCandidates = languages;

    if (outcome.decision === "review") {
      // Gray: let Gemini (or offline) decide; still log guardian scores
      await this.persistCase(input, result, softSignal, {
        provider: "content-guardian",
        scores: outcome.scores,
      });
      logger.info("Guardian gray-zone — escalating", {
        mediaId: input.mediaId,
        signals: outcome.signals.slice(0, 8),
      });
      return null;
    }

    await recordAiUsage({
      outcome: outcome.decision === "approve" ? "approve" : "reject",
      countedRequest: false,
    });
    await this.persistCase(input, result, softSignal, {
      provider: "content-guardian",
      scores: outcome.scores,
    });
    return result;
  }

  private async runGeminiPath(
    input: ModerationInput,
    languages: string[],
    softSignal: boolean,
    profile: ReturnType<typeof getEvidenceProfile>
  ): Promise<ModerationResult> {
    let aiBudgetReserved = false;
    try {
      if (!this.model) {
        const offline = offlineModeration(input, {
          reasonTag: "provider_unavailable",
          modelId: this.modelId,
        });
        await recordAiUsage({
          outcome: offline.requiresReview
            ? "quarantine"
            : offline.isApproved
              ? "approve"
              : "reject",
          countedRequest: false,
        });
        await this.persistCase(input, offline, softSignal, {
          provider: "offline",
        });
        return offline;
      }

      const prompt = buildModerationPrompt(input);
      const sampledFrameCount = Math.min(
        input.videoFrames?.length || 0,
        MODERATION_MAX_VIDEO_FRAMES,
        profile.maxFrames || MODERATION_MAX_VIDEO_FRAMES
      );
      aiBudgetReserved = await reserveAiBudget(
        Math.ceil(prompt.length / 4) + sampledFrameCount * 258,
        1024
      );
      if (!aiBudgetReserved) {
        const budgetBlocked: ModerationResult = {
          isApproved: false,
          confidence: 0,
          reason:
            "AI moderation budget exhausted — applying offline gospel rules",
          flags: ["ai_budget_exhausted"],
          requiresReview: true,
          languageCandidates: languages,
          modelId: this.modelId || undefined,
        };
        await recordAiUsage({ outcome: "budget_block", countedRequest: false });
        const offline = offlineModeration(input, {
          reasonTag: "ai_budget_exhausted",
          modelId: this.modelId,
        });
        const merged: ModerationResult = {
          ...offline,
          flags: [
            ...new Set([
              ...(budgetBlocked.flags || []),
              ...(offline.flags || []),
            ]),
          ],
        };
        await this.persistCase(input, merged, softSignal, {
          provider: "offline",
        });
        return merged;
      }

      const parts: any[] = [{ text: prompt }];
      const toBase64Data = (s: string) =>
        s.replace(/^data:image\/\w+;base64,/, "");

      if (input.thumbnail) {
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: toBase64Data(input.thumbnail),
          },
        });
      }

      if (input.videoFrames && input.videoFrames.length > 0) {
        const framesForModel = sampleVideoFramesForModeration(
          input.videoFrames,
          Math.min(
            MODERATION_MAX_VIDEO_FRAMES,
            profile.maxFrames || MODERATION_MAX_VIDEO_FRAMES
          )
        );
        for (const frame of framesForModel) {
          parts.push({
            inlineData: {
              mimeType: "image/jpeg",
              data: toBase64Data(frame),
            },
          });
        }
      }

      const result = await generateContentWithRetry(
        this.model,
        { contents: [{ role: "user", parts }] },
        { label: "moderation" }
      );
      const aiResponse = (await result.response).text();

      let parsed = parseModerationResponse(aiResponse, input);
      parsed = {
        ...parsed,
        languageCandidates: languages,
        modelId: this.modelId || undefined,
        flags: [
          ...(parsed.flags || []),
          ...(softSignal ? ["soft_blocklist_signal"] : []),
          "gemini_gray_zone",
        ],
      };
      if (softSignal && parsed.isApproved && parsed.confidence < 0.9) {
        parsed = {
          ...parsed,
          isApproved: false,
          requiresReview: true,
          reason:
            parsed.reason ||
            "Ambiguous policy signal — queued for manual review",
        };
      }
      await recordAiUsage({
        inputTokens:
          Math.ceil(prompt.length / 4) + (input.videoFrames?.length || 0) * 258,
        outputTokens: Math.ceil((aiResponse?.length || 0) / 4),
        usageReserved: true,
        outcome: parsed.requiresReview
          ? "quarantine"
          : parsed.isApproved
            ? "approve"
            : "reject",
      });
      await this.persistCase(input, parsed, softSignal, {
        provider: "google-gemini",
      });
      return parsed;
    } catch (error: any) {
      logger.error("Error in Gemini moderation:", error);
      const offline = offlineModeration(input, {
        reasonTag: "moderation_service_error",
        aiError: String(error?.message || error).slice(0, 200),
        modelId: this.modelId,
      });
      await recordAiUsage({
        outcome: offline.requiresReview
          ? "error"
          : offline.isApproved
            ? "approve"
            : "reject",
        countedRequest: aiBudgetReserved,
        usageReserved: aiBudgetReserved,
      });
      await this.persistCase(input, offline, softSignal, { provider: "offline" });
      return offline;
    }
  }

  async moderateContent(input: ModerationInput): Promise<ModerationResult> {
    try {
      const languages = detectLanguageCandidates(policyText(input));
      const profile = getEvidenceProfile(input.contentType, input.fileMimeType);
      const coverage = {
        title: !!input.title?.trim(),
        description: !!input.description?.trim(),
        transcript: !!input.transcript?.trim(),
        transcriptChars: input.transcript?.length || 0,
        frames: !!(input.videoFrames && input.videoFrames.length),
        frameCount: input.videoFrames?.length || 0,
        thumbnail: !!input.thumbnail,
        textChars: input.transcript?.length || 0,
      };

      if (!hasMinimumEvidence(profile, coverage)) {
        const low: ModerationResult = {
          isApproved: false,
          confidence: 0.1,
          reason:
            "Insufficient evidence coverage for this media type — queued for manual review",
          flags: ["insufficient_evidence", "requires_human_review"],
          requiresReview: true,
          languageCandidates: languages,
          modelId: this.modelId || undefined,
        };
        await recordAiUsage({ outcome: "quarantine", countedRequest: false });
        await this.persistCase(input, low, false, { provider: "offline" });
        return low;
      }

      const block = matchModerationBlocklist(policyText(input));
      if (block && block.severity === "hard") {
        const hard: ModerationResult = {
          isApproved: false,
          confidence: 0.95,
          reason:
            "Content blocked by platform policy (inappropriate term or phrase in title, description, or transcript).",
          flags: [
            "policy_blocklist",
            "inappropriate_content",
            ...(block.phrase ? [`blocked:${block.phrase}`] : []),
            ...(block.pattern ? [`blocked_pattern`] : []),
          ],
          requiresReview: false,
          languageCandidates: languages,
          modelId: this.modelId || undefined,
        };
        await recordAiUsage({ outcome: "reject", countedRequest: false });
        await this.persistCase(input, hard, false, { provider: "offline" });
        return hard;
      }

      const softSignal = block?.severity === "soft";

      // 1) Content Guardian primary path
      const guardianResult = await this.tryGuardianPath(
        input,
        languages,
        softSignal
      );
      if (guardianResult) return guardianResult;

      // 2) Gemini gray-zone (or gemini_first mode)
      if (fusionMode() !== "offline_only") {
        return await this.runGeminiPath(
          input,
          languages,
          softSignal,
          profile
        );
      }

      // 3) Offline only
      const offline = offlineModeration(input, {
        reasonTag: "offline_only_mode",
        modelId: this.modelId,
      });
      await recordAiUsage({
        outcome: offline.requiresReview
          ? "quarantine"
          : offline.isApproved
            ? "approve"
            : "reject",
        countedRequest: false,
      });
      await this.persistCase(input, offline, softSignal, {
        provider: "offline",
      });
      return offline;
    } catch (error: any) {
      logger.error("Error in content moderation:", error);
      const offline = offlineModeration(input, {
        reasonTag: "moderation_service_error",
        aiError: String(error?.message || error).slice(0, 200),
        modelId: this.modelId,
      });
      await recordAiUsage({
        outcome: offline.requiresReview ? "error" : offline.isApproved ? "approve" : "reject",
        countedRequest: false,
      });
      await this.persistCase(input, offline, false, { provider: "offline" });
      return offline;
    }
  }

  isAvailable(): boolean {
    return this.genAI !== null && this.model !== null;
  }

  isGuardianConfigured(): boolean {
    return isGuardianConfigured();
  }
}

export const contentModerationService = new ContentModerationService();
