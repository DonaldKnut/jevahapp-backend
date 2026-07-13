import { Types } from "mongoose";
import { Message } from "../../../models/message.model";
import { Conversation } from "../../../models/conversation.model";

export async function getConversationMessages(
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

  await Message.updateMany(
    {
      recipient: userId,
      sender: { $in: conversation.participants },
      isRead: false,
      isDeleted: false,
    },
    { isRead: true, readAt: new Date() }
  );

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
    messages: messages.reverse(),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

export async function getUserConversations(userId: string): Promise<any[]> {
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
