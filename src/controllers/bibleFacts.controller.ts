import { Request, Response } from "express";
import bibleFactsService from "../service/bibleFacts.service";
import logger from "../utils/logger";

/**
 * Get a random Bible fact
 */
export const getRandomBibleFact = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const fact = await bibleFactsService.getRandomBibleFact();

    if (fact) {
      response.status(200).json({
        success: true,
        data: fact,
      });
    } else {
      response.status(404).json({
        success: false,
        message: "No Bible facts found",
      });
    }
  } catch (error) {
    logger.error("Get random Bible fact error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to get Bible fact",
    });
  }
};

/**
 * Get personalized Bible fact for user
 */
export const getPersonalizedBibleFact = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId = request.userId;
    if (!userId) {
      response.status(401).json({
        success: false,
        message: "User ID not found",
      });
      return;
    }
    const personalizedFact =
      await bibleFactsService.getPersonalizedBibleFact(userId);

    if (personalizedFact) {
      response.status(200).json({
        success: true,
        data: personalizedFact,
      });
    } else {
      response.status(404).json({
        success: false,
        message: "No personalized Bible fact found",
      });
    }
  } catch (error) {
    logger.error("Get personalized Bible fact error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to get personalized Bible fact",
    });
  }
};

/**
 * Get Bible facts by category
 */
export const getBibleFactsByCategory = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { category } = request.params;
    const { limit = 10 } = request.query;

    const facts = await bibleFactsService.getBibleFactsByCategories(
      [category as any],
      parseInt(limit as string)
    );

    response.status(200).json({
      success: true,
      data: facts,
      count: facts.length,
    });
  } catch (error) {
    logger.error("Get Bible facts by category error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to get Bible facts by category",
    });
  }
};

/**
 * Get Bible facts by difficulty
 */
export const getBibleFactsByDifficulty = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { difficulty } = request.params;
    const { limit = 10 } = request.query;

    if (!["beginner", "intermediate", "advanced"].includes(difficulty)) {
      response.status(400).json({
        success: false,
        message: "Invalid difficulty level",
      });
      return;
    }

    const facts = await bibleFactsService.getBibleFactsByDifficulty(
      difficulty as any,
      parseInt(limit as string)
    );

    response.status(200).json({
      success: true,
      data: facts,
      count: facts.length,
    });
  } catch (error) {
    logger.error("Get Bible facts by difficulty error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to get Bible facts by difficulty",
    });
  }
};

/**
 * Search Bible facts by tags
 */
export const searchBibleFactsByTags = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { tags } = request.query;
    const { limit = 10 } = request.query;

    if (!tags || typeof tags !== "string") {
      response.status(400).json({
        success: false,
        message: "Tags parameter is required",
      });
      return;
    }

    const tagArray = tags.split(",").map(tag => tag.trim());
    const facts = await bibleFactsService.searchBibleFactsByTags(
      tagArray,
      parseInt(limit as string)
    );

    response.status(200).json({
      success: true,
      data: facts,
      count: facts.length,
    });
  } catch (error) {
    logger.error("Search Bible facts by tags error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to search Bible facts",
    });
  }
};

/**
 * Get daily Bible fact
 */
export const getDailyBibleFact = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const fact = await bibleFactsService.getDailyBibleFact();

    if (fact) {
      response.status(200).json({
        success: true,
        data: fact,
      });
    } else {
      response.status(404).json({
        success: false,
        message: "No daily Bible fact found",
      });
    }
  } catch (error) {
    logger.error("Get daily Bible fact error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to get daily Bible fact",
    });
  }
};

/**
 * Get Bible facts statistics (Admin only)
 */
export const getBibleFactsStats = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const stats = await bibleFactsService.getBibleFactStats();

    response.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error("Get Bible facts stats error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to get Bible facts statistics",
    });
  }
};

/**
 * Create a new Bible fact (Admin only)
 */
export const createBibleFact = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { title, fact, scripture, category, tags, difficulty } = request.body;

    if (!title || !fact || !scripture || !category) {
      response.status(400).json({
        success: false,
        message: "Title, fact, scripture, and category are required",
      });
      return;
    }

    const bibleFact = await bibleFactsService.createBibleFact({
      title,
      fact,
      scripture,
      category,
      tags: tags || [],
      difficulty: difficulty || "beginner",
    });

    response.status(201).json({
      success: true,
      data: bibleFact,
      message: "Bible fact created successfully",
    });
  } catch (error) {
    logger.error("Create Bible fact error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to create Bible fact",
    });
  }
};
