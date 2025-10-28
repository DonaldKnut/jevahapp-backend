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
exports.AIBibleSearchService = void 0;
const generative_ai_1 = require("@google/generative-ai");
const bible_model_1 = require("../models/bible.model");
const logger_1 = __importDefault(require("../utils/logger"));
class AIBibleSearchService {
    constructor() {
        const apiKey = process.env.GOOGLE_AI_API_KEY;
        if (!apiKey) {
            logger_1.default.warn("GOOGLE_AI_API_KEY not found. AI Bible search will use fallback search.");
            this.genAI = null;
            this.model = null;
        }
        else {
            this.genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
            this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        }
    }
    /**
     * Advanced AI-powered Bible search
     * Understands natural language and finds relevant verses
     */
    advancedSearch(query_1) {
        return __awaiter(this, arguments, void 0, function* (query, options = {}) {
            try {
                const { limit = 20, book, testament } = options;
                // Step 1: Use AI to interpret the query
                const queryAnalysis = yield this.analyzeQuery(query);
                // Step 2: Extract search terms from AI analysis
                const searchTerms = this.extractSearchTerms(query, queryAnalysis);
                // Step 3: Perform search with multiple strategies
                let verses = yield this.performMultiStrategySearch(searchTerms, {
                    originalQuery: query,
                    aiInterpretation: queryAnalysis,
                    book,
                    testament,
                    limit,
                });
                // Step 4: Use AI to score and rank results
                const aiRankedResults = yield this.rankVersesWithAI(verses, query, queryAnalysis, searchTerms);
                // Step 5: Get AI-suggested specific verses if query seems to reference one
                let suggestedVerses = [];
                if (queryAnalysis.isVerseReference) {
                    suggestedVerses = yield this.suggestVerseReferences(query);
                }
                return {
                    success: true,
                    results: aiRankedResults.slice(0, limit),
                    queryInterpretation: queryAnalysis.interpretation,
                    suggestedVerses,
                    searchTerms,
                };
            }
            catch (error) {
                logger_1.default.error("AI Bible search error:", error);
                // Fallback to regular search
                return this.fallbackSearch(query, options);
            }
        });
    }
    /**
     * Analyze user query to understand intent
     */
    analyzeQuery(query) {
        return __awaiter(this, void 0, void 0, function* () {
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
                const result = yield this.model.generateContent(prompt);
                const response = yield result.response;
                const text = response.text();
                // Extract JSON from response
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    return JSON.parse(jsonMatch[0]);
                }
            }
            catch (error) {
                logger_1.default.error("Query analysis error:", error);
            }
            return {
                interpretation: `Searching for "${query}"`,
                mainTopics: query.split(/\s+/).filter((word) => word.length > 2),
                isVerseReference: false,
            };
        });
    }
    /**
     * Extract meaningful search terms from query
     */
    extractSearchTerms(originalQuery, analysis) {
        const terms = new Set();
        // Add main topics from AI analysis
        if (analysis.mainTopics) {
            analysis.mainTopics.forEach((topic) => {
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
    performMultiStrategySearch(searchTerms, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const allVerses = new Map();
            // Strategy 1: Text search with all terms
            for (const term of searchTerms) {
                const searchQuery = {
                    $text: { $search: term },
                    isActive: true,
                };
                if (options.book) {
                    searchQuery.bookName = { $regex: new RegExp(`^${options.book}$`, "i") };
                }
                const verses = yield bible_model_1.BibleVerse.find(searchQuery)
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
                const phraseQuery = {
                    text: { $regex: new RegExp(options.originalQuery, "i") },
                    isActive: true,
                };
                if (options.book) {
                    phraseQuery.bookName = { $regex: new RegExp(`^${options.book}$`, "i") };
                }
                const phraseVerses = yield bible_model_1.BibleVerse.find(phraseQuery).limit(30).lean();
                phraseVerses.forEach((verse) => {
                    const key = `${verse.bookName}-${verse.chapterNumber}-${verse.verseNumber}`;
                    if (!allVerses.has(key)) {
                        allVerses.set(key, verse);
                    }
                });
            }
            return Array.from(allVerses.values());
        });
    }
    /**
     * Use AI to rank verses by relevance
     */
    rankVersesWithAI(verses, query, analysis, searchTerms) {
        return __awaiter(this, void 0, void 0, function* () {
            const results = [];
            for (const verse of verses.slice(0, 50)) {
                // Calculate text matching score
                const matchedTerms = searchTerms.filter((term) => verse.text.toLowerCase().includes(term.toLowerCase()));
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
                    highlightedText = highlightedText.replace(regex, "**$1**");
                });
                // Use AI to get explanation if available
                let explanation;
                if (this.model && relevanceScore > 0.3) {
                    try {
                        explanation = yield this.explainRelevance(verse, query, analysis);
                    }
                    catch (error) {
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
        });
    }
    /**
     * Get AI explanation for why a verse is relevant
     */
    explainRelevance(verse, query, analysis) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.model)
                return "";
            try {
                const prompt = `Explain in one short sentence why this Bible verse is relevant to the search query "${query}".

Verse: "${verse.bookName} ${verse.chapterNumber}:${verse.verseNumber} - ${verse.text}"

Keep it under 15 words.`;
                const result = yield this.model.generateContent(prompt);
                const response = yield result.response;
                return response.text().trim();
            }
            catch (error) {
                return "";
            }
        });
    }
    /**
     * Suggest specific verse references based on query
     */
    suggestVerseReferences(query) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.model)
                return [];
            try {
                const prompt = `Based on this Bible search query: "${query}"

Suggest 3-5 specific Bible verse references that directly answer the question. Return only verse references in format like: "John 3:16", "Romans 8:28", etc.
Separate multiple verses with commas.`;
                const result = yield this.model.generateContent(prompt);
                const response = yield result.response;
                const text = response.text();
                // Extract verse references
                const versePattern = /[A-Za-z0-9\s]+\s\d+:\d+/g;
                const matches = text.match(versePattern);
                return matches || [];
            }
            catch (error) {
                return [];
            }
        });
    }
    /**
     * Fallback to regular search if AI fails
     */
    fallbackSearch(query, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const searchTerms = query
                .toLowerCase()
                .split(/\s+/)
                .filter((word) => word.length > 2);
            const searchQuery = {
                $text: { $search: query },
                isActive: true,
            };
            if (options.book) {
                searchQuery.bookName = { $regex: new RegExp(`^${options.book}$`, "i") };
            }
            const verses = yield bible_model_1.BibleVerse.find(searchQuery)
                .limit(options.limit || 20)
                .sort({ score: { $meta: "textScore" } })
                .lean();
            const results = verses.map((verse) => {
                const matchedTerms = searchTerms.filter((term) => verse.text.toLowerCase().includes(term.toLowerCase()));
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
        });
    }
}
exports.AIBibleSearchService = AIBibleSearchService;
exports.default = new AIBibleSearchService();
