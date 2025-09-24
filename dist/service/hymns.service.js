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
exports.HymnsService = void 0;
const hymn_model_1 = require("../models/hymn.model");
const logger_1 = __importDefault(require("../utils/logger"));
class HymnsService {
    /**
     * Fetch hymns from Hymnary.org Scripture API
     */
    static fetchHymnsFromHymnary() {
        return __awaiter(this, arguments, void 0, function* (options = {}) {
            try {
                const params = new URLSearchParams();
                // Add parameters based on search type
                if (options.reference) {
                    params.append("reference", options.reference);
                }
                else if (options.book) {
                    params.append("book", options.book);
                    if (options.fromChapter)
                        params.append("fromChapter", options.fromChapter.toString());
                    if (options.fromVerse)
                        params.append("fromVerse", options.fromVerse.toString());
                    if (options.toChapter)
                        params.append("toChapter", options.toChapter.toString());
                    if (options.toVerse)
                        params.append("toVerse", options.toVerse.toString());
                }
                if (options.all) {
                    params.append("all", "true");
                }
                const url = `${this.HYMNARY_BASE_URL}?${params.toString()}`;
                logger_1.default.info(`Fetching hymns from Hymnary.org: ${url}`);
                // Add timeout to prevent hanging requests
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);
                const response = yield fetch(url, {
                    signal: controller.signal,
                    headers: {
                        "User-Agent": "JevahApp/1.0 (Gospel Media Platform)",
                        Accept: "application/json",
                    },
                });
                clearTimeout(timeoutId);
                if (!response.ok) {
                    throw new Error(`Hymnary API error: ${response.status} ${response.statusText}`);
                }
                const hymns = yield response.json();
                logger_1.default.info(`Fetched ${hymns.length} hymns from Hymnary.org`);
                // Transform Hymnary.org data to our format
                return hymns.map(this.transformHymnaryData);
            }
            catch (error) {
                if (error.name === "AbortError") {
                    logger_1.default.warn("Hymnary API request timed out");
                }
                else {
                    logger_1.default.warn("Hymnary API unavailable:", error.message);
                }
                return this.getFallbackHymns();
            }
        });
    }
    /**
     * Transform Hymnary.org API data to our internal format
     */
    static transformHymnaryData(hymnaryData) {
        return {
            title: hymnaryData.title || "Untitled Hymn",
            author: this.extractAuthor(hymnaryData),
            composer: this.extractComposer(hymnaryData),
            year: this.extractYear(hymnaryData.date),
            category: this.determineCategory(hymnaryData),
            lyrics: [], // Hymnary.org doesn't provide lyrics in this API
            hymnNumber: hymnaryData["number of hymnals"] || null,
            meter: hymnaryData.meter || null,
            key: null, // Not provided by Hymnary.org
            scripture: hymnaryData["scripture references"] || [],
            tags: this.generateTags(hymnaryData),
            externalId: this.generateExternalId(hymnaryData),
            source: "hymnary",
            // Additional Hymnary.org specific fields
            hymnaryData: {
                textLink: hymnaryData["text link"],
                placeOfOrigin: hymnaryData["place of origin"],
                originalLanguage: hymnaryData["original language"],
                numberOfHymnals: hymnaryData["number of hymnals"],
                roles: this.extractRoles(hymnaryData),
            },
        };
    }
    /**
     * Extract author from Hymnary.org data
     */
    static extractAuthor(data) {
        if (data.roles) {
            const authorRole = data.roles.find((role) => role.role && role.role.toLowerCase().includes("author"));
            if (authorRole)
                return authorRole.name;
        }
        return "Unknown Author";
    }
    /**
     * Extract composer from Hymnary.org data
     */
    static extractComposer(data) {
        if (data.roles) {
            const composerRole = data.roles.find((role) => role.role && role.role.toLowerCase().includes("composer"));
            if (composerRole)
                return composerRole.name;
        }
        return "";
    }
    /**
     * Extract year from date string
     */
    static extractYear(dateStr) {
        if (!dateStr)
            return null;
        const yearMatch = dateStr.match(/\d{4}/);
        return yearMatch ? parseInt(yearMatch[0]) : null;
    }
    /**
     * Determine category based on hymn data
     */
    static determineCategory(data) {
        const title = (data.title || "").toLowerCase();
        const scripture = (data["scripture references"] || [])
            .join(" ")
            .toLowerCase();
        if (title.includes("praise") || title.includes("glory"))
            return "praise";
        if (title.includes("worship") || title.includes("adore"))
            return "worship";
        if (title.includes("christmas") || title.includes("nativity"))
            return "christmas";
        if (title.includes("easter") || title.includes("resurrection"))
            return "easter";
        if (scripture.includes("psalm"))
            return "traditional";
        if (data.date && parseInt(data.date) < 1900)
            return "traditional";
        return "traditional"; // Default category
    }
    /**
     * Generate tags from hymn data
     */
    static generateTags(data) {
        const tags = [];
        if (data.meter)
            tags.push("metered");
        if (data["place of origin"])
            tags.push(data["place of origin"].toLowerCase());
        if (data["scripture references"] &&
            data["scripture references"].length > 0) {
            tags.push("scripture-based");
        }
        return tags;
    }
    /**
     * Generate external ID from hymn data
     */
    static generateExternalId(data) {
        const title = (data.title || "").toLowerCase().replace(/[^a-z0-9]/g, "-");
        const year = this.extractYear(data.date) || "unknown";
        return `${title}-${year}`;
    }
    /**
     * Extract roles from Hymnary.org data
     */
    static extractRoles(data) {
        return data.roles || [];
    }
    /**
     * Sync popular hymns from Hymnary.org with popular Scripture references
     */
    static syncPopularHymns() {
        return __awaiter(this, void 0, void 0, function* () {
            const popularScriptures = [
                "John 3:16",
                "Psalm 23",
                "Romans 8:28",
                "Philippians 4:13",
                "Jeremiah 29:11",
                "Psalm 91",
                "Isaiah 40:31",
                "Matthew 28:19",
                "Ephesians 2:8-9",
                "Psalm 100",
            ];
            let synced = 0;
            let errors = 0;
            for (const scripture of popularScriptures) {
                try {
                    const hymns = yield this.fetchHymnsFromHymnary({
                        reference: scripture,
                    });
                    for (const hymnData of hymns) {
                        yield this.upsertHymn(hymnData, "hymnary");
                        synced++;
                    }
                    logger_1.default.info(`Synced ${hymns.length} hymns for ${scripture}`);
                    // Add delay between requests to be respectful to the API
                    yield new Promise(resolve => setTimeout(resolve, 1000));
                }
                catch (error) {
                    logger_1.default.error(`Failed to sync hymns for ${scripture}:`, error);
                    errors++;
                }
            }
            return { synced, errors };
        });
    }
    /**
     * Upsert hymn to database
     */
    static upsertHymn(hymnData, source) {
        return __awaiter(this, void 0, void 0, function* () {
            const filter = {
                source: source,
                externalId: hymnData.externalId,
            };
            const update = {
                title: hymnData.title,
                author: hymnData.author,
                composer: hymnData.composer,
                year: hymnData.year,
                category: hymnData.category,
                lyrics: hymnData.lyrics,
                hymnNumber: hymnData.hymnNumber,
                meter: hymnData.meter,
                key: hymnData.key,
                scripture: hymnData.scripture,
                tags: hymnData.tags,
                source: source,
                externalId: hymnData.externalId,
                isActive: true,
                hymnaryData: hymnData.hymnaryData,
            };
            return yield hymn_model_1.Hymn.findOneAndUpdate(filter, update, {
                upsert: true,
                new: true,
            });
        });
    }
    /**
     * Get hymns with pagination and filtering
     */
    static getHymns() {
        return __awaiter(this, arguments, void 0, function* (options = {}) {
            const { page = 1, limit = 20, category, search, sortBy = "title", sortOrder = "asc", source, tags, } = options;
            const query = { isActive: true };
            // Add category filter
            if (category) {
                query.category = category;
            }
            // Add source filter
            if (source) {
                query.source = source;
            }
            // Add tags filter
            if (tags && tags.length > 0) {
                query.tags = { $in: tags };
            }
            // Add search filter
            if (search) {
                query.$text = { $search: search };
            }
            // Build sort object
            const sort = {};
            sort[sortBy] = sortOrder === "asc" ? 1 : -1;
            const skip = (page - 1) * limit;
            const [hymnsLean, total] = yield Promise.all([
                hymn_model_1.Hymn.find(query).sort(sort).skip(skip).limit(limit).lean(),
                hymn_model_1.Hymn.countDocuments(query),
            ]);
            const hymns = hymnsLean;
            return {
                hymns,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            };
        });
    }
    /**
     * Get hymn by ID
     */
    static getHymnById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield hymn_model_1.Hymn.findById(id);
        });
    }
    /**
     * Increment view count
     */
    static incrementViewCount(id) {
        return __awaiter(this, void 0, void 0, function* () {
            yield hymn_model_1.Hymn.findByIdAndUpdate(id, { $inc: { viewCount: 1 } });
        });
    }
    /**
     * Update interaction counts
     */
    static updateInteractionCounts(id, updates) {
        return __awaiter(this, void 0, void 0, function* () {
            const updateFields = {};
            if (updates.likeCount !== undefined)
                updateFields.likeCount = updates.likeCount;
            if (updates.commentCount !== undefined)
                updateFields.commentCount = updates.commentCount;
            if (updates.shareCount !== undefined)
                updateFields.shareCount = updates.shareCount;
            if (updates.bookmarkCount !== undefined)
                updateFields.bookmarkCount = updates.bookmarkCount;
            yield hymn_model_1.Hymn.findByIdAndUpdate(id, updateFields);
        });
    }
    /**
     * Get hymn statistics
     */
    static getHymnStats() {
        return __awaiter(this, void 0, void 0, function* () {
            const [totalHymns, categoryStats, sourceStats, topHymns] = yield Promise.all([
                hymn_model_1.Hymn.countDocuments({ isActive: true }),
                hymn_model_1.Hymn.aggregate([
                    { $match: { isActive: true } },
                    { $group: { _id: "$category", count: { $sum: 1 } } },
                ]),
                hymn_model_1.Hymn.aggregate([
                    { $match: { isActive: true } },
                    { $group: { _id: "$source", count: { $sum: 1 } } },
                ]),
                hymn_model_1.Hymn.find({ isActive: true })
                    .sort({ viewCount: -1, likeCount: -1 })
                    .limit(10)
                    .select("title viewCount likeCount")
                    .lean(),
            ]);
            const hymnsByCategory = categoryStats.reduce((acc, item) => {
                acc[item._id] = item.count;
                return acc;
            }, {});
            const hymnsBySource = sourceStats.reduce((acc, item) => {
                acc[item._id] = item.count;
                return acc;
            }, {});
            return {
                totalHymns,
                hymnsByCategory,
                hymnsBySource,
                topHymns: topHymns.map(h => ({
                    title: h.title,
                    viewCount: h.viewCount,
                    likeCount: h.likeCount,
                })),
            };
        });
    }
    /**
     * Fallback hymns data for development/testing
     */
    static getFallbackHymns() {
        return [
            {
                title: "Amazing Grace",
                author: "John Newton",
                composer: "Traditional",
                year: 1779,
                category: "traditional",
                lyrics: [
                    "Amazing grace! How sweet the sound",
                    "That saved a wretch like me!",
                    "I once was lost, but now am found;",
                    "Was blind, but now I see.",
                ],
                hymnNumber: "1",
                meter: "8.6.8.6",
                key: "C Major",
                scripture: ["Ephesians 2:8-9"],
                tags: ["grace", "salvation", "traditional"],
                externalId: "amazing-grace-1779",
            },
            {
                title: "How Great Thou Art",
                author: "Carl Boberg",
                composer: "Stuart Hine",
                year: 1885,
                category: "praise",
                lyrics: [
                    "O Lord my God, when I in awesome wonder",
                    "Consider all the worlds Thy hands have made",
                    "I see the stars, I hear the rolling thunder",
                    "Thy power throughout the universe displayed",
                ],
                hymnNumber: "2",
                meter: "11.10.11.10",
                key: "G Major",
                scripture: ["Psalm 8:3-4"],
                tags: ["praise", "creation", "worship"],
                externalId: "how-great-thou-art-1885",
            },
        ];
    }
}
exports.HymnsService = HymnsService;
HymnsService.HYMNARY_BASE_URL = "https://hymnary.org/api/scripture";
HymnsService.REQUEST_TIMEOUT = 10000; // 10 seconds
