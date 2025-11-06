import { Request, Response } from "express";
import { Poll } from "../models/poll.model";
import { User } from "../models/user.model";
import mongoose, { Types } from "mongoose";
import logger from "../utils/logger";

/**
 * Update Poll (Creator or Admin Only)
 */
export const updatePoll = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, question, description, expiresAt, closesAt, isActive } = req.body || {};

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, error: "Invalid poll ID" });
      return;
    }

    const poll = await Poll.findById(id);
    if (!poll) {
      res.status(404).json({ success: false, error: "Poll not found" });
      return;
    }

    // Check if user is admin OR the poll creator
    const user = await User.findById(req.userId);
    const isAdmin = user && user.role === "admin";
    const isCreator = String(poll.authorId) === String(req.userId);
    
    if (!isAdmin && !isCreator) {
      res.status(403).json({ 
        success: false, 
        error: "Forbidden: Only the poll creator or admin can update this poll" 
      });
      return;
    }

    // Update title/question
    if (title !== undefined) {
      if (typeof title !== "string" || title.trim().length < 5) {
        res.status(400).json({ success: false, error: "Validation error: title must be at least 5 characters" });
        return;
      }
      if (title.length > 200) {
        res.status(400).json({ success: false, error: "Validation error: title must be less than 200 characters" });
        return;
      }
      poll.question = title.trim();
      poll.title = title.trim();
    } else if (question !== undefined) {
      if (typeof question !== "string" || question.trim().length < 5) {
        res.status(400).json({ success: false, error: "Validation error: question must be at least 5 characters" });
        return;
      }
      if (question.length > 200) {
        res.status(400).json({ success: false, error: "Validation error: question must be less than 200 characters" });
        return;
      }
      poll.question = question.trim();
      poll.title = question.trim();
    }

    // Update description
    if (description !== undefined) {
      if (description === null) {
        poll.description = undefined;
      } else if (typeof description === "string") {
        if (description.length > 500) {
          res.status(400).json({ success: false, error: "Validation error: description must be less than 500 characters" });
          return;
        }
        poll.description = description.trim();
      } else {
        res.status(400).json({ success: false, error: "Validation error: description must be a string or null" });
        return;
      }
    }

    // Update expiresAt/closesAt
    if (expiresAt !== undefined || closesAt !== undefined) {
      const expiryDate = expiresAt || closesAt;
      if (expiryDate === null) {
        poll.closesAt = undefined;
        poll.expiresAt = undefined;
      } else {
        const date = new Date(expiryDate);
        if (isNaN(date.getTime())) {
          res.status(400).json({ success: false, error: "Validation error: invalid date format" });
          return;
        }
        if (date <= new Date()) {
          res.status(400).json({ success: false, error: "Validation error: expiry date must be in the future" });
          return;
        }
        poll.closesAt = date;
        poll.expiresAt = date;
      }
    }

    await poll.save();
    await poll.populate("authorId", "firstName lastName username avatar");

    logger.info("Poll updated", { pollId: poll._id, userId: req.userId });

    res.status(200).json({
      success: true,
      data: await serializePoll(poll, req.userId),
    });
  } catch (error: any) {
    logger.error("Error updating poll", { error: error.message, pollId: req.params.id });
    res.status(500).json({ success: false, error: "Failed to update poll" });
  }
};

/**
 * Delete Poll (Creator or Admin Only)
 */
export const deletePoll = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, error: "Invalid poll ID" });
      return;
    }

    const poll = await Poll.findById(id);
    if (!poll) {
      res.status(404).json({ success: false, error: "Poll not found" });
      return;
    }

    // Check if user is admin OR the poll creator
    const user = await User.findById(req.userId);
    const isAdmin = user && user.role === "admin";
    const isCreator = String(poll.authorId) === String(req.userId);
    
    if (!isAdmin && !isCreator) {
      res.status(403).json({ 
        success: false, 
        error: "Forbidden: Only the poll creator or admin can delete this poll" 
      });
      return;
    }

    await Poll.findByIdAndDelete(id);

    logger.info("Poll deleted", { pollId: id, userId: req.userId });

    res.status(200).json({
      success: true,
      message: "Poll deleted successfully",
    });
  } catch (error: any) {
    logger.error("Error deleting poll", { error: error.message, pollId: req.params.id });
    res.status(500).json({ success: false, error: "Failed to delete poll" });
  }
};

/**
 * Serialize Poll with enhanced format
 */
export async function serializePoll(doc: any, userId?: string) {
  const obj = doc.toObject ? doc.toObject() : doc;

  // Calculate votes per option
  const totalVotes = obj.votes.length;
  const optionsWithStats = obj.options.map((text: string, index: number) => {
    const votesCount = obj.votes.filter((v: any) => 
      v.optionIndexes.includes(index)
    ).length;
    const percentage = totalVotes > 0 
      ? Math.round((votesCount / totalVotes) * 100) 
      : 0;

    return {
      _id: `${obj._id}_${index}`, // Generate option ID
      text,
      votesCount,
      percentage,
    };
  });

  // Check if user voted
  const userVote = userId && Types.ObjectId.isValid(userId)
    ? obj.votes.find((v: any) => String(v.userId) === String(userId))
    : null;

  // Determine if poll is active
  const now = new Date();
  const isActive = !obj.closesAt || new Date(obj.closesAt) > now;

  return {
    _id: String(obj._id),
    title: obj.title || obj.question,
    question: obj.question || obj.title,
    description: obj.description || undefined,
    createdBy: String(obj.authorId?._id || obj.authorId),
    options: optionsWithStats,
    totalVotes,
    expiresAt: obj.expiresAt || obj.closesAt,
    closesAt: obj.closesAt || obj.expiresAt,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    isActive,
    userVoted: !!userVote,
    userVoteOptionId: userVote && userVote.optionIndexes.length > 0
      ? `${obj._id}_${userVote.optionIndexes[0]}`
      : undefined,
    createdByUser: obj.authorId && typeof obj.authorId === "object" && obj.authorId._id
      ? {
          _id: String(obj.authorId._id),
          username: obj.authorId.username,
          avatarUrl: obj.authorId.avatar,
        }
      : null,
  };
}

