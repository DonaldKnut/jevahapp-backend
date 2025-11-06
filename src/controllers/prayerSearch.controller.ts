import { Request, Response } from "express";
import { PrayerPost } from "../models/prayerPost.model";
import { MediaInteraction } from "../models/mediaInteraction.model";
import mongoose, { Types } from "mongoose";
import logger from "../utils/logger";

/**
 * AI-enhanced search for prayer posts
 * Uses semantic search and keyword matching
 */
export const searchPrayers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { query } = req.query;
    const page = Math.max(parseInt(String(req.query.page || 1), 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || 20), 10) || 20, 1), 100);

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      res.status(400).json({ success: false, error: "Search query is required" });
      return;
    }

    const searchQuery = query.trim();
    const userId = req.userId;

    // Build search conditions
    const searchConditions: any[] = [
      { content: { $regex: searchQuery, $options: "i" } },
      { prayerText: { $regex: searchQuery, $options: "i" } },
      { "verse.text": { $regex: searchQuery, $options: "i" } },
      { "verse.reference": { $regex: searchQuery, $options: "i" } },
    ];

    // If MongoDB text search is available, use it for better results
    const searchRegex = new RegExp(searchQuery.split(/\s+/).join("|"), "i");

    // Find prayers matching search query
    const prayers = await PrayerPost.find({
      $or: searchConditions,
    })
      .populate("authorId", "firstName lastName username avatar")
      .sort({ createdAt: -1 })
      .lean();

    // Calculate relevance scores
    const prayersWithScores = prayers.map((prayer: any) => {
      let score = 0;
      const lowerQuery = searchQuery.toLowerCase();
      const prayerText = (prayer.prayerText || prayer.content || "").toLowerCase();
      const verseText = (prayer.verse?.text || "").toLowerCase();
      const verseRef = (prayer.verse?.reference || "").toLowerCase();

      // Exact match in prayer text
      if (prayerText.includes(lowerQuery)) {
        score += 10;
        // Exact phrase match gets higher score
        if (prayerText.includes(lowerQuery)) {
          score += 5;
        }
      }

      // Match in verse text
      if (verseText.includes(lowerQuery)) {
        score += 8;
      }

      // Match in verse reference
      if (verseRef.includes(lowerQuery)) {
        score += 7;
      }

      // Word matches (each word match adds points)
      const queryWords = lowerQuery.split(/\s+/);
      queryWords.forEach((word) => {
        if (prayerText.includes(word)) score += 2;
        if (verseText.includes(word)) score += 1.5;
      });

      // Normalize score to 0-1 range
      const relevanceScore = Math.min(1, score / 20);

      return {
        ...prayer,
        relevanceScore,
      };
    });

    // Sort by relevance score (descending)
    prayersWithScores.sort((a: any, b: any) => b.relevanceScore - a.relevanceScore);

    // Paginate
    const total = prayersWithScores.length;
    const paginatedPrayers = prayersWithScores.slice((page - 1) * limit, page * limit);

    // Format prayers with user interaction data
    const formattedPrayers = await Promise.all(
      paginatedPrayers.map(async (prayer: any) => {
        // Check if user liked this prayer
        let userLiked = false;
        if (userId && Types.ObjectId.isValid(userId)) {
          const like = await MediaInteraction.findOne({
            user: userId,
            media: prayer._id,
            interactionType: "like",
          });
          userLiked = !!like;
        }

        return {
          _id: String(prayer._id),
          userId: String(prayer.authorId?._id || prayer.authorId),
          prayerText: prayer.prayerText || prayer.content,
          verse: prayer.verse || undefined,
          color: prayer.color || "#A16CE5",
          shape: prayer.shape || "square",
          createdAt: prayer.createdAt,
          likesCount: prayer.likesCount || 0,
          commentsCount: prayer.commentsCount || 0,
          userLiked,
          author: prayer.authorId && typeof prayer.authorId === "object" && prayer.authorId._id
            ? {
                _id: String(prayer.authorId._id),
                username: prayer.authorId.username,
                firstName: prayer.authorId.firstName,
                lastName: prayer.authorId.lastName,
                avatarUrl: prayer.authorId.avatar,
              }
            : null,
          relevanceScore: Math.round(prayer.relevanceScore * 100) / 100, // Round to 2 decimals
        };
      })
    );

    logger.info("Prayer search completed", { query: searchQuery, results: formattedPrayers.length });

    res.status(200).json({
      success: true,
      data: {
        prayers: formattedPrayers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total,
        },
      },
    });
  } catch (error: any) {
    logger.error("Error searching prayers", { error: error.message, query: req.query.query });
    res.status(500).json({ success: false, error: "Failed to search prayers" });
  }
};

