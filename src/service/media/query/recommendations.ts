import { Media } from "../../../models/media.model";
import { UserViewedMedia } from "../../../models/userViewedMedia.model";
import { Types } from "mongoose";
import enhancedMediaService from "../../enhancedMedia.service";
import { recommendationEngineService } from "../../recommendationEngine.service";
import logger from "../../../utils/logger";
import { LeanUserViewedMedia } from "../types";
import { PUBLIC_MEDIA_FILTER } from "../../../lib/publicMediaVisibility";
import { buildAggregationPipeline } from "./aggregationPipeline";

export async function getRecommendationsForAllContent(
  userId?: string,
  options?: { limitPerSection?: number; mood?: string }
): Promise<{
  sections: {
    key: string;
    title: string;
    media: any[];
    reason?: string;
    metadata?: {
      abTestVariant?: string;
      qualityScore?: number;
      collaborativeScore?: number;
    };
  }[];
}> {
  const limitPerSection = options?.limitPerSection || 12;

  // Track media already seen by the user to de-duplicate recommendations
  const seenMediaIds = new Set<string>();
  let lastViewedMedia: any | null = null;
  let userProfile: any = null;

  if (userId && Types.ObjectId.isValid(userId)) {
    try {
      // Build comprehensive user profile with all signals
      userProfile =
        await recommendationEngineService.buildUserProfile(userId);

      // Get recently viewed for "because you watched" section
      const viewed = (await UserViewedMedia.findOne({
        user: new Types.ObjectId(userId),
      })
        .populate({
          path: "viewedMedia.media",
          select:
            "title topics category contentType uploadedBy createdAt thumbnailUrl fileUrl",
          populate: {
            path: "uploadedBy",
            select: "firstName lastName avatar",
          },
        })
        .lean()) as unknown as LeanUserViewedMedia | null;

      const viewedList = viewed?.viewedMedia || [];
      if (viewedList.length > 0) {
        lastViewedMedia = viewedList[viewedList.length - 1]?.media || null;
      }

      // Add all user's media to seen set
      [
        ...userProfile.viewedMedia,
        ...userProfile.favoriteMedia,
        ...userProfile.sharedMedia,
        ...userProfile.bookmarkedMedia,
      ].forEach(m => seenMediaIds.add(m.mediaId));
    } catch (err: any) {
      logger.warn("Personalization bootstrap failed", {
        error: err?.message,
        userId,
      });
    }
  }

  // Helper to exclude seen ids
  const excludeSeen = (match: Record<string, any> = {}) => {
    if (seenMediaIds.size > 0) {
      return {
        ...match,
        _id: {
          $nin: Array.from(seenMediaIds).map(id => new Types.ObjectId(id)),
        },
      };
    }
    return match;
  };

  // Get A/B test variant for section ordering
  const abTestVariant = userId
    ? recommendationEngineService.generateABTestVariant(userId)
    : "control";
  const sectionOrdering =
    recommendationEngineService.getSectionOrdering(userId);

  const sections: {
    key: string;
    title: string;
    media: any[];
    reason?: string;
    metadata?: {
      abTestVariant?: string;
      qualityScore?: number;
      collaborativeScore?: number;
    };
  }[] = [];

  // 1) Editorial picks (ensure seeded default content shows)
  try {
    const editorial = await Media.aggregate(
      buildAggregationPipeline(excludeSeen({ isDefaultContent: true }), {
        sampleSize: limitPerSection,
      })
    );
    if (editorial.length > 0) {
      editorial.forEach((m: any) => seenMediaIds.add(String(m._id)));
      sections.push({
        key: "editorial",
        title: "Jevah Picks",
        media: editorial,
        metadata: { abTestVariant },
      });
    }
  } catch { }

  // 2) Enhanced personalized For You with collaborative filtering
  try {
    let match: any = {};
    if (userProfile) {
      const topTopics = Object.keys(userProfile.topTopics).slice(0, 10);
      const topCategories = Object.keys(userProfile.topCategories).slice(
        0,
        5
      );
      const topTypes = Object.keys(userProfile.topContentTypes).slice(0, 3);

      const orClauses: any[] = [];
      if (topTopics.length > 0)
        orClauses.push({ topics: { $in: topTopics } });
      if (topCategories.length > 0)
        orClauses.push({ category: { $in: topCategories } });
      if (topTypes.length > 0)
        orClauses.push({ contentType: { $in: topTypes } });
      if (orClauses.length > 0) match = { $or: orClauses };
    }

    const personalized = await Media.aggregate(
      buildAggregationPipeline(excludeSeen(match), {
        sampleSize: limitPerSection,
      })
    );

    if (personalized.length > 0) {
      // Enhance with collaborative filtering scores
      const enhancedPersonalized = await Promise.all(
        personalized.map(async (media: any) => {
          const collaborativeSignals =
            await recommendationEngineService.getCollaborativeSignals(
              media._id,
              userId
            );
          const qualityScore =
            recommendationEngineService.calculateContentQualityScore(media);
          const collaborativeScore =
            collaborativeSignals.length > 0
              ? collaborativeSignals[0].predictedScore
              : 0;

          return {
            ...media,
            _collaborativeScore: collaborativeScore,
            _qualityScore: qualityScore,
          };
        })
      );

      // Sort by combined score
      enhancedPersonalized.sort(
        (a, b) =>
          b._collaborativeScore +
          b._qualityScore -
          (a._collaborativeScore + a._qualityScore)
      );

      enhancedPersonalized.forEach((m: any) =>
        seenMediaIds.add(String(m._id))
      );
      sections.push({
        key: "for_you",
        title: "For You",
        media: enhancedPersonalized,
        reason: "Based on your activity and similar users",
        metadata: {
          abTestVariant,
          qualityScore:
            enhancedPersonalized.reduce(
              (sum, m) => sum + m._qualityScore,
              0
            ) / enhancedPersonalized.length,
          collaborativeScore:
            enhancedPersonalized.reduce(
              (sum, m) => sum + m._collaborativeScore,
              0
            ) / enhancedPersonalized.length,
        },
      });
    }
  } catch { }

  // 3) Because you watched/listened/read (similar to last item with topic embeddings)
  try {
    if (lastViewedMedia && lastViewedMedia._id) {
      const lv = lastViewedMedia as any;
      const similarMatch: any = {
        _id: { $ne: new Types.ObjectId(String(lv._id)) },
      };
      const or: any[] = [];
      if (Array.isArray(lv.topics) && lv.topics.length > 0) {
        or.push({ topics: { $in: lv.topics } });
      }
      if (lv.category) {
        or.push({ category: lv.category });
      }
      if (lv.contentType) {
        or.push({ contentType: lv.contentType });
      }
      if (or.length > 0) similarMatch.$or = or;

      const similar = await Media.aggregate(
        buildAggregationPipeline(excludeSeen(similarMatch), {
          sampleSize: limitPerSection,
        })
      );

      if (similar.length > 0) {
        // Enhance with topic similarity scoring
        const enhancedSimilar = similar.map((media: any) => {
          const topicSimilarity = userProfile
            ? recommendationEngineService["calculateTopicSimilarity"](
              lv.topics || [],
              media.topics || []
            )
            : 0;

          return {
            ...media,
            _topicSimilarity: topicSimilarity,
          };
        });

        enhancedSimilar.sort(
          (a, b) => b._topicSimilarity - a._topicSimilarity
        );
        enhancedSimilar.forEach((m: any) => seenMediaIds.add(String(m._id)));

        sections.push({
          key: "because_you_watched",
          title: "Because you watched",
          media: enhancedSimilar,
          metadata: { abTestVariant },
        });
      }
    }
  } catch { }

  // 4) Trending now (recent window)
  try {
    const trending = await enhancedMediaService.getTrendingMedia(
      undefined,
      limitPerSection,
      14
    );
    if (Array.isArray(trending) && trending.length > 0) {
      const trendingProjected = await Media.aggregate(
        buildAggregationPipeline(
          excludeSeen({
            _id: {
              $in: trending.map(
                (t: any) => new Types.ObjectId(String(t._id))
              ),
            },
          }),
          { limit: limitPerSection }
        )
      );
      if (trendingProjected.length > 0) {
        trendingProjected.forEach((m: any) =>
          seenMediaIds.add(String(m._id))
        );
        sections.push({
          key: "trending",
          title: "Trending",
          media: trendingProjected,
          metadata: { abTestVariant },
        });
      }
    }
  } catch { }

  // 5) Quick picks (random explore with light filtering by mood/type when provided)
  try {
    const mood = (options?.mood || "").toLowerCase();
    const moodFilters: Record<string, any> = {};
    if (["worship", "praise", "inspiration"].includes(mood)) {
      moodFilters.category = mood;
    }
    const quickPicks = await Media.aggregate(
      buildAggregationPipeline(excludeSeen(moodFilters), {
        sampleSize: limitPerSection,
      })
    );
    if (quickPicks.length > 0) {
      quickPicks.forEach((m: any) => seenMediaIds.add(String(m._id)));
      sections.push({
        key: "quick_picks",
        title: "Explore",
        media: quickPicks,
        metadata: { abTestVariant },
      });
    }
  } catch { }

  // Reorder sections based on A/B test variant
  const orderedSections = sectionOrdering
    .map(key => sections.find(s => s.key === key))
    .filter(Boolean) as typeof sections;

  return { sections: orderedSections };
}
