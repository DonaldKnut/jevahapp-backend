import { Types } from "mongoose";
import { Media, IMedia } from "../models/media.model";
import { CopyrightFreeSong, ICopyrightFreeSong } from "../models/copyrightFreeSong.model";
import { MediaInteraction } from "../models/mediaInteraction.model";
import { CopyrightFreeSongInteractionService } from "./copyrightFreeSongInteraction.service";
import { UnifiedBookmarkService } from "./unifiedBookmark.service";
import logger from "../utils/logger";

export interface UnifiedSearchOptions {
  page?: number;
  limit?: number;
  contentType?: string; // Filter by specific content type: "media", "copyright-free", "all"
  mediaType?: string; // Filter Media by contentType: "videos", "music", "audio", "ebook", etc.
  category?: string;
  sort?: "relevance" | "popular" | "newest" | "oldest" | "title";
  userId?: string;
}

export interface UnifiedSearchResult {
  results: UnifiedSearchItem[];
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
  breakdown: {
    media: number;
    copyrightFree: number;
  };
}

export interface UnifiedSearchItem {
  id: string;
  _id?: string;
  type: "media" | "copyright-free";
  contentType: string; // "videos", "music", "audio", "ebook", "copyright-free-music", etc.
  title: string;
  description?: string;
  artist?: string; // For copyright-free songs (singer)
  speaker?: string; // For media audio content
  category?: string;
  thumbnailUrl?: string;
  audioUrl?: string;
  fileUrl?: string;
  duration?: number;
  viewCount?: number;
  views?: number; // For compatibility
  likeCount?: number;
  likes?: number; // For compatibility
  listenCount?: number;
  readCount?: number;
  createdAt: Date;
  year?: number;
  isLiked?: boolean;
  isInLibrary?: boolean;
  isPublicDomain?: boolean;
  uploadedBy?: string | Types.ObjectId;
}

export class UnifiedSearchService {
  private interactionService: CopyrightFreeSongInteractionService;

  constructor() {
    this.interactionService = new CopyrightFreeSongInteractionService();
  }

  /**
   * Unified search across all content types
   */
  async search(
    query: string,
    options: UnifiedSearchOptions = {}
  ): Promise<UnifiedSearchResult> {
    const startTime = Date.now();
    const {
      page = 1,
      limit = 20,
      contentType = "all",
      mediaType,
      category,
      sort = "relevance",
      userId,
    } = options;

    const searchTerm = query.trim().toLowerCase();
    if (!searchTerm) {
      throw new Error("Search query is required");
    }

    const skip = (page - 1) * limit;
    const searchRegex = new RegExp(searchTerm, "i");

    // Build search queries for each content type
    const mediaQuery: any = {
      $or: [
        { title: searchRegex },
        { description: searchRegex },
        { speaker: searchRegex },
      ],
      isHidden: { $ne: true }, // Exclude hidden content
    };

    // Filter by media contentType if specified
    if (mediaType) {
      mediaQuery.contentType = mediaType;
    }

    // Filter by category if specified
    if (category) {
      mediaQuery.category = { $regex: category, $options: "i" };
    }

    const copyrightFreeQuery: any = {
      $or: [
        { title: searchRegex },
        { singer: searchRegex },
      ],
    };

    // Determine which content types to search
    const searchMedia = contentType === "all" || contentType === "media";
    const searchCopyrightFree = contentType === "all" || contentType === "copyright-free";

    // Build sort objects
    const mediaSort = this.buildSortObject(sort, "media");
    const copyrightFreeSort = this.buildSortObject(sort, "copyright-free");

    // Execute searches in parallel
    const searchPromises: Promise<any>[] = [];

    if (searchMedia) {
      searchPromises.push(
        Promise.all([
          Media.find(mediaQuery)
            .sort(mediaSort)
            .skip(skip)
            .limit(limit)
            .lean(),
          Media.countDocuments(mediaQuery),
        ])
      );
    } else {
      searchPromises.push(Promise.resolve([[], 0]));
    }

    if (searchCopyrightFree) {
      searchPromises.push(
        Promise.all([
          CopyrightFreeSong.find(copyrightFreeQuery)
            .populate("uploadedBy", "firstName lastName avatar")
            .sort(copyrightFreeSort)
            .skip(skip)
            .limit(limit)
            .lean(),
          CopyrightFreeSong.countDocuments(copyrightFreeQuery),
        ])
      );
    } else {
      searchPromises.push(Promise.resolve([[], 0]));
    }

    const [[mediaResults, mediaTotal], [copyrightFreeResults, copyrightFreeTotal]] =
      await Promise.all(searchPromises);

    // Combine and sort results
    const allResults = this.combineAndSortResults(
      mediaResults,
      copyrightFreeResults,
      searchTerm,
      sort,
      limit
    );

    // Enrich with user-specific data if authenticated
    let enrichedResults = allResults;
    if (userId) {
      enrichedResults = await this.enrichWithUserData(allResults, userId);
    } else {
      // Add default values for non-authenticated users
      enrichedResults = allResults.map((item) => ({
        ...item,
        isLiked: false,
        isInLibrary: false,
      }));
    }

    const total = mediaTotal + copyrightFreeTotal;
    const totalPages = Math.ceil(total / limit);
    const hasMore = skip + enrichedResults.length < total;

    const searchTime = Date.now() - startTime;
    logger.debug("Unified search completed", {
      query: searchTerm,
      total,
      mediaTotal,
      copyrightFreeTotal,
      resultsCount: enrichedResults.length,
      searchTime,
    });

    return {
      results: enrichedResults.slice(0, limit),
      total,
      page,
      totalPages,
      hasMore,
      breakdown: {
        media: mediaTotal,
        copyrightFree: copyrightFreeTotal,
      },
    };
  }

