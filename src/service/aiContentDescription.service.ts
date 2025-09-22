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

      const result = await this.model.generateContent(prompt);
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
   */
  private buildEnhancedDescriptionPrompt(media: MediaContent): string {
    const authorName = media.authorInfo?.fullName || "Unknown Author";
    const category = media.category || "general";
    const topics =
      media.topics && media.topics.length > 0
        ? media.topics.join(", ")
        : "spiritual content";

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

    return `You are an AI assistant helping to create engaging, varied descriptions for Christian media content. Generate content that feels natural and human-like.

**Content Details:**
- Title: "${media.title}"
- Type: ${media.contentType}
- Category: ${category}
- Topics: ${topics}
- Author: ${authorName}
- Current Description: "${media.description || "No existing description"}"

**Your Task:**
Generate TWO outputs in this exact format:

DESCRIPTION: [Write a fresh, engaging description that is different from any existing description. Make it 2-3 sentences, maximum 180 characters. Use varied language and avoid repetitive phrases. Make it feel natural and human-written.]

BIBLE_VERSES: [Provide exactly 2-3 relevant Bible verses (book chapter:verse format) that relate to this content. Examples: "John 3:16", "Psalm 23:1-3", "Romans 8:28". Only include the references, not the full text.]

ENHANCED_DESCRIPTION: [Create an alternative, more detailed description (3-4 sentences, maximum 250 characters) that provides deeper spiritual insight ${randomElement}.]

**Guidelines:**
- Vary your language and avoid repetitive phrases
- Make descriptions feel natural and conversational
- Include relevant biblical themes
- Focus on spiritual benefits and impact
- Use appropriate Christian terminology
- Be respectful and reverent in tone
- Make each description unique and engaging

**Content Type Focus:**
- Videos/Audio: Spiritual teachings, worship, inspiration, biblical insights
- Books/eBooks: Spiritual growth, biblical wisdom, practical Christian living
- Music: Worship, praise, spiritual encouragement, connection with God
- Teachings: Biblical insights, spiritual development, faith building

Generate content that feels authentic and varied, not robotic or templated.`;
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
      // Extract DESCRIPTION
      const descriptionMatch = aiResponse.match(
        /DESCRIPTION:\s*([\s\S]+?)(?=BIBLE_VERSES:|ENHANCED_DESCRIPTION:|$)/
      );
      const description = descriptionMatch
        ? this.cleanDescription(descriptionMatch[1])
        : this.generateFallbackDescription(media);

      // Extract BIBLE_VERSES
      const versesMatch = aiResponse.match(
        /BIBLE_VERSES:\s*([\s\S]+?)(?=ENHANCED_DESCRIPTION:|$)/
      );
      const versesText = versesMatch ? versesMatch[1] : "";
      const bibleVerses = this.extractBibleVerses(versesText);

      // Extract ENHANCED_DESCRIPTION
      const enhancedMatch = aiResponse.match(
        /ENHANCED_DESCRIPTION:\s*([\s\S]+?)$/
      );
      const enhancedDescription = enhancedMatch
        ? this.cleanDescription(enhancedMatch[1])
        : this.generateFallbackDescription(media);

      return {
        description,
        bibleVerses,
        enhancedDescription,
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
