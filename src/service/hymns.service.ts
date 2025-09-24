import { Hymn, IHymn } from "../models/hymn.model";
import logger from "../utils/logger";

export interface HymnarySearchOptions {
  reference?: string;
  book?: string;
  fromChapter?: number;
  fromVerse?: number;
  toChapter?: number;
  toVerse?: number;
  all?: boolean;
}

export interface HymnSearchOptions {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  sortBy?:
    | "title"
    | "author"
    | "year"
    | "viewCount"
    | "likeCount"
    | "createdAt";
  sortOrder?: "asc" | "desc";
  source?: string;
  tags?: string[];
}

export class HymnsService {
  private static readonly HYMNARY_BASE_URL =
    "https://hymnary.org/api/scripture";
  private static readonly REQUEST_TIMEOUT = 10000; // 10 seconds

  /**
   * Fetch hymns from Hymnary.org Scripture API
   */
  static async fetchHymnsFromHymnary(
    options: HymnarySearchOptions = {}
  ): Promise<any[]> {
    try {
      const params = new URLSearchParams();

      // Add parameters based on search type
      if (options.reference) {
        params.append("reference", options.reference);
      } else if (options.book) {
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
      logger.info(`Fetching hymns from Hymnary.org: ${url}`);

      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.REQUEST_TIMEOUT
      );

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "JevahApp/1.0 (Gospel Media Platform)",
          Accept: "application/json",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `Hymnary API error: ${response.status} ${response.statusText}`
        );
      }

      const hymns = await response.json();
      logger.info(`Fetched ${hymns.length} hymns from Hymnary.org`);

