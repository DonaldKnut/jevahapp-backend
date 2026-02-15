import mongoose, { Types, ClientSession } from "mongoose";
import { MediaInteraction } from "../models/mediaInteraction.model";
import { Media } from "../models/media.model";
import { User } from "../models/user.model";
import { Message } from "../models/message.model";
import { Conversation } from "../models/conversation.model";
import logger from "../utils/logger";
import { NotificationService } from "./notification.service";

export interface ReactionInput {
  userId: string;
  commentId: string;
  reactionType: string;
}

export interface MessageInput {
  senderId: string;
  recipientId: string;
  content: string;
  messageType?: "text" | "image" | "audio" | "video" | "file";
  mediaUrl?: string;
  replyTo?: string;
}

export class InteractionService {
  /**
   * Add reaction to comment
   */
  async addCommentReaction(
    data: ReactionInput
  ): Promise<{ reactionType: string; count: number }> {
    if (
      !Types.ObjectId.isValid(data.userId) ||
      !Types.ObjectId.isValid(data.commentId)
    ) {
      throw new Error("Invalid user or comment ID");
    }

    const comment = await MediaInteraction.findById(data.commentId);
    if (!comment || comment.interactionType !== "comment") {
      throw new Error("Comment not found");
    }

    const session: ClientSession = await Media.startSession();
    try {
      const result = await session.withTransaction(async () => {
        const userId = new Types.ObjectId(data.userId);
        const currentReactions: any = (comment.reactions as any) || {};
        const existing = Array.isArray(currentReactions[data.reactionType])
          ? currentReactions[data.reactionType]
          : [];

        const hasReacted = existing.some((id: any) => id.equals(userId));
        const updatedArray = hasReacted
          ? existing.filter((id: any) => !id.equals(userId))
          : [...existing, userId];

        await MediaInteraction.findByIdAndUpdate(
          data.commentId,
          { [`reactions.${data.reactionType}`]: updatedArray },
          { new: false, session }
        );

        return {
          reactionType: data.reactionType,
          count: updatedArray.length,
        };
      });

      return result;
    } finally {
      session.endSession();
    }
  }

  /**
   * Send message
   */
  async sendMessage(data: MessageInput): Promise<any> {
    if (
      !Types.ObjectId.isValid(data.senderId) ||
      !Types.ObjectId.isValid(data.recipientId)
    ) {
      throw new Error("Invalid sender or recipient ID");
    }

    if (!data.content || data.content.trim().length === 0) {
      throw new Error("Message content is required");
    }

    const session: ClientSession = await Message.startSession();
    try {
      const result = await session.withTransaction(async () => {
        // Find or create conversation
        let conversation = await Conversation.findOne({
          participants: { $all: [data.senderId, data.recipientId] },
          isGroupChat: false,
        }).session(session);

        if (!conversation) {
          conversation = await Conversation.create(
            [
              {
                participants: [data.senderId, data.recipientId],
                unreadCount: { [data.recipientId]: 0 },
              },
            ],
            { session }
          );
        }

        // Create message
        const messageData: any = {
          sender: new Types.ObjectId(data.senderId),
          recipient: new Types.ObjectId(data.recipientId),
          content: data.content.trim(),
          messageType: data.messageType || "text",
        };

        if (data.mediaUrl) {
          messageData.mediaUrl = data.mediaUrl;
        }

        if (data.replyTo && Types.ObjectId.isValid(data.replyTo)) {
          messageData.replyTo = new Types.ObjectId(data.replyTo);
        }

        const message = await Message.create([messageData], { session });

        // Update conversation
        await Conversation.findByIdAndUpdate(
          conversation._id,
          {
            lastMessage: message[0]._id,
            lastMessageAt: new Date(),
            $inc: { [`unreadCount.${data.recipientId}`]: 1 },
          },
          { session }
        );

        return message[0];
      });

      // Populate sender info
      const populatedMessage = await Message.findById(result._id)
        .populate("sender", "firstName lastName avatar")
        .populate("recipient", "firstName lastName avatar")
        .populate("replyTo", "content sender");

      // Notify recipient of new message
      try {
        const sender = await User.findById(data.senderId).select(
          "firstName lastName email"
        );
        const preview = data.content.substring(0, 100);
        await NotificationService.createNotification({
          userId: data.recipientId,
          type: "message" as any,
          title: "New Message",
          message: `${sender?.firstName || sender?.email || "Someone"}: ${preview}`,
          metadata: {
            conversationId: (
              await Conversation.findOne({
                participants: { $all: [data.senderId, data.recipientId] },
                isGroupChat: false,
              })
            )?._id,
          },
          priority: "low",
        } as any);
      } catch (msgNotifyError: any) {
        logger.warn("Failed to send message notification", {
          error: msgNotifyError?.message,
          senderId: data.senderId,
          recipientId: data.recipientId,
        });
      }

      return populatedMessage;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get conversation messages
   */
  async getConversationMessages(
    conversationId: string,
    userId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<any> {
    if (
      !Types.ObjectId.isValid(conversationId) ||
      !Types.ObjectId.isValid(userId)
    ) {
      throw new Error("Invalid conversation or user ID");
    }

    const conversation = await Conversation.findById(conversationId);
    if (
      !conversation ||
      !conversation.participants.includes(new Types.ObjectId(userId))
    ) {
      throw new Error("Conversation not found or access denied");
    }

    const skip = (page - 1) * limit;

    const messages = await Message.find({
      $or: [
        { sender: userId, recipient: { $in: conversation.participants } },
        { recipient: userId, sender: { $in: conversation.participants } },
      ],
      isDeleted: false,
    })
      .populate("sender", "firstName lastName avatar")
      .populate("recipient", "firstName lastName avatar")
      .populate("replyTo", "content sender")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Mark messages as read
    await Message.updateMany(
      {
        recipient: userId,
        sender: { $in: conversation.participants },
        isRead: false,
        isDeleted: false,
      },
      { isRead: true, readAt: new Date() }
    );

    // Reset unread count
    await Conversation.findByIdAndUpdate(conversationId, {
      $set: { [`unreadCount.${userId}`]: 0 },
    });

    const total = await Message.countDocuments({
      $or: [
        { sender: userId, recipient: { $in: conversation.participants } },
        { recipient: userId, sender: { $in: conversation.participants } },
      ],
      isDeleted: false,
    });

    return {
      messages: messages.reverse(), // Return in chronological order
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get user conversations
   */
  async getUserConversations(userId: string): Promise<any[]> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid user ID");
    }

    const conversations = await Conversation.find({
      participants: userId,
      isActive: true,
    })
      .populate("participants", "firstName lastName avatar")
      .populate("lastMessage", "content sender createdAt")
      .populate("groupAdmin", "firstName lastName")
      .sort({ lastMessageAt: -1 });

    return conversations;
  }

  /**
   * Delete message
   */
  async deleteMessage(messageId: string, userId: string): Promise<void> {
    if (!Types.ObjectId.isValid(messageId) || !Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid message or user ID");
    }

    const message = await Message.findById(messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    if (message.sender.toString() !== userId) {
      throw new Error("You can only delete your own messages");
    }

    await Message.findByIdAndUpdate(messageId, {
      isDeleted: true,
      deletedAt: new Date(),
    });
  }
}

export default new InteractionService();
