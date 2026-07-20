import { Types, ClientSession } from "mongoose";
import { Message } from "../../../models/message.model";
import { Conversation } from "../../../models/conversation.model";
import { User } from "../../../models/user.model";
import logger from "../../../utils/logger";
import { NotificationService } from "../../../service/notification.service";

export interface MessageInput {
  senderId: string;
  recipientId: string;
  content: string;
  messageType?: "text" | "image" | "audio" | "video" | "file";
  mediaUrl?: string;
  replyTo?: string;
}

export async function sendMessage(data: MessageInput): Promise<any> {
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

    const populatedMessage = await Message.findById(result._id)
      .populate("sender", "firstName lastName avatar")
      .populate("recipient", "firstName lastName avatar")
      .populate("replyTo", "content sender");

    try {
      const sender = await User.findById(data.senderId).select(
        "firstName lastName email"
      );
      const preview = data.content.substring(0, 100);
      await NotificationService.createNotification({
        userId: data.recipientId,
        type: "message",
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
      });
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

export async function deleteMessage(messageId: string, userId: string): Promise<void> {
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
