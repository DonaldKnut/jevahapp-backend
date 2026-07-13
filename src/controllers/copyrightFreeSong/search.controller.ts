import { Request, Response } from "express";
import { CopyrightFreeSongService } from "../../service/copyrightFreeSong.service";
import { CopyrightFreeSong } from "../../models/copyrightFreeSong.model";
import likeService from "../../modules/engagement/like/like.service";
import logger from "../../utils/logger";
import { interactionService, songService } from "./shared";

/**
 * Search copyright-free songs
 * GET /api/audio/copyright-free/search
 *
 * Supports multi-field search, category filtering, sorting, and pagination
 * Returns user-specific data (isLiked, isInLibrary) if authenticated
 */
export const searchSongs = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();

  try {
    const { q, page, limit, category, sort } = req.query;
    const userId = req.userId;

    if (!q || typeof q !== "string" || !q.trim()) {
      res.status(400).json({
        success: false,
        error: "Search query is required",
        code: "BAD_REQUEST",
      });
      return;
    }

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;

    if (limitNum > 100) {
      res.status(400).json({
        success: false,
        error: "Invalid limit. Maximum is 100",
        code: "BAD_REQUEST",
      });
      return;
    }

    const validSorts = ["relevance", "popular", "newest", "oldest", "title"];
    const sortOption = (sort as string) || "relevance";
    if (!validSorts.includes(sortOption)) {
      res.status(400).json({
        success: false,
        error: `Invalid sort option. Must be one of: ${validSorts.join(", ")}`,
        code: "BAD_REQUEST",
      });
      return;
    }

    const result = await songService.searchSongs(q.trim(), {
      page: pageNum,
      limit: limitNum,
      category: category as string | undefined,
      sort: sortOption as "relevance" | "popular" | "newest" | "oldest" | "title",
      userId: userId || undefined,
    });

    let enrichedSongs = result.songs;
    if (userId) {
      const songIds = result.songs.map((s: any) => s._id.toString());

      const [userLikes, userSaves] = await Promise.all([
        Promise.all(
          songIds.map((songId: string) =>
            likeService.hasUserLiked(userId, songId, "copyright_free_song")
          )
        ),
        Promise.all(
          songIds.map((songId: string) => interactionService.isSaved(userId, songId))
        ),
      ]);

      enrichedSongs = result.songs.map((song: any, index: number) => {
        const songObj = song as any;
        const viewCount = CopyrightFreeSongService.normalizedViewCount(songObj);
        const likeCount = songObj.likeCount ?? songObj.likes ?? 0;
        return {
          ...songObj,
          id: songObj._id?.toString() || songObj.id,
          viewCount,
          views: viewCount,
          likeCount,
          likes: likeCount,
          isLiked: userLikes[index] || false,
          isInLibrary: userSaves[index] || false,
          isPublicDomain: true,
          contentType: "copyright-free-music",
          audioUrl: songObj.fileUrl,
          artist: songObj.singer,
          uploadedBy: songObj.uploadedBy?._id?.toString() || "system",
        };
      });
    } else {
      enrichedSongs = result.songs.map((song: any) => {
        const songObj = song as any;
        const viewCount = CopyrightFreeSongService.normalizedViewCount(songObj);
        const likeCount = songObj.likeCount ?? songObj.likes ?? 0;
        return {
          ...songObj,
          id: songObj._id?.toString() || songObj.id,
          viewCount,
          views: viewCount,
          likeCount,
          likes: likeCount,
          isLiked: false,
          isInLibrary: false,
          isPublicDomain: true,
          contentType: "copyright-free-music",
          audioUrl: songObj.fileUrl,
          artist: songObj.singer,
          uploadedBy: songObj.uploadedBy?._id?.toString() || "system",
        };
      });
    }

    const searchTime = Date.now() - startTime;

    res.status(200).json({
      success: true,
      data: {
        songs: enrichedSongs,
        pagination: {
          page: result.page,
          limit: limitNum,
          total: result.total,
          totalPages: result.totalPages,
          hasMore: result.hasMore,
        },
        query: q.trim(),
        searchTime,
      },
    });
  } catch (error: any) {
    logger.error("Error searching songs:", error);

    if (error.message === "Search query is required") {
      res.status(400).json({
        success: false,
        error: "Search query is required",
        code: "BAD_REQUEST",
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: "Failed to perform search",
      code: "SERVER_ERROR",
    });
  }
};

