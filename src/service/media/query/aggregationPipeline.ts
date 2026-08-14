export function buildAggregationPipeline(
  matchStage: Record<string, any>,
  options?: {
    sort?: Record<string, 1 | -1>;
    sampleSize?: number;
    limit?: number;
    skip?: number;
    pageBeforeLookup?: boolean;
  }
) {
  const pipeline: any[] = [];
  if (matchStage && Object.keys(matchStage).length > 0) {
    pipeline.push({ $match: matchStage });
  }

  if (options?.pageBeforeLookup) {
    if (options?.sort) {
      pipeline.push({ $sort: options.sort });
    }
    if (options?.skip && options.skip > 0) {
      pipeline.push({ $skip: options.skip });
    }
    if (options?.limit && options.limit > 0) {
      pipeline.push({ $limit: options.limit });
    }
  }

  // Only lookup user info (needed for author details)
  // REMOVED: Expensive lookups on mediauseractions and mediainteractions
  // Instead, use pre-calculated fields: likeCount, viewCount, shareCount
  pipeline.push(
    {
      $lookup: {
        from: "users",
        let: { uploaderId: "$uploadedBy" },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$uploaderId"] } } },
          {
            $project: {
              firstName: 1,
              lastName: 1,
              avatar: 1,
              avatarUpload: 1,
            },
          },
        ],
        as: "author",
      },
    },
    // preserveNullAndEmptyArrays: true ensures media whose uploader was deleted
    // still appears in the feed (with empty authorInfo) instead of being silently dropped.
    { $unwind: { path: "$author", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        // Use pre-calculated fields directly (already stored in Media document)
        // This is MUCH faster than doing $lookup and $filter on related collections
        totalLikes: { $ifNull: ["$likeCount", 0] },
        totalShares: { $ifNull: ["$shareCount", 0] },
        totalViews: { $ifNull: ["$viewCount", 0] },
        totalSaves: { $ifNull: ["$bookmarkCount", 0] },
        authorInfo: {
          $cond: {
            if: { $ifNull: ["$author._id", false] },
            then: {
              _id: "$author._id",
              id: "$author._id",
              firstName: { $ifNull: ["$author.firstName", ""] },
              lastName: { $ifNull: ["$author.lastName", ""] },
              fullName: {
                $trim: {
                  input: {
                    $concat: [
                      { $ifNull: ["$author.firstName", ""] },
                      " ",
                      { $ifNull: ["$author.lastName", ""] },
                    ],
                  },
                },
              },
              name: {
                $trim: {
                  input: {
                    $concat: [
                      { $ifNull: ["$author.firstName", ""] },
                      " ",
                      { $ifNull: ["$author.lastName", ""] },
                    ],
                  },
                },
              },
              avatar: {
                $ifNull: ["$author.avatar", { $ifNull: ["$author.avatarUpload", null] }],
              },
              avatarUrl: {
                $ifNull: ["$author.avatar", { $ifNull: ["$author.avatarUpload", null] }],
              },
              avatarUpload: {
                $ifNull: ["$author.avatarUpload", { $ifNull: ["$author.avatar", null] }],
              },
              section: { $ifNull: ["$author.section", null] },
            },
            else: {
              _id: "$uploadedBy",
              id: "$uploadedBy",
              firstName: "",
              lastName: "",
              fullName: "Unknown",
              name: "Unknown",
              avatar: null,
              avatarUrl: null,
              avatarUpload: null,
              section: null,
            },
          },
        },
        formattedCreatedAt: {
          $dateToString: {
            format: "%Y-%m-%dT%H:%M:%S.%LZ",
            // $ifNull guards against documents missing the createdAt field,
            // which would otherwise crash the entire aggregation pipeline.
            date: { $ifNull: ["$createdAt", "$$NOW"] },
          },
        },
        thumbnail: "$thumbnailUrl",
        // ⭐ Critical: Compute video URL with fallbacks (fileUrl > playbackUrl > hlsUrl)
        // This ensures videos always have a playable URL, especially for live streams
        videoUrl: {
          $cond: {
            if: { $ne: ["$fileUrl", null] },
            then: "$fileUrl",
            else: {
              $cond: {
                if: { $ne: ["$playbackUrl", null] },
                then: "$playbackUrl",
                else: "$hlsUrl",
              },
            },
          },
        },
        // Scrubber: coalesce duration; normalize processingStatus for mobile
        duration: {
          $let: {
            vars: {
              d: {
                $ifNull: ["$duration", "$processingMetadata.durationSeconds"],
              },
            },
            in: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$$d", null] },
                    { $gt: ["$$d", 0] },
                  ],
                },
                "$$d",
                null,
              ],
            },
          },
        },
        processingStatus: {
          $switch: {
            branches: [
              {
                case: {
                  $in: [
                    { $toLower: { $ifNull: ["$processing.status", ""] } },
                    ["ready", "completed"],
                  ],
                },
                then: "ready",
              },
              {
                case: {
                  $in: [
                    { $toLower: { $ifNull: ["$processing.status", ""] } },
                    ["failed", "rejected"],
                  ],
                },
                then: "failed",
              },
              {
                case: {
                  $in: [
                    { $toLower: { $ifNull: ["$processing.status", ""] } },
                    ["pending", "uploaded", "queued", "idle"],
                  ],
                },
                then: "pending",
              },
              {
                case: {
                  $in: [
                    { $toLower: { $ifNull: ["$processing.status", ""] } },
                    [
                      "processing",
                      "transcoding",
                      "moderating",
                      "awaiting_review",
                      "publishing",
                    ],
                  ],
                },
                then: "processing",
              },
            ],
            default: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$moderationStatus", "approved"] },
                    {
                      $or: [
                        { $ne: ["$fileUrl", null] },
                        { $ne: ["$playbackUrl", null] },
                        { $ne: ["$hlsUrl", null] },
                      ],
                    },
                  ],
                },
                "ready",
                "processing",
              ],
            },
          },
        },
      },
    },
    {
      $project: {
        _id: 1,
        id: "$_id", // Alias for _id (frontend may expect this)
        title: 1,
        description: 1,
        contentType: 1,
        category: 1,
        // ⭐ MEDIA URLS (Priority: fileUrl > playbackUrl > hlsUrl)
        fileUrl: 1, // PRIMARY - Always required for playback
        playbackUrl: 1, // OPTIONAL - Lower quality fallback
        hlsUrl: 1, // OPTIONAL - HLS stream URL (for long videos)
        // ⭐ THUMBNAILS (Never used for playback - separate from media URLs)
        thumbnailUrl: 1, // REQUIRED - Thumbnail/preview image
        imageUrl: "$coverImageUrl", // OPTIONAL - High-res cover art (aliased from coverImageUrl)
        // ⭐ METADATA
        topics: 1,
        duration: 1,
        processingStatus: 1,
        fileSize: 1,
        width: 1, // Video width (videos only)
        height: 1, // Video height (videos only)
        bitrate: 1, // Bitrate in bps
        // ⭐ AUTHOR INFO — populated object (never a bare ObjectId)
        authorInfo: 1,
        author: "$authorInfo",
        uploadedBy: "$authorInfo",
        // ⭐ ENGAGEMENT METRICS
        totalLikes: 1,
        totalShares: 1,
        totalViews: 1,
        likeCount: 1, // Keep for backward compatibility
        shareCount: 1, // Keep for backward compatibility
        viewCount: 1, // Keep for backward compatibility
        commentCount: 1,
        bookmarkCount: 1,
        totalSaves: 1,
        // ⭐ TIMESTAMPS
        createdAt: 1,
        formattedCreatedAt: 1,
        updatedAt: 1,
        thumbnail: 1, // Backward compatibility alias
        videoUrl: 1, // ⭐ Computed field with proper priority (fileUrl > playbackUrl > hlsUrl)
      },
    }
  );

  if (!options?.pageBeforeLookup) {
    if (options?.sort) {
      pipeline.push({ $sort: options.sort });
    }
    if (options?.sampleSize && options.sampleSize > 0) {
      pipeline.push({ $sample: { size: options.sampleSize } });
    }
    if (options?.limit && options.limit > 0) {
      pipeline.push({ $limit: options.limit });
    }
  }

  return pipeline;
}