      // Transform Hymnary.org data to our format
      return hymns.map(this.transformHymnaryData);
    } catch (error: any) {
      if (error.name === "AbortError") {
        logger.warn("Hymnary API request timed out");
      } else {
        logger.warn("Hymnary API unavailable:", error.message);
      }
      return this.getFallbackHymns();
    }
  }

  /**
   * Transform Hymnary.org API data to our internal format
   */
  private static transformHymnaryData(hymnaryData: any): any {
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
  private static extractAuthor(data: any): string {
    if (data.roles) {
      const authorRole = data.roles.find(
        (role: any) => role.role && role.role.toLowerCase().includes("author")
      );
      if (authorRole) return authorRole.name;
    }
    return "Unknown Author";
  }

  /**
   * Extract composer from Hymnary.org data
   */
  private static extractComposer(data: any): string {
    if (data.roles) {
      const composerRole = data.roles.find(
        (role: any) => role.role && role.role.toLowerCase().includes("composer")
      );
      if (composerRole) return composerRole.name;
    }
    return "";
  }

  /**
   * Extract year from date string
   */
  private static extractYear(dateStr: string): number | null {
    if (!dateStr) return null;
    const yearMatch = dateStr.match(/\d{4}/);
    return yearMatch ? parseInt(yearMatch[0]) : null;
  }

  /**
   * Determine category based on hymn data
   */
  private static determineCategory(data: any): string {
    const title = (data.title || "").toLowerCase();
    const scripture = (data["scripture references"] || [])
      .join(" ")
      .toLowerCase();

    if (title.includes("praise") || title.includes("glory")) return "praise";
    if (title.includes("worship") || title.includes("adore")) return "worship";
    if (title.includes("christmas") || title.includes("nativity"))
      return "christmas";
    if (title.includes("easter") || title.includes("resurrection"))
      return "easter";
    if (scripture.includes("psalm")) return "traditional";
    if (data.date && parseInt(data.date) < 1900) return "traditional";

    return "traditional"; // Default category
  }

  /**
   * Generate tags from hymn data
   */
  private static generateTags(data: any): string[] {
    const tags: string[] = [];

    if (data.meter) tags.push("metered");
    if (data["place of origin"])
      tags.push(data["place of origin"].toLowerCase());
    if (
      data["scripture references"] &&
      data["scripture references"].length > 0
    ) {
      tags.push("scripture-based");
    }

    return tags;
  }

  /**
   * Generate external ID from hymn data
   */
  private static generateExternalId(data: any): string {
    const title = (data.title || "").toLowerCase().replace(/[^a-z0-9]/g, "-");
    const year = this.extractYear(data.date) || "unknown";
    return `${title}-${year}`;
  }

  /**
   * Extract roles from Hymnary.org data
   */
  private static extractRoles(data: any): any[] {
    return data.roles || [];
  }

  /**
   * Sync popular hymns from Hymnary.org with popular Scripture references
   */
  static async syncPopularHymns(): Promise<{ synced: number; errors: number }> {
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
        const hymns = await this.fetchHymnsFromHymnary({
          reference: scripture,
        });

        for (const hymnData of hymns) {
          await this.upsertHymn(hymnData, "hymnary");
          synced++;
        }

        logger.info(`Synced ${hymns.length} hymns for ${scripture}`);

        // Add delay between requests to be respectful to the API
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        logger.error(`Failed to sync hymns for ${scripture}:`, error);
        errors++;
      }
    }

    return { synced, errors };
  }

  /**
   * Upsert hymn to database
   */
  private static async upsertHymn(
    hymnData: any,
    source: string
  ): Promise<IHymn> {
    const filter = {
      source: source as any,
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
      source: source as any,
      externalId: hymnData.externalId,
      isActive: true,
      hymnaryData: hymnData.hymnaryData,
    };

    return await Hymn.findOneAndUpdate(filter, update, {
      upsert: true,
      new: true,
    });
  }

  /**
   * Get hymns with pagination and filtering
   */
  static async getHymns(options: HymnSearchOptions = {}): Promise<{
    hymns: IHymn[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const {
      page = 1,
      limit = 20,
      category,
      search,
      sortBy = "title",
      sortOrder = "asc",
      source,
      tags,
    } = options;

    const query: any = { isActive: true };

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
    const sort: any = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    const skip = (page - 1) * limit;

    const [hymnsLean, total] = await Promise.all([
      Hymn.find(query).sort(sort).skip(skip).limit(limit).lean(),
      Hymn.countDocuments(query),
    ]);

    const hymns = hymnsLean as unknown as IHymn[];

    return {
      hymns,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get hymn by ID
   */
  static async getHymnById(id: string): Promise<IHymn | null> {
    return await Hymn.findById(id);
  }

  /**
   * Increment view count
   */
  static async incrementViewCount(id: string): Promise<void> {
    await Hymn.findByIdAndUpdate(id, { $inc: { viewCount: 1 } });
  }

  /**
   * Update interaction counts
   */
  static async updateInteractionCounts(
    id: string,
    updates: {
      likeCount?: number;
      commentCount?: number;
      shareCount?: number;
      bookmarkCount?: number;
    }
  ): Promise<void> {
    const updateFields: any = {};
    if (updates.likeCount !== undefined)
      updateFields.likeCount = updates.likeCount;
    if (updates.commentCount !== undefined)
      updateFields.commentCount = updates.commentCount;
    if (updates.shareCount !== undefined)
      updateFields.shareCount = updates.shareCount;
    if (updates.bookmarkCount !== undefined)
      updateFields.bookmarkCount = updates.bookmarkCount;

    await Hymn.findByIdAndUpdate(id, updateFields);
  }

  /**
   * Get hymn statistics
   */
  static async getHymnStats(): Promise<{
    totalHymns: number;
    hymnsByCategory: Record<string, number>;
    hymnsBySource: Record<string, number>;
    topHymns: Array<{ title: string; viewCount: number; likeCount: number }>;
  }> {
    const [totalHymns, categoryStats, sourceStats, topHymns] =
      await Promise.all([
        Hymn.countDocuments({ isActive: true }),
        Hymn.aggregate([
          { $match: { isActive: true } },
          { $group: { _id: "$category", count: { $sum: 1 } } },
        ]),
        Hymn.aggregate([
          { $match: { isActive: true } },
          { $group: { _id: "$source", count: { $sum: 1 } } },
        ]),
        Hymn.find({ isActive: true })
          .sort({ viewCount: -1, likeCount: -1 })
          .limit(10)
          .select("title viewCount likeCount")
          .lean(),
      ]);

    const hymnsByCategory = categoryStats.reduce((acc: any, item: any) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    const hymnsBySource = sourceStats.reduce((acc: any, item: any) => {
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
  }

  /**
   * Fallback hymns data for development/testing
   */
  private static getFallbackHymns(): any[] {
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
