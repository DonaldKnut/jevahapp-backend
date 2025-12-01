import { Request, Response } from "express";
import { CopyrightFreeSongService } from "../service/copyrightFreeSong.service";
import logger from "../utils/logger";
import { CopyrightFreeSongInteractionService } from "../service/copyrightFreeSongInteraction.service";

const songService = new CopyrightFreeSongService();
const interactionService = new CopyrightFreeSongInteractionService();

export const getAllSongs = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await songService.getAllSongs(page, limit);

    res.status(200).json({
      success: true,
      data: {
        songs: result.songs,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
          limit,
        },
      },
    });
  } catch (error: any) {
    logger.error("Error getting all songs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve songs",
      error: error.message,
    });
  }
};

export const getSongById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { songId } = req.params;
    const userId = req.userId;

    const song = await songService.getSongById(songId);

    if (!song) {
      res.status(404).json({
        success: false,
        message: "Song not found",
      });
      return;
    }

    let isLiked = false;
    if (userId) {
      isLiked = await interactionService.isLiked(userId, songId);
    }

    res.status(200).json({
      success: true,
      data: {
        ...song,
        isLiked,
      },
    });
  } catch (error: any) {
    logger.error("Error getting song:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve song",
      error: error.message,
    });
  }
};

export const createSong = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, singer, fileUrl, thumbnailUrl, duration } = req.body;
    const uploadedBy = req.userId;

    if (!title || !singer || !fileUrl || !uploadedBy) {
      res.status(400).json({
        success: false,
        message: "Title, singer, fileUrl, and uploadedBy are required",
      });
      return;
    }

    const song = await songService.createSong({
      title,
      singer,
      fileUrl,
      thumbnailUrl,
      duration,
      uploadedBy,
    });

    res.status(201).json({
      success: true,
      data: song,
    });
  } catch (error: any) {
    logger.error("Error creating song:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create song",
      error: error.message,
    });
  }
};

export const updateSong = async (req: Request, res: Response): Promise<void> => {
  try {
    const { songId } = req.params;
    const { title, singer, thumbnailUrl, duration } = req.body;

    const song = await songService.updateSong(songId, {
      title,
      singer,
      thumbnailUrl,
      duration,
    });

    if (!song) {
      res.status(404).json({
        success: false,
        message: "Song not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: song,
    });
  } catch (error: any) {
    logger.error("Error updating song:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update song",
      error: error.message,
    });
  }
};

export const deleteSong = async (req: Request, res: Response): Promise<void> => {
  try {
    const { songId } = req.params;

    const deleted = await songService.deleteSong(songId);

    if (!deleted) {
      res.status(404).json({
        success: false,
        message: "Song not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Song deleted successfully",
    });
  } catch (error: any) {
    logger.error("Error deleting song:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete song",
      error: error.message,
    });
  }
};

export const toggleLike = async (req: Request, res: Response): Promise<void> => {
  try {
    const { songId } = req.params;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const { liked, likeCount, shareCount } = await interactionService.toggleLike(userId, songId);

    res.status(200).json({
      success: true,
      data: {
        liked,
        likeCount,
        shareCount,
      },
    });
  } catch (error: any) {
    logger.error("Error toggling like:", error);
    res.status(500).json({
      success: false,
      message: "Failed to toggle like",
      error: error.message,
    });
  }
};

export const shareSong = async (req: Request, res: Response): Promise<void> => {
  try {
    const { songId } = req.params;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const { shareCount, likeCount } = await interactionService.shareSong(userId, songId);

    res.status(200).json({
      success: true,
      data: {
        shareCount,
        likeCount,
      },
    });
  } catch (error: any) {
    logger.error("Error sharing song:", error);
    res.status(500).json({
      success: false,
      message: "Failed to share song",
      error: error.message,
    });
  }
};

export const searchSongs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!q || typeof q !== "string") {
      res.status(400).json({
        success: false,
        message: "Search query (q) is required",
      });
      return;
    }

    const result = await songService.searchSongs(q, page, limit);

    res.status(200).json({
      success: true,
      data: {
        songs: result.songs,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
          limit,
        },
      },
    });
  } catch (error: any) {
    logger.error("Error searching songs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to search songs",
      error: error.message,
    });
  }
};

