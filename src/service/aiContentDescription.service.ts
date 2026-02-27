import { GoogleGenerativeAI } from "@google/generative-ai";
import logger from "../utils/logger";

export interface MediaContent {
  _id: string;
  title: string;
  description?: string;
  contentType: string;
  category?: string;
  topics?: string[];
  authorInfo?: {
    _id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    section?: string;
    avatar?: string;
  };
  // Optional multimodal content for enhanced analysis
  videoFrames?: string[]; // Base64 encoded video frames
  thumbnail?: string; // Base64 encoded thumbnail image
  transcript?: string; // Transcribed audio/video content
}

export interface AIDescriptionResponse {
  success: boolean;
  description?: string;
  bibleVerses?: string[];
  enhancedDescription?: string;
  error?: string;
}

export class AIContentDescriptionService {
  private genAI: GoogleGenerativeAI | null;
  private model: any;

  constructor() {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      logger.warn(
        "GOOGLE_AI_API_KEY not found. AI content description will use fallback descriptions."
      );
      this.genAI = null;
      this.model = null;
    } else {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    }
  }

  /**
   * Generate AI-powered description for media content
   * Supports multimodal analysis with video frames and thumbnail images
   */
  async generateContentDescription(
    media: MediaContent
  ): Promise<AIDescriptionResponse> {
    try {
      // If no AI model available, return fallback description
      if (!this.model) {
        return {
          success: true,
          description: this.generateFallbackDescription(media),
          bibleVerses: this.generateFallbackBibleVerses(media),
          enhancedDescription: this.generateFallbackDescription(media),
        };
      }

      const prompt = this.buildEnhancedDescriptionPrompt(media);

      // Prepare content parts for multimodal analysis
      const parts: any[] = [{ text: prompt }];

      // Add thumbnail image if available (cover photo)
      if (media.thumbnail) {
        try {
          // Remove data URL prefix if present
          const base64Data = media.thumbnail.replace(/^data:image\/\w+;base64,/, "");
          parts.push({
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Data,
            },
          });
          logger.info("Added thumbnail image to multimodal analysis");
        } catch (error) {
          logger.warn("Failed to process thumbnail image:", error);
        }
      }

      // Add video frames if available (for video content analysis)
      if (media.videoFrames && media.videoFrames.length > 0) {
        // Limit to 3 frames for efficiency
        media.videoFrames.slice(0, 3).forEach((frame, index) => {
          try {
            // Remove data URL prefix if present
            const base64Data = frame.replace(/^data:image\/\w+;base64,/, "");
            parts.push({
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Data,
              },
            });
            logger.info(`Added video frame ${index + 1} to multimodal analysis`);
          } catch (error) {
            logger.warn(`Failed to process video frame ${index + 1}:`, error);
          }
        });
      }

      // Generate content with multimodal analysis
      const result = await this.model.generateContent({
        contents: [{ role: "user", parts }],
      });
      const response = await result.response;
      const aiResponse = response.text();

      // Parse the AI response to extract description and Bible verses
      const parsedResponse = this.parseAIResponse(aiResponse, media);

      return {
        success: true,
        description: parsedResponse.description,
        bibleVerses: parsedResponse.bibleVerses,
        enhancedDescription: parsedResponse.enhancedDescription,
      };
    } catch (error: any) {
      logger.error("Error generating AI description:", error);
      return {
        success: false,
        description: this.generateFallbackDescription(media),
        bibleVerses: this.generateFallbackBibleVerses(media),
        enhancedDescription: this.generateFallbackDescription(media),
        error: error.message,
      };
    }
  }

  /**
   * Generate descriptions for multiple media items
   */
  async generateMultipleDescriptions(
    mediaItems: MediaContent[]
  ): Promise<MediaContent[]> {
    const enhancedMedia = await Promise.all(
      mediaItems.map(async media => {
        try {
          // Always generate AI content for all media items
          const aiResponse = await this.generateContentDescription(media);
          if (aiResponse.success) {
            return {
              ...media,
              description: aiResponse.description || media.description,
              bibleVerses: aiResponse.bibleVerses || [],
              enhancedDescription:
                aiResponse.enhancedDescription || media.description,
            };
          }
        } catch (error) {
          logger.error(
            `Error generating description for media ${media._id}:`,
            error
          );
        }

        // Return with fallback description if AI fails
        return {
          ...media,
          description:
            media.description || this.generateFallbackDescription(media),
          bibleVerses: this.generateFallbackBibleVerses(media),
          enhancedDescription:
            media.description || this.generateFallbackDescription(media),
        };
      })
    );

    return enhancedMedia;
  }

  /**
   * Build the enhanced AI prompt for generating descriptions and Bible verses
   * Enhanced to include multimodal content analysis
   */
  private buildEnhancedDescriptionPrompt(media: MediaContent): string {
    const authorName = media.authorInfo?.fullName || "Unknown Author";
    const category = media.category || "general";
    const topics =
      media.topics && media.topics.length > 0
        ? media.topics.join(", ")
        : "spiritual content";

    // Build context about available multimodal content
    let multimodalContext = "";
    if (media.thumbnail) {
      multimodalContext += "\n- A thumbnail/cover image is provided. Analyze the visual content, colors, symbols, text, and imagery to understand the theme and mood.\n";
    }
    if (media.videoFrames && media.videoFrames.length > 0) {
      multimodalContext += `- ${media.videoFrames.length} video frame(s) are provided. Analyze the visual content, scenes, people, settings, and activities shown in the frames to understand what the video contains.\n`;
    }
    if (media.transcript) {
      multimodalContext += `- A transcript of the audio/video content is provided. Use this to understand the actual spoken content, topics discussed, and key messages.\n`;
      // Include first 500 chars of transcript for context
      const transcriptPreview = media.transcript.substring(0, 500);
      multimodalContext += `\nTranscript preview: "${transcriptPreview}${media.transcript.length > 500 ? '...' : ''}"\n`;
    }

    // Add randomization to avoid robotic responses
    const randomElements = [
      "with divine wisdom",
      "through God's grace",
      "inspired by the Holy Spirit",
      "with biblical insight",
      "through faith and prayer",
      "with spiritual guidance",
      "through God's love",
      "inspired by scripture",
    ];

    const randomElement =
      randomElements[Math.floor(Math.random() * randomElements.length)];

    return `You are an expert Christian Content Curator. Your goal is to write unique, high-quality, and deeply insightful descriptions. 

**CRITICAL INSTRUCTION**: 
${multimodalContext ? "Analyze the provided VISUALS (frames/thumbnail) and TRANSCRIPT. Do NOT rely solely on the title. Describe specifically what is happening, what is being discussed, and the unique spiritual value of THIS specific content. Avoid generic phrases like 'uplifting video' or 'inspiring message' unless the content truly warrants it." : "Generate a deeply insightful description based on the title and metadata provided. Focus on spiritual impact and specific biblical themes."}

**Format Required (Strictly follow this labels):**
DESCRIPTION: [A concise, powerful description (2-3 sentences, max 180 chars) that captures the heart of the message.]
BIBLE_VERSES: [Provide exactly 2-3 relevant Bible references, e.g., 'John 3:16, Romans 8:28'.]
ENHANCED_DESCRIPTION: [A more profound, visually descriptive summary (3-4 sentences, max 250 chars) that highlights the spiritual depth ${randomElement}.]

**Tone & Perspective:**
- Be specific, not vague.
- Use the provided transcript to pull out key quotes or specific topics.
- Tailor the language to the content type: ${media.contentType}.
- Avoid being robotic. Make it feel human and curated.`;
  }

  /**
   * Generate fallback description when AI is not available
   */
  private generateFallbackDescription(media: MediaContent): string {
    const authorName = media.authorInfo?.fullName || "Unknown Author";
    const category = media.category || "spiritual";
    const contentType = media.contentType || "content";

    const fallbackDescriptions = {
      videos: `An inspiring ${category} video by ${authorName} that will uplift your spirit and strengthen your faith.`,
      audio: `A powerful ${category} message by ${authorName} that will encourage and inspire your spiritual journey.`,
      music: `Beautiful worship music by ${authorName} that will help you connect with God through praise and worship.`,
      books: `An insightful ${category} book by ${authorName} that will deepen your understanding of God's word.`,
      ebook: `A valuable ${category} resource by ${authorName} that will enhance your spiritual growth and biblical knowledge.`,
      teachings: `Essential ${category} teachings by ${authorName} that will strengthen your faith and biblical understanding.`,
      worship: `A moving worship experience by ${authorName} that will help you draw closer to God through praise.`,
      inspiration: `An uplifting ${category} message by ${authorName} that will encourage and motivate your spiritual walk.`,
    };

    return (
      fallbackDescriptions[contentType as keyof typeof fallbackDescriptions] ||
      fallbackDescriptions[category as keyof typeof fallbackDescriptions] ||
      `Spiritual ${contentType} by ${authorName} that will bless and encourage your faith journey.`
    );
  }

  /**
   * Parse AI response to extract description, Bible verses, and enhanced description
   */
  private parseAIResponse(
    aiResponse: string,
    media: MediaContent
  ): {
    description: string;
    bibleVerses: string[];
    enhancedDescription: string;
  } {
    try {
      // More robust parsing: handle Markdown formatting, bolding, and varying whitespace
      const getSection = (label: string, nextLabels: string[]) => {
        const pattern = new RegExp(
          `\\*\\*?${label}:?\\*\\*?\\s*([\\s\\S]+?)(?=\\*\\*?(?:${nextLabels.join("|")}):?|$)`,
          "i"
        );
        const match = aiResponse.match(pattern);
        return match ? match[1].trim() : null;
      };

      const description = getSection("DESCRIPTION", ["BIBLE_VERSES", "ENHANCED_DESCRIPTION"])
        || this.generateFallbackDescription(media);

      const versesText = getSection("BIBLE_VERSES", ["ENHANCED_DESCRIPTION"]) || "";
      const bibleVerses = this.extractBibleVerses(versesText);

      const enhancedDescription = getSection("ENHANCED_DESCRIPTION", [])
        || this.generateFallbackDescription(media);

      return {
        description: this.cleanDescription(description),
        bibleVerses,
        enhancedDescription: this.cleanDescription(enhancedDescription),
      };
    } catch (error) {
      logger.error("Error parsing AI response:", error);
      return {
        description: this.generateFallbackDescription(media),
        bibleVerses: this.generateFallbackBibleVerses(media),
        enhancedDescription: this.generateFallbackDescription(media),
      };
    }
  }

  /**
   * Extract Bible verses from text
   */
  private extractBibleVerses(text: string): string[] {
    const versePattern = /\b[A-Za-z]+\s+\d+:\d+(?:-\d+)?(?:,\s*\d+)?/g;
    const matches = text.match(versePattern) || [];
    return matches.slice(0, 3); // Limit to 3 verses
  }

  /**
   * Generate fallback Bible verses
   */
  private generateFallbackBibleVerses(media: MediaContent): string[] {
    const category = media.category || "general";
    const contentType = media.contentType || "content";

    const fallbackVerses = {
      worship: ["Psalm 100:1-2", "Psalm 95:1", "Ephesians 5:19"],
      teachings: ["2 Timothy 3:16", "Proverbs 1:7", "Matthew 28:19"],
      inspiration: ["Jeremiah 29:11", "Romans 8:28", "Philippians 4:13"],
      faith: ["Hebrews 11:1", "Mark 9:23", "2 Corinthians 5:7"],
      prayer: ["Matthew 6:9-13", "1 Thessalonians 5:17", "James 5:16"],
      videos: ["Romans 10:17", "Proverbs 4:20-22", "Psalm 119:105"],
      audio: ["Romans 10:14", "Isaiah 55:11", "Psalm 19:14"],
      music: ["Psalm 98:1", "Colossians 3:16", "Psalm 150:1-6"],
      books: ["2 Timothy 3:16", "Psalm 119:105", "Proverbs 2:6"],
      ebook: ["2 Timothy 3:16", "Psalm 119:105", "Proverbs 2:6"],
      sermon: ["Romans 10:17", "2 Timothy 4:2", "Acts 2:42"],
    };

    return (
      fallbackVerses[category as keyof typeof fallbackVerses] ||
      fallbackVerses[contentType as keyof typeof fallbackVerses] || [
        "John 3:16",
        "Psalm 23:1",
        "Romans 8:28",
      ]
    );
  }

  /**
   * Clean and format the AI-generated description
   */
  private cleanDescription(description: string): string {
    return description
      .trim()
      .replace(/^["']|["']$/g, "") // Remove surrounding quotes
      .replace(/\n+/g, " ") // Replace newlines with spaces
      .replace(/\s+/g, " ") // Replace multiple spaces with single space
      .substring(0, 250) // Limit to 250 characters
      .trim();
  }

  /**
   * Check if AI service is available
   */
  isAvailable(): boolean {
    return this.genAI !== null && this.model !== null;
  }

  /**
   * Public method to generate fallback description
   */
  getFallbackDescription(media: MediaContent): string {
    return this.generateFallbackDescription(media);
  }

  /**
   * Public method to generate fallback Bible verses
   */
  getFallbackBibleVerses(media: MediaContent): string[] {
    return this.generateFallbackBibleVerses(media);
  }
}

// Export singleton instance
export const aiContentDescriptionService = new AIContentDescriptionService();
