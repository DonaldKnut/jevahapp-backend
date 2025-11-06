import { GoogleGenerativeAI } from "@google/generative-ai";
import { BibleVerse, BibleBook } from "../models/bible.model";
import logger from "../utils/logger";

export interface AISearchResult {
  verse: any;
  relevanceScore: number;
  matchedTerms: string[];
  highlightedText: string;
  explanation?: string; // Why this verse matches
}

export interface AISearchResponse {
  success: boolean;
  results: AISearchResult[];
  queryInterpretation: string; // What the AI thinks the user is looking for
  suggestedVerses?: string[]; // AI-suggested specific verse references
  searchTerms: string[];
}

export class AIBibleSearchService {
  private genAI: GoogleGenerativeAI | null;
  private model: any;

  constructor() {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      logger.warn(
        "GOOGLE_AI_API_KEY not found. AI Bible search will use fallback search."
      );
      this.genAI = null;
      this.model = null;
    } else {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    }
  }

  /**
   * Advanced AI-powered Bible search
   * Understands natural language and finds relevant verses
   */
  async advancedSearch(query: string, options: {
    limit?: number;
    book?: string;
    testament?: "old" | "new";
  } = {}): Promise<AISearchResponse> {
    try {
      const { limit = 20, book, testament } = options;

      // Step 1: Use AI to interpret the query
      const queryAnalysis = await this.analyzeQuery(query);
      
      // Step 2: Extract search terms from AI analysis
      const searchTerms = this.extractSearchTerms(query, queryAnalysis);
      
      // Step 3: Perform search with multiple strategies
      let verses = await this.performMultiStrategySearch(searchTerms, {
        originalQuery: query,
        aiInterpretation: queryAnalysis,
        book,
        testament,
        limit,
      });

      // Step 4: Use AI to score and rank results
      const aiRankedResults = await this.rankVersesWithAI(
        verses,
        query,
        queryAnalysis,
        searchTerms
      );

      // Step 5: Get AI-suggested specific verses if query seems to reference one
      let suggestedVerses: string[] = [];
      if (queryAnalysis.isVerseReference) {
        suggestedVerses = await this.suggestVerseReferences(query);
      }

      return {
        success: true,
        results: aiRankedResults.slice(0, limit),
        queryInterpretation: queryAnalysis.interpretation,
        suggestedVerses,
        searchTerms,
      };
    } catch (error: any) {
      logger.error("AI Bible search error:", error);
      // Fallback to regular search
      return this.fallbackSearch(query, options);
    }
  }

  /**
   * Analyze user query to understand intent
   */
  private async analyzeQuery(query: string): Promise<{
    interpretation: string;
    mainTopics: string[];
    emotion?: string;
    isVerseReference: boolean;
    suggestedBooks?: string[];
  }> {
    if (!this.model) {
      return {
        interpretation: `Searching for "${query}"`,
        mainTopics: query.split(/\s+/),
        isVerseReference: false,
      };
    }

    try {
      const prompt = `Analyze this Bible search query: "${query}"

Respond with JSON only:
{
  "interpretation": "What the user is likely looking for",
  "mainTopics": ["topic1", "topic2"],
  "emotion": "emotion or feeling (if applicable)",
  "isVerseReference": false,
  "suggestedBooks": ["book names that might be relevant"]
}

Examples:
Query: "where is the verse about love"
Response: {"interpretation": "User is looking for verses about love", "mainTopics": ["love"], "isVerseReference": true, "suggestedBooks": ["John", "1 Corinthians", "1 John"]}

Query: "feeling lost and alone"
Response: {"interpretation": "User needs comfort and hope verses", "mainTopics": ["lost", "alone", "comfort"], "emotion": "sadness", "suggestedBooks": ["Psalm", "Isaiah", "Matthew"]}`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      logger.error("Query analysis error:", error);
    }

    return {
      interpretation: `Searching for "${query}"`,
      mainTopics: query.split(/\s+/).filter((word) => word.length > 2),
      isVerseReference: false,
    };
  }

  /**
   * Extract meaningful search terms from query
   */
  private extractSearchTerms(
    originalQuery: string,
    analysis: any
  ): string[] {
    const terms = new Set<string>();

    // Add main topics from AI analysis
    if (analysis.mainTopics) {
      analysis.mainTopics.forEach((topic: string) => {
        terms.add(topic.toLowerCase());
      });
    }

    // Add words from original query (filter out common words)
    const stopWords = new Set([
      "the",
      "a",
      "an",
      "is",
      "are",
      "was",
      "were",
      "where",
      "what",
      "when",
      "who",
      "how",
      "about",
      "verse",
      "verses",
      "bible",
      "chapter",
    ]);

    originalQuery
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word))
      .forEach((word) => terms.add(word));

    return Array.from(terms);
  }

  /**
   * Perform multi-strategy search
   */
  private async performMultiStrategySearch(
    searchTerms: string[],
    options: {
      originalQuery: string;
      aiInterpretation: any;
      book?: string;
      testament?: "old" | "new";
      limit: number;
    }
  ): Promise<any[]> {
    const allVerses = new Map<string, any>();

    // Strategy 1: Text search with all terms
    for (const term of searchTerms) {
      const searchQuery: any = {
        $text: { $search: term },
        isActive: true,
      };

      if (options.book) {
        searchQuery.bookName = { $regex: new RegExp(`^${options.book}$`, "i") };
      }

      const verses = await BibleVerse.find(searchQuery)
        .limit(50)
        .sort({ score: { $meta: "textScore" } })
        .lean();

      verses.forEach((verse) => {
        const key = `${verse.bookName}-${verse.chapterNumber}-${verse.verseNumber}`;
        if (!allVerses.has(key)) {
          allVerses.set(key, verse);
        }
      });
    }

    // Strategy 2: Exact phrase matching if query is a phrase
    if (options.originalQuery.split(/\s+/).length > 2) {
      const phraseQuery: any = {
        text: { $regex: new RegExp(options.originalQuery, "i") },
        isActive: true,
      };

      if (options.book) {
        phraseQuery.bookName = { $regex: new RegExp(`^${options.book}$`, "i") };
      }

      const phraseVerses = await BibleVerse.find(phraseQuery).limit(30).lean();
      phraseVerses.forEach((verse) => {
        const key = `${verse.bookName}-${verse.chapterNumber}-${verse.verseNumber}`;
        if (!allVerses.has(key)) {
          allVerses.set(key, verse);
        }
      });
    }

    return Array.from(allVerses.values());
  }

  /**
   * Use AI to rank verses by relevance
   */
  private async rankVersesWithAI(
    verses: any[],
    query: string,
    analysis: any,
    searchTerms: string[]
  ): Promise<AISearchResult[]> {
    const results: AISearchResult[] = [];

    for (const verse of verses.slice(0, 50)) {
      // Calculate text matching score
      const matchedTerms = searchTerms.filter((term) =>
        verse.text.toLowerCase().includes(term.toLowerCase())
      );

      // Calculate basic relevance score
      let relevanceScore = matchedTerms.length / searchTerms.length;

      // Boost score if multiple terms match
      if (matchedTerms.length === searchTerms.length) {
        relevanceScore = 1.0;
      }

      // Create highlighted text
      let highlightedText = verse.text;
      searchTerms.forEach((term) => {
        const regex = new RegExp(`(${term})`, "gi");
        highlightedText = highlightedText.replace(
          regex,
          "**$1**"
        );
      });

      // Use AI to get explanation if available
      let explanation: string | undefined;
      if (this.model && relevanceScore > 0.3) {
        try {
          explanation = await this.explainRelevance(verse, query, analysis);
        } catch (error) {
          // Silent fail for explanation
        }
      }

      results.push({
        verse,
        relevanceScore,
        matchedTerms,
        highlightedText,
        explanation,
      });
    }

    // Sort by relevance score
    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Get AI explanation for why a verse is relevant
   */
  private async explainRelevance(
    verse: any,
    query: string,
    analysis: any
  ): Promise<string> {
    if (!this.model) return "";

    try {
      const prompt = `Explain in one short sentence why this Bible verse is relevant to the search query "${query}".

Verse: "${verse.bookName} ${verse.chapterNumber}:${verse.verseNumber} - ${verse.text}"

Keep it under 15 words.`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      return "";
    }
  }

  /**
   * Suggest specific verse references based on query
   */
  private async suggestVerseReferences(query: string): Promise<string[]> {
    if (!this.model) return [];

    try {
      const prompt = `Based on this Bible search query: "${query}"

Suggest 3-5 specific Bible verse references that directly answer the question. Return only verse references in format like: "John 3:16", "Romans 8:28", etc.
Separate multiple verses with commas.`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Extract verse references
      const versePattern = /[A-Za-z0-9\s]+\s\d+:\d+/g;
      const matches = text.match(versePattern);
      return matches || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Fallback to regular search if AI fails
   */
  private async fallbackSearch(
    query: string,
    options: any
  ): Promise<AISearchResponse> {
    const searchTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 2);

    const searchQuery: any = {
      $text: { $search: query },
      isActive: true,
    };

    if (options.book) {
      searchQuery.bookName = { $regex: new RegExp(`^${options.book}$`, "i") };
    }

    const verses = await BibleVerse.find(searchQuery)
      .limit(options.limit || 20)
      .sort({ score: { $meta: "textScore" } })
      .lean();

    const results: AISearchResult[] = verses.map((verse) => {
      const matchedTerms = searchTerms.filter((term) =>
        verse.text.toLowerCase().includes(term.toLowerCase())
      );

      let highlightedText = verse.text;
      searchTerms.forEach((term) => {
        const regex = new RegExp(`(${term})`, "gi");
        highlightedText = highlightedText.replace(regex, "**$1**");
      });

      return {
        verse,
        relevanceScore: matchedTerms.length / searchTerms.length || 0.5,
        matchedTerms,
        highlightedText,
      };
    });

    return {
      success: true,
      results,
      queryInterpretation: `Searching for "${query}"`,
      searchTerms,
    };
  }
}

export default new AIBibleSearchService();