/**
 * Get search suggestions (autocomplete)
 * GET /api/audio/copyright-free/search/suggestions
 */
export const getSearchSuggestions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q, limit } = req.query;
    const limitNum = Math.min(parseInt(limit as string) || 10, 20);

    if (!q || typeof q !== "string" || !q.trim()) {
      res.status(400).json({
        success: false,
        error: "Search query is required",
        code: "BAD_REQUEST",
      });
      return;
    }

    const searchTerm = q.trim().toLowerCase();
    const searchRegex = new RegExp(`^${searchTerm}`, "i");

    const [titleMatches, artistMatches] = await Promise.all([
      CopyrightFreeSong.find({
        title: { $regex: searchRegex, $options: "i" },
      })
        .select("title")
        .limit(50)
        .lean(),
      CopyrightFreeSong.find({
        singer: { $regex: searchRegex, $options: "i" },
      })
        .select("singer")
        .limit(50)
        .lean(),
    ]);

    const suggestions = new Set<string>();

    titleMatches.forEach((song: any) => {
      if (song.title) {
        suggestions.add(song.title.toLowerCase());
      }
    });

    artistMatches.forEach((song: any) => {
      if (song.singer) {
        suggestions.add(song.singer.toLowerCase());
      }
    });

    const suggestionsArray = Array.from(suggestions).slice(0, limitNum);

    res.status(200).json({
      success: true,
      data: {
        suggestions: suggestionsArray,
      },
    });
  } catch (error: any) {
    logger.error("Error getting search suggestions:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get search suggestions",
      code: "SERVER_ERROR",
    });
  }
};

/**
 * Get trending searches
 * GET /api/audio/copyright-free/search/trending
 */
export const getTrendingSearches = async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit } = req.query;
    const limitNum = Math.min(parseInt(limit as string) || 10, 20);

    const trendingSongs = await CopyrightFreeSong.find()
      .select("title singer viewCount")
      .sort({ viewCount: -1, createdAt: -1 })
      .limit(limitNum)
      .lean();

    const trending = trendingSongs.map((song: any) => ({
      query: song.title || song.singer,
      count: song.viewCount || 0,
      category: "Gospel Music",
    }));

    res.status(200).json({
      success: true,
      data: {
        trending,
      },
    });
  } catch (error: any) {
    logger.error("Error getting trending searches:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get trending searches",
      code: "SERVER_ERROR",
    });
  }
};

/**
 * Get categories for copyright-free songs
 * GET /api/audio/copyright-free/categories
 */
export const getCategories = async (req: Request, res: Response): Promise<void> => {
  const defaultCategories = [
    { name: "Gospel Music", count: 0 },
    { name: "Traditional Gospel", count: 0 },
    { name: "Contemporary Gospel", count: 0 },
    { name: "Worship", count: 0 },
    { name: "Praise", count: 0 },
    { name: "Hymns", count: 0 },
    { name: "Inspirational", count: 0 },
    { name: "Christian Rock", count: 0 },
    { name: "Gospel Choir", count: 0 },
    { name: "Spiritual", count: 0 },
  ];

  try {
    if (!CopyrightFreeSong || typeof CopyrightFreeSong.aggregate !== "function") {
      logger.warn("CopyrightFreeSong model not available, returning default categories");
      res.status(200).json({
        success: true,
        data: {
          categories: defaultCategories,
        },
      });
      return;
    }

    const categoryStats = await CopyrightFreeSong.aggregate([
      {
        $match: {
          category: {
            $exists: true,
            $nin: [null, ""],
          },
        },
      },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          name: "$_id",
          count: 1,
        },
      },
      {
        $sort: { name: 1 },
      },
    ]) as Array<{ name: string; count: number }>;

    const resultCategories = categoryStats.length > 0 ? categoryStats : defaultCategories;

    res.status(200).json({
      success: true,
      data: {
        categories: resultCategories,
      },
    });
  } catch (error: any) {
    logger.error("Error getting categories:", {
      error: error.message,
      stack: error.stack,
      name: error.name,
    });

    res.status(200).json({
      success: true,
      data: {
        categories: defaultCategories,
      },
      ...(process.env.NODE_ENV === "development" && {
        _debug: {
          error: error.message,
          fallback: "Using default categories",
        },
      }),
    });
  }
};
