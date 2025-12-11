import { Request, Response } from "express";
import unifiedSearchService from "../service/unifiedSearch.service";
import logger from "../utils/logger";

/**
 * Unified search across all content types
 * GET /api/search
 * 
 * Searches across:
 * - Media (videos, music, audio, ebook, etc.)
 * - Copyright-free songs
 * 
 * Supports filtering, sorting, and pagination
 */
export const unifiedSearch = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();

  try {
    const { q, page, limit, contentType, mediaType, category, sort } = req.query;
    const userId = req.userId;

    // Validate query parameter (required)
    if (!q || typeof q !== "string" || !q.trim()) {
      res.status(400).json({
        success: false,
        error: "Search query is required",
        code: "BAD_REQUEST",
      });
      return;
    }

    // Parse and validate pagination parameters
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;

    // Validate limit (max 100)
    if (limitNum > 100) {
      res.status(400).json({
        success: false,
        error: "Invalid limit. Maximum is 100",
        code: "BAD_REQUEST",
      });
      return;
    }

    // Validate sort option
    const validSorts = ["relevance", "popular", "newest", "oldest", "title"];
    const sortOption = (sort as string) || "relevance";
    if (sort && !validSorts.includes(sortOption)) {
      res.status(400).json({
        success: false,
        error: `Invalid sort option. Must be one of: ${validSorts.join(", ")}`,
        code: "BAD_REQUEST",
      });
      return;
    }

    // Validate contentType filter
    const validContentTypes = ["all", "media", "copyright-free"];
    const contentTypeFilter = (contentType as string) || "all";
    if (contentType && !validContentTypes.includes(contentTypeFilter)) {
      res.status(400).json({
        success: false,
        error: `Invalid contentType. Must be one of: ${validContentTypes.join(", ")}`,
        code: "BAD_REQUEST",
      });
      return;
    }

    // Perform unified search
    const result = await unifiedSearchService.search(q.trim(), {
      page: pageNum,
      limit: limitNum,
      contentType: contentTypeFilter as "all" | "media" | "copyright-free",
      mediaType: mediaType as string | undefined,
      category: category as string | undefined,
      sort: sortOption as "relevance" | "popular" | "newest" | "oldest" | "title",
      userId: userId || undefined,
    });

    const searchTime = Date.now() - startTime;

    // Return success response
    res.status(200).json({
      success: true,
      data: {
        results: result.results,
        pagination: {
          page: result.page,
          limit: limitNum,
          total: result.total,
          totalPages: result.totalPages,
          hasMore: result.hasMore,
        },
        breakdown: result.breakdown,
        query: q.trim(),
        searchTime,
      },
    });
  } catch (error: any) {
    logger.error("Error in unified search:", error);

    // Handle validation errors
    if (error.message === "Search query is required") {
      res.status(400).json({
        success: false,
        error: "Search query is required",
        code: "BAD_REQUEST",
      });
      return;
    }

    // Generic server error
    res.status(500).json({
      success: false,
      error: "Failed to perform search",
      code: "SERVER_ERROR",
    });
  }
};

/**
 * Get search suggestions across all content types
 * GET /api/search/suggestions
 */
export const getUnifiedSearchSuggestions = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { q, limit } = req.query;
    const limitNum = parseInt(limit as string) || 10;

    // Validate query parameter
    if (!q || typeof q !== "string" || !q.trim()) {
      res.status(400).json({
        success: false,
        error: "Search query is required",
        code: "BAD_REQUEST",
      });
      return;
    }

    const suggestions = await unifiedSearchService.getSuggestions(q.trim(), limitNum);

    res.status(200).json({
      success: true,
      data: {
        suggestions,
      },
    });
  } catch (error: any) {
    logger.error("Error getting unified search suggestions:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get search suggestions",
      code: "SERVER_ERROR",
    });
  }
};

/**
 * Get trending searches across all content types
 * GET /api/search/trending
 */
export const getUnifiedTrendingSearches = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { limit, period } = req.query;
    const limitNum = parseInt(limit as string) || 10;
    const periodOption = (period as string) || "week";

    const trending = await unifiedSearchService.getTrending(limitNum, periodOption);

    res.status(200).json({
      success: true,
      data: {
        trending,
      },
    });
  } catch (error: any) {
    logger.error("Error getting unified trending searches:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get trending searches",
      code: "SERVER_ERROR",
    });
  }
};

