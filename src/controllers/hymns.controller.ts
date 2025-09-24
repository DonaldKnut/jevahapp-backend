import { Request, Response } from "express";
import { HymnsService } from "../service/hymns.service";
import logger from "../utils/logger";

/**
 * Get hymns with pagination and filtering
 */
export const getHymns = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      search,
      sortBy = "title",
      sortOrder = "asc",
      source,
      tags,
    } = req.query;

    // Validate pagination parameters
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(
      100,
      Math.max(1, parseInt(limit as string) || 20)
    );

    // Validate sort parameters
    const validSortFields = [
      "title",
      "author",
      "year",
      "viewCount",
      "likeCount",
      "createdAt",
    ];
    const sortField = validSortFields.includes(sortBy as string)
      ? (sortBy as any)
      : "title";
    const sortDirection = sortOrder === "desc" ? "desc" : "asc";

    const result = await HymnsService.getHymns({
      page: pageNum,
      limit: limitNum,
      category: category as string,
      search: search as string,
      sortBy: sortField,
      sortOrder: sortDirection,
      source: source as string,
      tags: tags ? (tags as string).split(",") : undefined,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error("Get hymns error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get hymns",
    });
  }
};

/**
 * Get hymn by ID
 */
export const getHymnById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        message: "Hymn ID is required",
      });
      return;
    }

    const hymn = await HymnsService.getHymnById(id);

    if (!hymn) {
      res.status(404).json({
        success: false,
        message: "Hymn not found",
      });
      return;
    }

    // Increment view count
    await HymnsService.incrementViewCount(id);

    res.status(200).json({
      success: true,
      data: hymn,
    });
  } catch (error: any) {
    logger.error("Get hymn by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get hymn",
    });
  }
};

/**
 * Search hymns by Scripture reference using Hymnary.org API
 */
export const searchHymnsByScripture = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { reference, book, fromChapter, fromVerse, toChapter, toVerse, all } =
      req.query;

    // Validate that at least one search parameter is provided
    if (!reference && !book) {
      res.status(400).json({
        success: false,
        message: "Either reference or book parameter is required",
      });
      return;
    }

    let searchOptions: any = {};

    if (reference) {
      searchOptions.reference = reference as string;
    } else if (book) {
      searchOptions.book = book as string;
      if (fromChapter)
        searchOptions.fromChapter = parseInt(fromChapter as string);
      if (fromVerse) searchOptions.fromVerse = parseInt(fromVerse as string);
      if (toChapter) searchOptions.toChapter = parseInt(toChapter as string);
      if (toVerse) searchOptions.toVerse = parseInt(toVerse as string);
    }

    if (all === "true") {
      searchOptions.all = true;
    }

    const hymns = await HymnsService.fetchHymnsFromHymnary(searchOptions);

    res.status(200).json({
      success: true,
      data: {
        hymns,
        searchOptions,
        count: hymns.length,
      },
    });
  } catch (error: any) {
    logger.error("Search hymns by scripture error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to search hymns by scripture",
    });
  }
};

/**
 * Sync popular hymns from Hymnary.org
 */
export const syncPopularHymns = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const result = await HymnsService.syncPopularHymns();

    res.status(200).json({
      success: true,
      message: `Popular hymns sync completed. Synced: ${result.synced}, Errors: ${result.errors}`,
      data: result,
    });
  } catch (error: any) {
    logger.error("Sync popular hymns error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to sync popular hymns",
    });
  }
};

/**
 * Get hymn statistics
 */
export const getHymnStats = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const stats = await HymnsService.getHymnStats();

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    logger.error("Get hymn stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get hymn statistics",
    });
  }
};

/**
 * Update hymn interaction counts
 */
export const updateHymnInteractions = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { likeCount, commentCount, shareCount, bookmarkCount } = req.body;

    if (!id) {
      res.status(400).json({
        success: false,
        message: "Hymn ID is required",
      });
      return;
    }

    // Validate that at least one count is provided
    if (
      likeCount === undefined &&
      commentCount === undefined &&
      shareCount === undefined &&
      bookmarkCount === undefined
    ) {
      res.status(400).json({
        success: false,
        message: "At least one interaction count must be provided",
      });
      return;
    }

    await HymnsService.updateInteractionCounts(id, {
      likeCount,
      commentCount,
      shareCount,
      bookmarkCount,
    });

    res.status(200).json({
      success: true,
      message: "Hymn interactions updated successfully",
    });
  } catch (error: any) {
    logger.error("Update hymn interactions error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update hymn interactions",
    });
  }
};

/**
 * Get hymns by category
 */
export const getHymnsByCategory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { category } = req.params;
    const {
      page = 1,
      limit = 20,
      sortBy = "title",
      sortOrder = "asc",
    } = req.query;

    if (!category) {
      res.status(400).json({
        success: false,
        message: "Category is required",
      });
      return;
    }

    const validCategories = [
      "praise",
      "worship",
      "traditional",
      "contemporary",
      "gospel",
      "christmas",
      "easter",
    ];
    if (!validCategories.includes(category)) {
      res.status(400).json({
        success: false,
        message: "Invalid category",
      });
      return;
    }

    const result = await HymnsService.getHymns({
      page: parseInt(page as string) || 1,
      limit: parseInt(limit as string) || 20,
      category,
      sortBy: sortBy as any,
      sortOrder: sortOrder as any,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error("Get hymns by category error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get hymns by category",
    });
  }
};

/**
 * Search hymns by tags
 */
export const searchHymnsByTags = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { tags } = req.query;
    const {
      page = 1,
      limit = 20,
      sortBy = "title",
      sortOrder = "asc",
    } = req.query;

    if (!tags) {
      res.status(400).json({
        success: false,
        message: "Tags parameter is required",
      });
      return;
    }

    const tagArray = (tags as string)
      .split(",")
      .map(tag => tag.trim())
      .filter(tag => tag);

    if (tagArray.length === 0) {
      res.status(400).json({
        success: false,
        message: "At least one valid tag is required",
      });
      return;
    }

    const result = await HymnsService.getHymns({
      page: parseInt(page as string) || 1,
      limit: parseInt(limit as string) || 20,
      tags: tagArray,
      sortBy: sortBy as any,
      sortOrder: sortOrder as any,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error("Search hymns by tags error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to search hymns by tags",
    });
  }
};