  /**
   * Build sort object based on sort option and content type
   */
  private buildSortObject(
    sort: string,
    contentType: "media" | "copyright-free"
  ): any {
    switch (sort) {
      case "relevance":
        // For relevance, prioritize by viewCount/listenCount/readCount
        if (contentType === "media") {
          return { viewCount: -1, listenCount: -1, readCount: -1, likeCount: -1, createdAt: -1 };
        }
        return { viewCount: -1, likeCount: -1, createdAt: -1 };
      case "popular":
        if (contentType === "media") {
          return { viewCount: -1, listenCount: -1, readCount: -1, likeCount: -1 };
        }
        return { viewCount: -1, likeCount: -1 };
      case "newest":
        return { createdAt: -1 };
      case "oldest":
        return { createdAt: 1 };
      case "title":
        return { title: 1 };
      default:
        return { createdAt: -1 };
    }
  }

  /**
   * Combine results from different sources and sort by relevance
   */
  private combineAndSortResults(
    mediaResults: any[],
    copyrightFreeResults: any[],
    searchTerm: string,
    sort: string,
    limit: number
  ): UnifiedSearchItem[] {
    const combined: UnifiedSearchItem[] = [];

    // Transform media results
    mediaResults.forEach((item: any) => {
      combined.push({
        id: item._id?.toString() || item.id,
        _id: item._id?.toString(),
        type: "media",
        contentType: item.contentType || "media",
        title: item.title,
        description: item.description,
        speaker: item.speaker,
        category: item.category,
        thumbnailUrl: item.thumbnailUrl,
        fileUrl: item.fileUrl,
        audioUrl: item.fileUrl, // For audio/music content
        duration: item.duration,
        viewCount: item.viewCount || 0,
        views: item.viewCount || 0,
        likeCount: item.likeCount || 0,
        likes: item.likeCount || 0,
        listenCount: item.listenCount || 0,
        readCount: item.readCount || 0,
        createdAt: item.createdAt,
        year: item.year,
        isPublicDomain: item.isPublicDomain || false,
        uploadedBy: item.uploadedBy,
      });
    });

    // Transform copyright-free song results
    copyrightFreeResults.forEach((item: any) => {
      combined.push({
        id: item._id?.toString() || item.id,
        _id: item._id?.toString(),
        type: "copyright-free",
        contentType: "copyright-free-music",
        title: item.title,
        artist: item.singer,
        thumbnailUrl: item.thumbnailUrl,
        audioUrl: item.fileUrl,
        fileUrl: item.fileUrl,
        duration: item.duration,
        viewCount: item.viewCount || 0,
        views: item.viewCount || 0,
        likeCount: item.likeCount || 0,
        likes: item.likeCount || 0,
        createdAt: item.createdAt,
        uploadedBy: item.uploadedBy?._id?.toString() || item.uploadedBy || "system",
        isPublicDomain: true,
      });
    });

    // Sort by relevance if needed
    if (sort === "relevance") {
      combined.sort((a, b) => {
        // Prioritize title matches
        const aTitleMatch = a.title.toLowerCase().includes(searchTerm) ? 1 : 0;
        const bTitleMatch = b.title.toLowerCase().includes(searchTerm) ? 1 : 0;
        if (aTitleMatch !== bTitleMatch) {
          return bTitleMatch - aTitleMatch;
        }

        // Then by popularity
        const aPopularity = (a.viewCount || 0) + (a.likeCount || 0);
        const bPopularity = (b.viewCount || 0) + (b.likeCount || 0);
        return bPopularity - aPopularity;
      });
    }

    return combined;
  }

