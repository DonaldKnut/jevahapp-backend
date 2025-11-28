"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.contentModerationService = exports.ContentModerationService = void 0;
const generative_ai_1 = require("@google/generative-ai");
const logger_1 = __importDefault(require("../utils/logger"));
class ContentModerationService {
    constructor() {
        const apiKey = process.env.GOOGLE_AI_API_KEY;
        if (!apiKey) {
            logger_1.default.warn("GOOGLE_AI_API_KEY not found. Content moderation will use basic checks only.");
            this.genAI = null;
            this.model = null;
        }
        else {
            this.genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
            // Use gemini-1.5-pro for better multimodal analysis
            this.model = this.genAI.getGenerativeModel({
                model: "gemini-1.5-flash", // Using flash for faster processing, can switch to pro for better accuracy
            });
        }
    }
    /**
     * Moderate content using AI classification
     */
    moderateContent(input) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // If no AI model available, use basic keyword checks
                if (!this.model) {
                    return this.basicModeration(input);
                }
                // Build the prompt for Gemini
                const prompt = this.buildModerationPrompt(input);
                // Prepare content parts for multimodal analysis
                const parts = [{ text: prompt }];
                // Add video frames if available (for video content)
                if (input.videoFrames && input.videoFrames.length > 0) {
                    // Gemini can process multiple images
                    input.videoFrames.slice(0, 3).forEach((frame, index) => {
                        parts.push({
                            inlineData: {
                                mimeType: "image/jpeg",
                                data: frame.replace(/^data:image\/\w+;base64,/, ""), // Remove data URL prefix if present
                            },
                        });
                    });
                }
                // Generate content with Gemini
                const result = yield this.model.generateContent({
                    contents: [{ role: "user", parts }],
                });
                const response = yield result.response;
                const aiResponse = response.text();
                // Parse the AI response
                return this.parseModerationResponse(aiResponse, input);
            }
            catch (error) {
                logger_1.default.error("Error in content moderation:", error);
                // On error, use basic moderation as fallback
                return this.basicModeration(input);
            }
        });
    }
    /**
     * Build the moderation prompt for Gemini
     */
    buildModerationPrompt(input) {
        const hasTranscript = !!input.transcript;
        const hasFrames = input.videoFrames && input.videoFrames.length > 0;
        const transcriptText = hasTranscript && input.transcript
            ? `- Transcript: "${input.transcript.substring(0, 1000)}${input.transcript.length > 1000 ? "..." : ""}"`
            : "";
        const framesText = hasFrames && input.videoFrames
            ? `- Video Frames: ${input.videoFrames.length} frames provided for visual analysis`
            : "";
        return `You are a content moderation system for a Christian gospel media platform called Jevah. Your task is to determine if uploaded content is appropriate for a gospel/Christian platform.

**Content Information:**
- Title: "${input.title || "N/A"}"
- Description: "${input.description || "N/A"}"
- Content Type: ${input.contentType}
${transcriptText}
${framesText}

**Your Task:**
Analyze this content and determine if it is:
1. **Gospel-inclined/Christian content** - Content that aligns with Christian values, biblical teachings, worship, prayer, spiritual growth, or Christian community
   - This includes gospel music and videos in ANY language (English, Yoruba, Hausa, Igbo, or any other language)
   - Gospel songs without preaching are still valid gospel content
   - Worship songs, praise songs, and hymns in any language are acceptable
   - Contemporary gospel, traditional gospel, and gospel in local languages are all acceptable
2. **Inappropriate content** - Content that contains:
   - Explicit sexual content, nudity, or sexual themes
   - Violence, hate speech, or harmful content
   - Profanity or offensive language
   - Anti-Christian or blasphemous content
   - Illegal activities
   - Non-gospel content (secular music, non-Christian teachings, etc.)

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
- If content is clearly gospel/Christian-related: isApproved = true, confidence > 0.8
- If content is clearly inappropriate: isApproved = false, confidence > 0.8
- If uncertain or borderline: requiresReview = true, confidence < 0.8
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
- Reject content that promotes values contrary to Christianity, regardless of language
- When in doubt, set requiresReview = true
- Remember: A gospel song in Yoruba, Hausa, or Igbo is just as valid as one in English

Now analyze the content and provide your response in the exact JSON format above.`;
    }
    /**
     * Parse the AI moderation response
     */
    parseModerationResponse(aiResponse, input) {
        try {
            // Try to extract JSON from the response
            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    isApproved: parsed.isApproved === true,
                    confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
                    reason: parsed.reason || "AI analysis completed",
                    flags: Array.isArray(parsed.flags) ? parsed.flags : [],
                    requiresReview: parsed.requiresReview === true,
                };
            }
            // Fallback: try to infer from text response
            const lowerResponse = aiResponse.toLowerCase();
            const isApproved = lowerResponse.includes("approved") ||
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
        }
        catch (error) {
            logger_1.default.error("Error parsing moderation response:", error);
            return this.basicModeration(input);
        }
    }
    /**
     * Basic moderation using keyword checks (fallback)
     */
    basicModeration(input) {
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
            // English keywords
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
        const hasInappropriate = inappropriateKeywords.some(keyword => textToCheck.includes(keyword));
        // Check for gospel content
        const hasGospel = gospelKeywords.some(keyword => textToCheck.includes(keyword));
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
    isAvailable() {
        return this.genAI !== null && this.model !== null;
    }
}
exports.ContentModerationService = ContentModerationService;
// Export singleton instance
exports.contentModerationService = new ContentModerationService();
