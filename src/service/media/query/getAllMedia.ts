import { Media } from "../../../models/media.model";
import { User } from "../../../models/user.model";
import { DurationRangeKey } from "../types";
import { buildMediaVisibilityQuery } from "./visibility";
import { enrichMediaPlaybackFields } from "../playbackFields";

export async function getAllMedia(filters: any = {}, options: { enforceModeration?: boolean; actingUserId?: string } = { enforceModeration: true }) {
  const query: any = {
    ...buildMediaVisibilityQuery(options),
  };

  if (filters.search) {
    query.title = { $regex: filters.search, $options: "i" };
  }

  if (filters.contentType) {
    query.contentType = filters.contentType;
  }

  if (filters.category) {
    query.category = { $regex: filters.category, $options: "i" };
  }

  if (filters.topics) {
    const topicsArray = Array.isArray(filters.topics)
      ? filters.topics
      : filters.topics.split(",");
    query.topics = {
      $in: topicsArray.map((topic: string) => new RegExp(topic, "i")),
    };
  }

  if (filters.creator) {
    const user = await User.findOne({ username: filters.creator });
    if (user) {
      query.uploadedBy = user._id;
    } else {
      query.uploadedBy = null;
    }
  }

  const durationRanges: Record<
    DurationRangeKey,
    { $lte?: number; $gte?: number; $gt?: number }
  > = {
    short: { $lte: 5 * 60 },
    medium: { $gte: 5 * 60, $lte: 15 * 60 },
    long: { $gt: 15 * 60 },
  };

  if (filters.duration) {
    const durationKey = filters.duration as DurationRangeKey;
    if (durationRanges[durationKey]) {
      query.duration = durationRanges[durationKey];
    }
  }

  if (filters.startDate || filters.endDate) {
    query.createdAt = {};
    if (filters.startDate) {
      query.createdAt.$gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      query.createdAt.$lte = new Date(filters.endDate);
    }
  }

  let sort = filters.sort || "-createdAt";
  if (filters.sort === "trending") {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    query.createdAt = { $gte: sevenDaysAgo };
    sort = "-viewCount -listenCount -readCount";
  }

  const page = parseInt(filters.page as string) || 1;
  const limit = parseInt(filters.limit as string) || 10;
  const skip = (page - 1) * limit;

  const mediaList = await Media.find(query)
    .select("title description contentType category fileUrl playbackUrl hlsUrl thumbnailUrl coverImageUrl uploadedBy createdAt viewCount likeCount shareCount duration fileSize width height bitrate topics processing processingMetadata")
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate("uploadedBy", "firstName lastName avatar")
    .lean();

  const total = await Media.countDocuments(query);

  // Transform to include imageUrl alias and ensure all required fields
  const transformedMedia = mediaList.map((media: any) =>
    enrichMediaPlaybackFields({
      ...media,
      id: media._id, // Alias for _id
      imageUrl: media.coverImageUrl, // Alias coverImageUrl to imageUrl
    })
  );

  return {
    media: transformedMedia,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}
