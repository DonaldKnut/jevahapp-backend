import { Media } from "../../../models/media.model";
import logger from "../../../utils/logger";
import { PUBLIC_MEDIA_FILTER } from "../../../lib/publicMediaVisibility";
import { enrichMediaPlaybackFields } from "../playbackFields";
import { buildAggregationPipeline } from "./aggregationPipeline";

export async function getAllContentForAllTab(options?: {
  page?: number;
  limit?: number;
  contentType?: string;
  category?: string;
  minViews?: number;
  minLikes?: number;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sort?: string;
  order?: "asc" | "desc";
}) {
  try {
    // Always enforce pagination for mobile-friendly payloads (prevents excessive data usage)
    // Default: page 1, limit 50 (mobile-optimized to save data/airtime)
    const page = options?.page && options.page > 0 ? options.page : 1;
    const rawLimit = options?.limit && options.limit > 0 ? options.limit : 50;

    // Clamp for mobile-friendly payloads (min 10, max 100)
    const limit = Math.min(Math.max(rawLimit, 10), 100);
    const skip = (page - 1) * limit;

    // Global feed: same public visibility rules as like/view/metadata.
    // (Previously omitted publicationState → staged/draft items could appear then 404 on like.)
    const matchQuery: Record<string, any> = {
      ...PUBLIC_MEDIA_FILTER,
    };

    // Content type filter
    if (options?.contentType && options.contentType !== "ALL") {
      matchQuery.contentType = options.contentType;
    }

    // Category filter
    if (options?.category) {
      matchQuery.category = { $regex: options.category, $options: "i" };
    }

    // View count filter
    if (options?.minViews !== undefined) {
      matchQuery.viewCount = { $gte: options.minViews };
    }

    // Like count filter
    if (options?.minLikes !== undefined) {
      matchQuery.likeCount = { $gte: options.minLikes };
    }

    // Date range filter
    if (options?.dateFrom || options?.dateTo) {
      matchQuery.createdAt = {};
      if (options.dateFrom) {
        matchQuery.createdAt.$gte = new Date(options.dateFrom);
      }
      if (options.dateTo) {
        matchQuery.createdAt.$lte = new Date(options.dateTo);
      }
    }

    // Text search filter
    const searchText = options?.search?.trim();

    // Add text search to match query if provided
    if (searchText) {
      if (matchQuery.$or) {
        // If there's already an $or, combine with $and
        matchQuery.$and = [
          { ...matchQuery },
          {
            $or: [
              { title: { $regex: searchText, $options: "i" } },
              { description: { $regex: searchText, $options: "i" } },
            ],
          },
        ];
        // Remove original fields that are now in $and
        const { $or, ...rest } = matchQuery;
        matchQuery.$and[0] = rest;
      } else {
        matchQuery.$or = [
          { title: { $regex: searchText, $options: "i" } },
          { description: { $regex: searchText, $options: "i" } },
        ];
      }
    }

    // Sort on native Media fields BEFORE $lookup (page first, then join author)
    const sortField = options?.sort || "createdAt";
    const sortOrder = options?.order === "asc" ? 1 : -1;
    const sortObj: Record<string, 1 | -1> = {};
    if (sortField === "views" || sortField === "viewCount") {
      sortObj.viewCount = sortOrder;
    } else if (sortField === "likes" || sortField === "likeCount") {
      sortObj.likeCount = sortOrder;
    } else {
      sortObj.createdAt = sortOrder;
    }
    // Stable cursor tie-break
    if (!sortObj._id) sortObj._id = sortOrder;

    const pipeline = buildAggregationPipeline(matchQuery, {
      sort: sortObj,
      skip,
      limit,
      pageBeforeLookup: true,
    });

    // Avoid exact countDocuments on every page when possible — cache-friendly estimate for deep pages
    const countPromise =
      page === 1
        ? Media.countDocuments(matchQuery)
        : Media.countDocuments(matchQuery).maxTimeMS(2000).catch(() => -1);

    const [mediaList, totalRaw] = await Promise.all([
      Media.aggregate(pipeline),
      countPromise,
    ]);
    const total = typeof totalRaw === "number" && totalRaw >= 0 ? totalRaw : skip + mediaList.length;
    const totalPages = totalRaw >= 0 ? Math.ceil(total / limit) : undefined;

    const nextCursor =
      mediaList.length > 0
        ? Buffer.from(
            JSON.stringify({
              createdAt: mediaList[mediaList.length - 1].createdAt,
              _id: mediaList[mediaList.length - 1]._id,
            })
          ).toString("base64url")
        : undefined;

    return {
      media: mediaList.map((row: any) => enrichMediaPlaybackFields(row)),
      total,
      pagination: {
        page,
        limit,
        total,
        totalPages: totalPages ?? Math.ceil(total / limit),
        hasNextPage:
          totalRaw >= 0
            ? page < Math.ceil(total / limit)
            : mediaList.length === limit,
        hasPreviousPage: page > 1,
        nextCursor,
      },
    };
  } catch (error: any) {
    // Log the actual MongoDB error so it's visible in server logs
    // without leaking details to the API response.
    logger.error("Error fetching all content", {
      error: error?.message,
      stack: error?.stack,
      options,
    });
    throw new Error(`Failed to retrieve all content: ${error?.message}`);
  }
}
