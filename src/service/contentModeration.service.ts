import { GoogleGenerativeAI } from "@google/generative-ai";
import { matchModerationBlocklist } from "../config/moderationBlocklist";
import logger from "../utils/logger";

export interface ModerationResult {
  isApproved: boolean;
  confidence: number; // 0-1
  reason?: string;
  flags: string[];
  requiresReview: boolean;
}

export interface ModerationInput {
  transcript?: string;
  videoFrames?: string[]; // Base64 encoded images
  thumbnail?: string; // Base64 encoded thumbnail image
  title?: string;
  description?: string;
  contentType: string;
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

  /** All user-provided text for policy checks (full transcript — not truncated). */
  private policyText(input: ModerationInput): string {
    return `${input.title || ""} ${input.description || ""} ${input.transcript || ""}`;
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
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      logger.warn(
        "GOOGLE_AI_API_KEY not found. Content moderation will use basic checks only."
      );
      this.genAI = null;
      this.model = null;
    } else {
      this.genAI = new GoogleGenerativeAI(apiKey);
      // Use gemini-1.5-pro for better multimodal analysis and accuracy
      // Pro model has better detection rates for inappropriate content
      const useProModel = process.env.USE_GEMINI_PRO_MODEL === "true" || process.env.NODE_ENV === "production";
      this.model = this.genAI.getGenerativeModel({
        model: useProModel ? "gemini-1.5-pro" : "gemini-1.5-flash", // Use Pro for production for better accuracy
      });
    }
  }

  /**
   * Moderate content using AI classification
   */
  async moderateContent(
    input: ModerationInput
  ): Promise<ModerationResult> {
    try {
      const block = matchModerationBlocklist(this.policyText(input));
      if (block) {
        return {
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
        };
      }

      // If no AI model available, use basic keyword checks
      if (!this.model) {
        return this.basicModeration(input);
      }

      // Build the prompt for Gemini
      const prompt = this.buildModerationPrompt(input);

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
          MODERATION_MAX_VIDEO_FRAMES
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

      // Generate content with Gemini
      const result = await this.model.generateContent({
        contents: [{ role: "user", parts }],
      });

      const response = await result.response;
      const aiResponse = response.text();

      return this.parseModerationResponse(aiResponse, input);
    } catch (error: any) {
      logger.error("Error in content moderation:", error);
      // Do not auto-approve when the model fails — block upload and force manual review path
      return {
        isApproved: false,
        confidence: 0,
        reason:
          "Automated moderation could not complete. Upload is held until the content can be reviewed.",
        flags: ["moderation_service_error"],
        requiresReview: true,
      };
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

      // Non-JSON response: do not guess approval — fall back to keyword/blocklist checks
      logger.warn("Moderation response was not valid JSON; using conservative fallback");
      return this.basicModeration(input);
    } catch (error) {
      logger.error("Error parsing moderation response:", error);
      return this.basicModeration(input);
    }
  }

  /**
   * Basic moderation using keyword checks (fallback)
   */
  private basicModeration(input: ModerationInput): ModerationResult {
    const block = matchModerationBlocklist(this.policyText(input));
    if (block) {
      return {
        isApproved: false,
        confidence: 0.9,
        reason: "Policy blocklist (offline moderation)",
        flags: ["policy_blocklist", "inappropriate_content"],
        requiresReview: false,
      };
    }

    // Substring checks: unambiguous coarse themes (not "sex" — false positives on "sexual immorality" sermons).
    const inappropriateSubstrings = [
      "explicit",
      "nude",
      "porn",
      "violence",
      "blasphemy",
      "blaspheme",
    ];

    // Strong profanity only (word boundaries; avoids "skill"/"Essex"-style substring noise).
    const strongProfanityPattern =
      /\b(?:fuck|fucking|fucker|motherfucker|shit|bullshit|bitch|bitches|nigga|niggas|pussy|cunt|slut|whore)\b/i;

    const gospelKeywords = [
      // Core names and worship
      "jesus",
      "christ",
      "god",
      "lord",
      "prayer",
      "worship",
      "praise",
      "gospel",
      "bible",
      "scripture",
      "faith",
      "church",
      "sermon",
      "hymn",
      "devotional",
      "blessing",
      "amen",
      "hallelujah",
      "hosanna",
      // Scriptural / theological (sermons may rarely say "Jesus" but use these)
      "salvation",
      "redemption",
      "repentance",
      "resurrection",
      "holy spirit",
      "spirit of god",
      "covenant",
      "grace",
      "righteousness",
      "righteous",
      "sinner",
      "saved",
      "eternal life",
      "kingdom of god",
      "kingdom of heaven",
      "word of god",
      "word of the lord",
      "testimony",
      "testify",
      "preach",
      "preaching",
      "pastor",
      "minister",
      "congregation",
      "altar",
      "saved",
      "born again",
      "sanctification",
      "glorify",
      "glory",
      "prophet",
      "prophecy",
      "disciple",
      "apostle",
      "parable",
      "psalm",
      "proverb",
      "genesis",
      "exodus",
      "romans",
      "corinthians",
      "galatians",
      "ephesians",
      "philippians",
      "colossians",
      "hebrews",
      "revelation",
      "isaiah",
      "jeremiah",
      "matthew",
      "mark",
      "luke",
      "john",
      "acts ",
      "peter",
      "paul",
      "moses",
      "abraham",
      "david",
      "solomon",
      "elijah",
      "elisha",
      "daniel",
      "nehemiah",
      "ezekiel",
      "zechariah",
      "malachi",
      "obedience",
      "obey",
      "commandment",
      "law of moses",
      "law of the lord",
      "cross",
      "crucified",
      "risen",
      "ascension",
      "pentecost",
      "trinity",
      "father ",
      "son ",
      "comforter",
      "advocate",
      "shepherd",
      "lamb of god",
      "bread of life",
      "light of the world",
      "alpha and omega",
      "immanuel",
      "emmanuel",
      "father",
      "son of god",
      "only begotten",
      // Yoruba keywords (common gospel terms)
      "jésù",
      "jésu",
      "olúwa",
      "oluwa",
      "ọlọrun",
      "olorun",
      "ìwòrìpò",
      "iworipo",
      "àdúrà",
      "adura",
      "ìgbàgbọ",
      "igbagbo",
      // Hausa keywords
      "yesu",
      "ubangiji",
      "allah",
      "addu'a",
      "ibada",
      // Igbo keywords
      "jisos",
      "chiukwu",
      "ekpere",
      "abụ",
      // Common transliterations and variations
      "yehovah",
      "yahweh",
      "messiah",
    ];

    const textToCheck = `${input.title || ""} ${input.description || ""} ${input.transcript || ""}`.toLowerCase();

    const hasInappropriate =
      inappropriateSubstrings.some((keyword) => textToCheck.includes(keyword)) ||
      strongProfanityPattern.test(textToCheck);

    // Check for gospel content
    const hasGospel = gospelKeywords.some(keyword =>
      textToCheck.includes(keyword)
    );

    if (hasInappropriate) {
      return {
        isApproved: false,
        confidence: 0.7,
        reason: "Inappropriate keywords detected",
        flags: ["inappropriate_keywords"],
        requiresReview: false,
      };
    }

    if (hasGospel) {
      return {
        isApproved: true,
        confidence: 0.6,
        reason: "Gospel keywords detected",
        flags: [],
        requiresReview: false,
      };
    }

    // If neither, require review
    return {
      isApproved: false,
      confidence: 0.4,
      reason: "Unable to determine content type - requires review",
      flags: ["unclear_content"],
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

// Export singleton instance
export const contentModerationService = new ContentModerationService();


