import { createHash } from "crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { matchModerationBlocklist } from "../config/moderationBlocklist";
import { ModerationCase } from "../models/moderationCase.model";
import {
  reserveAiBudget,
  recordAiUsage,
} from "./moderation/aiBudget.service";
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
import logger from "../utils/logger";

export interface ModerationResult {
  isApproved: boolean;
  confidence: number; // 0-1
  reason?: string;
  flags: string[];
  requiresReview: boolean;
  languageCandidates?: string[];
  modelId?: string;
}

export interface ModerationInput {
  transcript?: string;
  videoFrames?: string[]; // Base64 encoded images
  thumbnail?: string; // Base64 encoded thumbnail image
  title?: string;
  description?: string;
  contentType: string;
  mediaId?: string;
  contentHash?: string;
  fileMimeType?: string;
}

const MODERATION_TRANSCRIPT_PROMPT_MAX = 12000;

/** Frames sent to the vision model (extracted frames are spread across the video; we subsample evenly). */
const MODERATION_MAX_VIDEO_FRAMES = Math.min(
  16,
  Math.max(4, parseInt(process.env.MODERATION_MAX_VIDEO_FRAMES || "10", 10) || 10)
);

export class ContentModerationService {
  private genAI: GoogleGenerativeAI | null;
  private model: any;
  private modelId: string | null = null;

  /** All user-provided text for policy checks (full transcript — not truncated). */
  private policyText(input: ModerationInput): string {
    return `${input.title || ""} ${input.description || ""} ${input.transcript || ""}`;
  }

