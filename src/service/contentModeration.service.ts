import { GoogleGenerativeAI } from "@google/generative-ai";
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

export class ContentModerationService {
  private genAI: GoogleGenerativeAI | null;
  private model: any;

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

      // Video frames extracted from uploaded video (beginning, middle, end) for visual moderation
      if (input.videoFrames && input.videoFrames.length > 0) {
        input.videoFrames.slice(0, 3).forEach((frame) => {
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

      // Parse the AI response
      return this.parseModerationResponse(aiResponse, input);
    } catch (error: any) {
      logger.error("Error in content moderation:", error);
      // On error, use basic moderation as fallback
      return this.basicModeration(input);
    }
  }

  /**
   * Build the moderation prompt for Gemini
   */
  private buildModerationPrompt(input: ModerationInput): string {
    const hasTranscript = !!input.transcript;
    const hasFrames = input.videoFrames && input.videoFrames.length > 0;

    const transcriptText = hasTranscript && input.transcript
      ? `- Transcript: "${input.transcript.substring(0, 1000)}${input.transcript.length > 1000 ? "..." : ""}"`
      : "";
    
    const hasThumbnail = !!input.thumbnail;
    const framesText = hasFrames && input.videoFrames
      ? `- Video Frames: ${input.videoFrames.length} frames extracted from the uploaded video (beginning, middle, end) for visual analysis`
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
   - **SERMONS**: A sermon may scarcely or never mention "Jesus" by name but can still be clearly Christian. Look for:
     * Scriptural and theological language: salvation, redemption, repentance, grace, covenant, righteousness, resurrection, Holy Spirit, kingdom of God, Word of God, cross, crucified, risen
     * Biblical concepts and terms: testimony, preaching, pastor, congregation, altar, born again, sanctification, disciple, apostle, parable
     * Bible book names or figures: Genesis, Romans, Isaiah, Matthew, Paul, Moses, David, Peter, etc.
     * Phrases like "the Lord", "Scripture says", "the Bible", "God's word", "eternal life", "kingdom of heaven"
     If the content is clearly teaching or preaching from a Christian/biblical perspective, APPROVE it even without the word "Jesus"
2. **Inappropriate content** - Content that contains:
   - Explicit sexual content, nudity, or sexual themes
   - Violence, hate speech, or harmful content
   - Profanity or offensive language
   - Anti-Christian or blasphemous content
   - Illegal activities
   - Non-gospel content (secular music, non-Christian teachings, etc.)

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

      // Fallback: try to infer from text response
      const lowerResponse = aiResponse.toLowerCase();
      const isApproved = 
        lowerResponse.includes("approved") ||
        lowerResponse.includes("gospel") ||
        lowerResponse.includes("christian") ||
        lowerResponse.includes("appropriate");

      return {
        isApproved,
        confidence: 0.6,
        reason: "Parsed from text response",
        flags: [],
        requiresReview: !isApproved,
      };
    } catch (error) {
      logger.error("Error parsing moderation response:", error);
      return this.basicModeration(input);
    }
  }

  /**
   * Basic moderation using keyword checks (fallback)
   */
  private basicModeration(input: ModerationInput): ModerationResult {
    const inappropriateKeywords = [
      "explicit",
      "nude",
      "sex",
      "porn",
      "violence",
      "kill",
      "hate",
      "fuck",
      "shit",
      "damn",
      "blasphemy",
      "blaspheme",
    ];

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

    // Check for inappropriate content
    const hasInappropriate = inappropriateKeywords.some(keyword =>
      textToCheck.includes(keyword)
    );

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


