import { Request, Response } from "express";
import { Types } from "mongoose";
import interactionService from "../../../service/interaction.service";
import logger from "../../../utils/logger";

function requireUser(req: Request, res: Response): string | null {
  if (!req.userId) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return null;
  }
  return req.userId;
}

export const sendMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const senderId = requireUser(req, res);
    if (!senderId) return;

    const { recipientId } = req.params;
    const { content, messageType, mediaUrl, replyTo } = req.body;

    if (!recipientId || !Types.ObjectId.isValid(recipientId)) {
      res.status(400).json({ success: false, message: "Invalid recipient ID" });
      return;
    }
    if (!content?.trim()) {
      res.status(400).json({ success: false, message: "Message content is required" });
      return;
    }

    const message = await interactionService.sendMessage({
      senderId,
      recipientId,
      content,
      messageType,
      mediaUrl,
      replyTo,
    });

    res.status(201).json({ success: true, message: "Message sent successfully", data: message });
  } catch (error: any) {
    logger.error("Send message error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to send message" });
  }
};

export const getConversationMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const { conversationId } = req.params;
    const page = parseInt(String(req.query.page || 1), 10) || 1;
    const limit = parseInt(String(req.query.limit || 50), 10) || 50;

    if (!conversationId || !Types.ObjectId.isValid(conversationId)) {
      res.status(400).json({ success: false, message: "Invalid conversation ID" });
      return;
    }

    const result = await interactionService.getConversationMessages(
      conversationId,
      userId,
      page,
      limit
    );
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    logger.error("Get conversation messages error", { error: error.message });
    if (error.message.includes("not found") || error.message.includes("access denied")) {
      res.status(404).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({ success: false, message: "Failed to get conversation messages" });
  }
};

export const getUserConversations = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const conversations = await interactionService.getUserConversations(userId);
    res.status(200).json({ success: true, data: conversations });
  } catch (error: any) {
    logger.error("Get user conversations error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to get conversations" });
  }
};

export const deleteMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const { messageId } = req.params;
    if (!messageId || !Types.ObjectId.isValid(messageId)) {
      res.status(400).json({ success: false, message: "Invalid message ID" });
      return;
    }

    await interactionService.deleteMessage(messageId, userId);
    res.status(200).json({ success: true, message: "Message deleted successfully" });
  } catch (error: any) {
    logger.error("Delete message error", { error: error.message });
    if (error.message.includes("not found")) {
      res.status(404).json({ success: false, message: error.message });
      return;
    }
    if (error.message.includes("own messages")) {
      res.status(403).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({ success: false, message: "Failed to delete message" });
  }
};