  /** Heuristic language candidates for Nigerian multilingual evidence logging. */
  private detectLanguageCandidates(text: string): string[] {
    const t = (text || "").toLowerCase();
    const out = new Set<string>(["en"]);
    if (/\b(?:wetin|dey|abi|naija|no be|make we|oya|sef)\b/.test(t)) out.add("pcm");
    if (/\b(?:oluwa|olorun|adura|igbagbo|jesu|yesu|ẹni|fun)\b/.test(t) || /[ẹọṣàáéíóúǹ]/.test(t))
      out.add("yo");
    if (/\b(?:chukwu|chineke|chisom|nke|nwanne|jisos|ekpere)\b/.test(t)) out.add("ig");
    if (/\b(?:ubangiji|addu'?a|ibada|yesu|allah)\b/.test(t)) out.add("ha");
    return [...out];
  }

  private async persistCase(
    input: ModerationInput,
    result: ModerationResult,
    softSignal?: boolean
  ): Promise<void> {
    if (!input.mediaId) return;
    try {
      const evidenceHashes = [
        createHash("sha256")
          .update(this.policyText(input).slice(0, 8000))
          .digest("hex")
          .slice(0, 32),
      ];
      await ModerationCase.create({
        mediaId: input.mediaId,
        contentHash: input.contentHash,
        provider: this.model ? "google-gemini" : "offline",
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
        languageCandidates: result.languageCandidates || this.detectLanguageCandidates(this.policyText(input)),
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
      });
    } catch (err) {
      logger.warn("Failed to persist moderation case", { err });
    }
  }

  /** Evenly sample frames so the model sees the beginning, middle, and end of the video (not only the first 3 timestamps). */
  private sampleVideoFramesForModeration(frames: string[], max: number): string[] {
    if (frames.length <= max) {
      return frames;
    }
    const picked: string[] = [];
    for (let i = 0; i < max; i++) {
      const idx = Math.min(
        frames.length - 1,
        Math.round((i / Math.max(1, max - 1)) * (frames.length - 1))
      );
      picked.push(frames[idx]);
    }
    return [...new Set(picked)];
  }

  constructor() {
    const apiKey = getGoogleAiApiKey();
    if (!apiKey) {
      logger.warn(
        "GOOGLE_AI_API_KEY not found. Content moderation will quarantine for review (never auto-approve)."
      );
      this.genAI = null;
      this.model = null;
    } else {
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
  }

  /**
   * Moderate content using AI classification
   */
  async moderateContent(
    input: ModerationInput
  ): Promise<ModerationResult> {
    let aiBudgetReserved = false;
    try {
      const languages = this.detectLanguageCandidates(this.policyText(input));
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
        await this.persistCase(input, low);
        return low;
      }

      const block = matchModerationBlocklist(this.policyText(input));
      if (block && block.severity === "hard") {
        const hard: ModerationResult = {
          isApproved: false,
          confidence: 0.95,
          reason: `Content blocked by platform policy (inappropriate term or phrase in title, description, or transcript).`,
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
        await this.persistCase(input, hard);
        return hard;
      }

      const softSignal = block?.severity === "soft";

      // If no AI model available, quarantine for review — never auto-approve publicly
      if (!this.model) {
        const fallback = this.basicModeration(input);
        const quarantined: ModerationResult = {
          ...fallback,
          isApproved: false,
          requiresReview: true,
          reason:
            fallback.reason ||
            "AI moderation unavailable — queued for manual review",
          flags: [
            ...(fallback.flags || []),
            "provider_unavailable",
            ...(softSignal ? ["soft_blocklist_signal"] : []),
          ],
          languageCandidates: languages,
        };
        await recordAiUsage({ outcome: "quarantine", countedRequest: false });
        await this.persistCase(input, quarantined, softSignal);
        return quarantined;
      }

      // Build before reservation so the atomic token estimate reflects this
      // request rather than a generic default.
      const prompt = this.buildModerationPrompt(input);
      const sampledFrameCount = Math.min(
        input.videoFrames?.length || 0,
        MODERATION_MAX_VIDEO_FRAMES,
        profile.maxFrames || MODERATION_MAX_VIDEO_FRAMES
      );
      const estimatedInputTokens =
        Math.ceil(prompt.length / 4) + sampledFrameCount * 258;
      const estimatedOutputTokens = 1024;
      aiBudgetReserved = await reserveAiBudget(
        estimatedInputTokens,
        estimatedOutputTokens
      );
      if (!aiBudgetReserved) {
        const budgetBlocked: ModerationResult = {
          isApproved: false,
          confidence: 0,
          reason:
            "AI moderation budget exhausted — queued for manual review (never auto-approved)",
          flags: ["ai_budget_exhausted", "requires_human_review"],
          requiresReview: true,
          languageCandidates: languages,
          modelId: this.modelId || undefined,
        };
        await recordAiUsage({ outcome: "budget_block", countedRequest: false });
        await this.persistCase(input, budgetBlocked, softSignal);
        return budgetBlocked;
      }

      // Prepare content parts for multimodal analysis: prompt + thumbnail (if any) + video frames (if any)
      const parts: any[] = [{ text: prompt }];

      const toBase64Data = (dataUrlOrBase64: string): string =>
        dataUrlOrBase64.replace(/^data:image\/\w+;base64,/, "");

      // Thumbnail is the first thing users see - send it so the AI can actually check it
      if (input.thumbnail) {
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: toBase64Data(input.thumbnail),
          },
        });
      }

      // Video frames: evenly sampled across the full timeline (pipeline may extract many frames)
      if (input.videoFrames && input.videoFrames.length > 0) {
        const framesForModel = this.sampleVideoFramesForModeration(
          input.videoFrames,
          Math.min(
            MODERATION_MAX_VIDEO_FRAMES,
            profile.maxFrames || MODERATION_MAX_VIDEO_FRAMES
          )
        );
        framesForModel.forEach((frame) => {
          parts.push({
            inlineData: {
              mimeType: "image/jpeg",
              data: toBase64Data(frame),
            },
          });
        });
      }

      const result = await generateContentWithRetry(
        this.model,
        { contents: [{ role: "user", parts }] },
        { label: "moderation" }
      );

      const response = await result.response;
      const aiResponse = response.text();

      let parsed = this.parseModerationResponse(aiResponse, input);
      parsed = {
        ...parsed,
        languageCandidates: languages,
        modelId: this.modelId || undefined,
        flags: [
          ...(parsed.flags || []),
          ...(softSignal ? ["soft_blocklist_signal"] : []),
        ],
      };
      // Soft blocklist or low evidence → never silent public approve
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
        inputTokens: Math.ceil(prompt.length / 4) + (input.videoFrames?.length || 0) * 258,
        outputTokens: Math.ceil((aiResponse?.length || 0) / 4),
        usageReserved: true,
        outcome: parsed.requiresReview
          ? "quarantine"
          : parsed.isApproved
            ? "approve"
            : "reject",
      });
      await this.persistCase(input, parsed, softSignal);
      return parsed;
    } catch (error: any) {
      logger.error("Error in content moderation:", error);
      // Do not auto-approve when the model fails — block upload and force manual review path
      const errResult: ModerationResult = {
        isApproved: false,
        confidence: 0,
        reason:
          "Automated moderation could not complete. Upload is held until the content can be reviewed.",
        flags: ["moderation_service_error"],
        requiresReview: true,
        languageCandidates: this.detectLanguageCandidates(this.policyText(input)),
        modelId: this.modelId || undefined,
      };
      await recordAiUsage({
        outcome: "error",
        countedRequest: aiBudgetReserved,
        usageReserved: aiBudgetReserved,
      });
      await this.persistCase(input, errResult);
      return errResult;
    }
  }

  /**
   * Build the moderation prompt for Gemini
   */
  private buildModerationPrompt(input: ModerationInput): string {
    const hasTranscript = !!input.transcript;
    const hasFrames = input.videoFrames && input.videoFrames.length > 0;
    const framesForPrompt = hasFrames && input.videoFrames
      ? this.sampleVideoFramesForModeration(
          input.videoFrames,
          MODERATION_MAX_VIDEO_FRAMES
        )
      : [];

    const transcriptText = hasTranscript && input.transcript
      ? `- Transcript: "${input.transcript.substring(0, MODERATION_TRANSCRIPT_PROMPT_MAX)}${input.transcript.length > MODERATION_TRANSCRIPT_PROMPT_MAX ? "..." : ""}"`
      : "";

    const hasThumbnail = !!input.thumbnail;
    const framesText = hasFrames && input.videoFrames
      ? `- Video Frames: ${input.videoFrames.length} frame(s) extracted from the video at different times; ${framesForPrompt.length} representative frame(s) are attached below (spread across early, middle, and late parts of the video) for visual analysis`
      : "";
    const thumbnailText = hasThumbnail
      ? `- Thumbnail Image: Provided below for visual analysis (CRITICAL - this is what users see first; check for inappropriate content)`
      : "";
    const imageOrderText =
      hasThumbnail || hasFrames
        ? `\n**Images attached below (in order):** ${hasThumbnail ? "First image = thumbnail (what users see first). " : ""}${hasFrames ? "Following image(s) = frames extracted from the uploaded video." : ""}`.trim()
        : "";

    return `You are a content moderation system for a Christian gospel media platform called Jevah. Your task is to determine if uploaded content is appropriate for a gospel/Christian platform.

**Content Information:**
- Title: "${input.title || "N/A"}"
- Description: "${input.description || "N/A"}"
- Content Type: ${input.contentType}
${transcriptText}
${thumbnailText}
${framesText}
${imageOrderText}

**Your Task:**
Analyze this content and determine if it is:
1. **Gospel-inclined/Christian content** - Content that aligns with Christian values, biblical teachings, worship, prayer, spiritual growth, or Christian community
   - This includes gospel music and videos in ANY language (English, Yoruba, Hausa, Igbo, or any other language)
   - Gospel songs without preaching are still valid gospel content
   - Worship songs, praise songs, and hymns in any language are acceptable
   - Contemporary gospel, traditional gospel, and gospel in local languages are all acceptable
   - **MARITAL & RELATIONSHIP TEACHINGS**: Biblical teachings on marriage, sex within marriage, and godly relationships are VALID gospel content. Pastor-led discussions or sermons on these topics should be APPROVED if they are presented from a biblical perspective and are not explicit or inappropriate in a secular sense.
   - **SERMONS**: A sermon may scarcely or never mention "Jesus" by name but can still be clearly Christian. Look for:
     * Scriptural and theological language: salvation, redemption, repentance, grace, covenant, righteousness, resurrection, Holy Spirit, kingdom of God, Word of God, cross, crucified, risen
     * Biblical concepts and terms: testimony, preaching, pastor, congregation, altar, born again, sanctification, disciple, apostle, parable
     * Bible book names or figures: Genesis, Romans, Isaiah, Matthew, Paul, Moses, David, Peter, etc.
     * Phrases like "the Lord", "Scripture says", "the Bible", "God's word", "eternal life", "kingdom of heaven"
     If the content is clearly teaching or preaching from a Christian/biblical perspective, APPROVE it even without the word "Jesus"
2. **Inappropriate content** - Content that contains:
   - Explicit sexual content, nudity, or *unbiblical/pornographic* sexual themes
   - Violence, hate speech, or harmful content
   - Profanity or offensive language
   - Anti-Christian or blasphemous content
   - Illegal activities
   - Non-gospel content (secular music, non-Christian teachings, etc.)
   - **Note**: Do NOT reject biblical teachings on marriage or sexuality that are presented respectfully and for spiritual growth.

**CRITICAL - Nigeria / Pidgin / local languages (Latin script):**
- Users may speak **Nigerian Pidgin**, **Yoruba**, **Hausa**, **Igbo**, or **code-mixed English**. You must judge **meaning and intent**, not individual slang words in isolation.
- **SERMONS / TEACHING**: A pastor may quote or mention crude cultural slang (e.g. **yansh**, **bumbum**, **nyash**) to **rebuke worldliness**, teach **modesty/purity**, or illustrate a biblical point. **APPROVE** when the transcript shows **preaching, scripture, correction, or godly exhortation**, even if those words appear.
- **REJECT** when such slang is used to **celebrate** sexual immorality, objectify people, or as part of **secular club/party content** with no Christian message.
- **REJECT** if spoken content or on-screen text **promotes** sexual objectification, lewd dancing as the main subject, or **street/club secular music** with no worship, Bible, or Christian message.
- **Transactional / street sex slang** (**ashawo**, **olosho**, **runs** in a sexual bragging sense) in a **non-sermon**, **celebratory** music context is usually non-gospel — **REJECT** unless clearly framed as **repentance/testimony or biblical warning** in the transcript.
- **Do NOT** treat Pidgin gospel worship or biblical teaching as "low quality" — approve when the **substance** is praise, scripture, sermon, or Christian testimony, even if informal language is used.
- If the **primary purpose** is entertainment, flexing, or sexual themes rather than **Jesus, the Word of God, worship, or biblical teaching**, REJECT or set requiresReview = true.

**CRITICAL - Nigerian Christian / God-related names (do NOT flag as inappropriate):**
- Personal and theophoric names are common and **must be allowed**: Godwin, Godspower, Godstime, Blessing, Grace, Favour, Faith, Hope, Charity, Gift, Miracle, Praise, Glory, Emmanuel, Immanuel, Joshua, David, Daniel, Samuel, Esther, Ruth, Mary, Martha, Deborah, Joseph, Michael, Gabriel.
- Yoruba: Oluwa-*, Olu-, Jesu, Yesu, Olodumare (in Christian worship/testimony context).
- Igbo: Chukwu-*, Chi-*, Chineke, Yesu.
- Hausa/Arabic-influenced Christian usage: Yesu, Allah as a **personal-name component or quoted scripture** in a Christian sermon/testimony is **not** automatic rejection — judge teaching intent.
- Allow **repentance/testimony**, **biblical violence** narratives, **Song of Songs / marriage teaching**, **apologetics**, and **respectful interfaith comparison**. Reject only **severe** safety violations or clearly anti-Christian blasphemy as the *primary* purpose.

**CRITICAL - Video frames (must use together with transcript):**
- The attached images include **video stills** sampled across the timeline (not only the opening).
- Use **visual context**: **APPROVE** when frames suggest **church, pulpit, open Bible, cross, choir robes, congregation, prayer/worship posture**, or other clear **Christian gathering** signals — especially if the transcript sounds like preaching or teaching.
- **REJECT** when frames suggest **nightclub, strip club, sexualized performance**, nudity, or **primary focus on lewd dancing** with no gospel context — even if the audio language is hard to judge.
- If **audio says something coarse** but **visuals + transcript** indicate a **sermon or teaching**, prefer **APPROVE** (or requiresReview = true only if genuinely ambiguous).

**CRITICAL - Thumbnail Moderation:**
- The thumbnail image is the FIRST thing users see - it MUST be appropriate
- If the thumbnail contains ANY inappropriate content (nudity, explicit content, violence), REJECT immediately
- Thumbnail must align with gospel/Christian values
- Even if other content is acceptable, an inappropriate thumbnail requires REJECTION

**Output Format (CRITICAL - Follow exactly):**
Respond in this exact JSON format:
{
  "isApproved": true/false,
  "confidence": 0.0-1.0,
  "reason": "Brief explanation",
  "flags": ["flag1", "flag2"],
  "requiresReview": true/false
}

**Guidelines:**
- If content is clearly gospel/Christian-related: isApproved = true, confidence > 0.8, requiresReview = false (so it goes live immediately)
- If content is clearly inappropriate: isApproved = false, confidence > 0.8
- If uncertain or borderline: requiresReview = true, confidence < 0.8
- For clearly approved gospel content, always set requiresReview = false so it is not held for manual review
- Flags should include specific issues found (e.g., "explicit_language", "non_gospel_content", "violence", "sexual_content", "blasphemy", "secular_music")
- For gospel content, flags can be empty or include positive tags like "gospel_music", "biblical_teaching", "worship_content"

**CRITICAL - Multilingual Support:**
- **Content can be in ANY language** - English, Yoruba, Hausa, Igbo, or any other language
- **Gospel music in Nigerian languages** (Yoruba, Hausa, Igbo) is VALID and should be APPROVED
- **Pure gospel songs** (without preaching or spoken words) are VALID gospel content
- **Worship songs** in any language that align with Christian values are acceptable
- Do NOT reject content just because it's in a language other than English
- Analyze the CONTENT and MEANING, not the language
- If transcript contains gospel/Christian themes, biblical references, worship, praise, or prayer in ANY language, approve it

**Important:**
- Be strict about non-gospel content (secular music, non-Christian teachings)
- Allow Christian content even if it's contemporary or modern in style
- Consider context - Christian rap, contemporary worship, gospel in local languages, etc. are all acceptable
- **Sermons and teaching**: Do NOT require the word "Jesus" or "Christ" to be present. Scriptural language, Bible references, theological terms (salvation, grace, covenant, resurrection, etc.), and preaching style are strong signals of gospel content. Approve when the content is clearly biblical/Christian teaching.
- Reject content that promotes values contrary to Christianity, regardless of language
- When in doubt, set requiresReview = true
- Remember: A gospel song in Yoruba, Hausa, or Igbo is just as valid as one in English
- **Positive requirement**: Content should be **meaningfully gospel-centered** — worship, Bible, Jesus Christ, Christian teaching, testimony, or choir/gospel music that clearly serves faith. Purely secular topics without a Christian frame should be rejected.

Now analyze the content and provide your response in the exact JSON format above.`;
  }

  /**
   * Parse the AI moderation response
   */
  private parseModerationResponse(
    aiResponse: string,
    input: ModerationInput
  ): ModerationResult {
    try {
      // Try to extract JSON from the response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const isApproved = parsed.isApproved === true;
        const confidence = Math.max(0, Math.min(1, parsed.confidence || 0.5));
        const flags: string[] = Array.isArray(parsed.flags) ? parsed.flags : [];
        // When content is clearly approved with high confidence, don't require review (avoids gospel content stuck "under review")
        const isClearGospel = flags.some(f => typeof f === "string" && /gospel|worship|biblical|christian|faith/i.test(f));
        const requiresReview = isApproved && (confidence >= 0.8 || isClearGospel)
          ? false
          : parsed.requiresReview === true;
        return {
          isApproved,
          confidence,
          reason: parsed.reason || "AI analysis completed",
          flags,
          requiresReview,
        };
      }

      // Non-JSON / parse failure → quarantine, never auto-approve
      logger.warn("Moderation response was not valid JSON; quarantining for review");
      return {
        isApproved: false,
        confidence: 0,
        reason: "Moderation response could not be parsed — queued for manual review",
        flags: ["moderation_parse_error"],
        requiresReview: true,
      };
    } catch (error) {
      logger.error("Error parsing moderation response:", error);
      return {
        isApproved: false,
        confidence: 0,
        reason: "Moderation parse error — queued for manual review",
        flags: ["moderation_parse_error"],
        requiresReview: true,
      };
    }
  }

  /**
   * Offline fallback: hard-reject only unambiguous severe signals.
   * Ambiguous / gospel-like content is quarantined for review — never auto-approved
   * via short substrings like "god" / "mark" / "john".
   */
  private basicModeration(input: ModerationInput): ModerationResult {
    const block = matchModerationBlocklist(this.policyText(input));
    if (block) {
      // Hard blocklist remains reject; soft signals handled below
      if (block.severity !== "soft") {
        return {
          isApproved: false,
          confidence: 0.9,
          reason: "Policy blocklist (offline moderation)",
          flags: ["policy_blocklist", "inappropriate_content"],
          requiresReview: false,
        };
      }
    }

    const text = this.policyText(input).toLowerCase();

    const strongProfanityPattern =
      /\b(?:fuck|fucking|fucker|motherfucker|shit|bullshit|bitch|bitches|nigga|niggas|pussy|cunt|slut|whore)\b/i;
    const severeThemes =
      /\b(?:porn|porno|xxx|nude|nudity|blaspheme|blasphemy)\b/i;

    if (strongProfanityPattern.test(text) || severeThemes.test(text)) {
      return {
        isApproved: false,
        confidence: 0.85,
        reason: "Severe policy terms detected (offline moderation)",
        flags: ["inappropriate_content"],
        requiresReview: false,
      };
    }

    // Word-boundary gospel signals (never substring "god" inside "Godwin" alone as approval)
    const gospelPhrasePattern =
      /\b(?:jesus|christ|gospel|bible|scripture|worship|hallelujah|hosanna|sermon|pastor|holy\s+spirit|kingdom\s+of\s+god|word\s+of\s+god|oluwa|chukwu|chineke|yesu|jesu)\b/i;

    if (gospelPhrasePattern.test(text)) {
      return {
        isApproved: false,
        confidence: 0.4,
        reason:
          "Possible Christian content detected offline — queued for manual review (AI unavailable)",
        flags: ["possible_gospel", "requires_human_review"],
        requiresReview: true,
      };
    }

    return {
      isApproved: false,
      confidence: 0.2,
      reason: "Insufficient offline evidence — queued for manual review",
      flags: ["insufficient_evidence", "requires_human_review"],
      requiresReview: true,
    };
  }

  /**
   * Check if moderation service is available
   */
  isAvailable(): boolean {
    return this.genAI !== null && this.model !== null;
  }
}

export const contentModerationService = new ContentModerationService();