  /**
   * Enrich results with user-specific data (isLiked, isInLibrary)
   */
  private async enrichWithUserData(
    results: UnifiedSearchItem[],
    userId: string
  ): Promise<UnifiedSearchItem[]> {
    const enriched = await Promise.all(
      results.map(async (item) => {
        let isLiked = false;
        let isInLibrary = false;

        try {
          if (item.type === "copyright-free") {
            // Check like status for copyright-free songs
            isLiked = await this.interactionService.isLiked(userId, item.id);
          } else {
            // For media, check if liked using MediaInteraction
            if (Types.ObjectId.isValid(item.id) && Types.ObjectId.isValid(userId)) {
              const mediaLike = await MediaInteraction.findOne({
                user: new Types.ObjectId(userId),
                media: new Types.ObjectId(item.id),
                interactionType: "like",
                isRemoved: { $ne: true },
              });
              isLiked = !!mediaLike;
            }
          }

          // Check bookmark status for all content types
          isInLibrary = await UnifiedBookmarkService.isBookmarked(userId, item.id);
        } catch (error: any) {
          logger.warn("Error enriching user data", {
            error: error?.message,
            userId,
            itemId: item.id,
          });
        }

        return {
          ...item,
          isLiked,
          isInLibrary,
        };
      })
    );

    return enriched;
  }

  /**
   * Get search suggestions across all content types
   */
  async getSuggestions(query: string, limit: number = 10): Promise<string[]> {
    const searchTerm = query.trim().toLowerCase();
    if (!searchTerm) {
      return [];
    }

    const searchRegex = new RegExp(`^${searchTerm}`, "i");
    const suggestions = new Set<string>();

    try {
      // Get suggestions from media titles and speakers
      const mediaResults = await Media.find({
        $or: [
          { title: searchRegex },
          { speaker: searchRegex },
        ],
        isHidden: { $ne: true },
      })
        .select("title speaker")
        .limit(limit * 2)
        .lean();

      mediaResults.forEach((item: any) => {
        if (item.title && item.title.toLowerCase().includes(searchTerm)) {
          suggestions.add(item.title.toLowerCase());
        }
        if (item.speaker && item.speaker.toLowerCase().includes(searchTerm)) {
          suggestions.add(item.speaker.toLowerCase());
        }
      });

      // Get suggestions from copyright-free songs
      const songResults = await CopyrightFreeSong.find({
        $or: [
          { title: searchRegex },
          { singer: searchRegex },
        ],
      })
        .select("title singer")
        .limit(limit * 2)
        .lean();

      songResults.forEach((item: any) => {
        if (item.title && item.title.toLowerCase().includes(searchTerm)) {
          suggestions.add(item.title.toLowerCase());
        }
        if (item.singer && item.singer.toLowerCase().includes(searchTerm)) {
          suggestions.add(item.singer.toLowerCase());
        }
      });
    } catch (error: any) {
      logger.error("Error getting search suggestions:", error);
    }

    return Array.from(suggestions).slice(0, limit);
  }

  /**
   * Get trending searches across all content types
   */
  async getTrending(limit: number = 10, period: string = "week"): Promise<
    Array<{
      query: string;
      count: number;
      category?: string;
    }>
  > {
    try {
      // Get most viewed media and songs as trending
      const [trendingMedia, trendingSongs] = await Promise.all([
        Media.find({ isHidden: { $ne: true } })
          .sort({ viewCount: -1, listenCount: -1, readCount: -1 })
          .limit(limit)
          .select("title viewCount category")
          .lean(),
        CopyrightFreeSong.find()
          .sort({ viewCount: -1 })
          .limit(limit)
          .select("title viewCount")
          .lean(),
      ]);

      const trending = [
        ...trendingMedia.map((item: any) => ({
          query: item.title,
          count: (item.viewCount || 0) + (item.listenCount || 0) + (item.readCount || 0),
          category: item.category || "Media",
        })),
        ...trendingSongs.map((item: any) => ({
          query: item.title,
          count: item.viewCount || 0,
          category: "Gospel Music",
        })),
      ]
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

      return trending;
    } catch (error: any) {
      logger.error("Error getting trending searches:", error);
      return [];
    }
  }
}

export default new UnifiedSearchService();
