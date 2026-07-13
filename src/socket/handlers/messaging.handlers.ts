import { User } from "../../models/user.model";
import logger from "../../utils/logger";
import { AuthenticatedUser, SocketContext } from "../types";
import { getChatRoomId } from "../helpers";

export async function handleStreamChat(
  ctx: SocketContext,
  socket: any,
  user: AuthenticatedUser,
  data: { streamId: string; message: string }
): Promise<void> {
  try {
    const { streamId, message } = data;
    const chatMessage = {
      id: Date.now().toString(),
      message,
      user: {
        id: user.userId,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      timestamp: new Date(),
    };

    ctx.io.to(`stream:${streamId}`).emit("stream-chat", chatMessage);
    logger.info("Stream chat message sent", { userId: user.userId, streamId });
  } catch (error) {
    logger.error("Error sending stream chat", { error: (error as Error).message });
    socket.emit("error", { message: "Failed to send chat message" });
  }
}

export function handleStreamStatus(
  ctx: SocketContext,
  socket: any,
  user: AuthenticatedUser,
  data: { streamId: string; status: string }
): void {
  const { streamId, status } = data;
  ctx.io.to(`stream:${streamId}`).emit("stream-status", {
    streamId,
    status,
    updatedBy: user.userId,
  });
  logger.info("Stream status updated", { userId: user.userId, streamId, status });
}

export async function handleSendMessage(
  ctx: SocketContext,
  socket: any,
  user: AuthenticatedUser,
  data: {
    recipientId: string;
    content: string;
    messageType?: string;
    mediaUrl?: string;
    replyTo?: string;
  }
): Promise<void> {
  try {
    const { recipientId, content, messageType, mediaUrl, replyTo } = data;

    const recipient = await User.findById(recipientId);
    if (!recipient) {
      socket.emit("error", { message: "Recipient not found" });
      return;
    }

    const interactionService = await import("../../service/interaction.service");
    const message = await interactionService.default.sendMessage({
      senderId: user.userId,
      recipientId,
      content,
      messageType: messageType as any,
      mediaUrl,
      replyTo,
    });

    ctx.io.to(`user:${recipientId}`).emit("new-message", {
      message,
      sender: {
        id: user.userId,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });

    socket.emit("message-sent", { messageId: message._id, timestamp: new Date() });

    logger.info("Private message sent", {
      senderId: user.userId,
      recipientId,
      messageId: message._id,
    });
  } catch (error) {
    logger.error("Error sending private message", { error: (error as Error).message });
    socket.emit("error", { message: "Failed to send message" });
  }
}

export function handleJoinChat(
  socket: any,
  user: AuthenticatedUser,
  recipientId: string
): void {
  const chatRoomId = getChatRoomId(user.userId, recipientId);
  socket.join(chatRoomId);
  logger.debug("User joined private chat", { userId: user.userId, recipientId, chatRoomId });
}

export function handleLeaveChat(socket: any, recipientId: string): void {
  const chatRoomId = getChatRoomId(socket.data.user.userId, recipientId);
  socket.leave(chatRoomId);
  logger.debug("User left private chat", {
    userId: socket.data.user.userId,
    recipientId,
    chatRoomId,
  });
}

export function handleChatTypingStart(
  ctx: SocketContext,
  user: AuthenticatedUser,
  recipientId: string
): void {
  ctx.io.to(`user:${recipientId}`).emit("user-typing-chat", {
    userId: user.userId,
    firstName: user.firstName,
    isTyping: true,
  });
}

export function handleChatTypingStop(
  ctx: SocketContext,
  user: AuthenticatedUser,
  recipientId: string
): void {
  ctx.io.to(`user:${recipientId}`).emit("user-typing-chat", {
    userId: user.userId,
    firstName: user.firstName,
    isTyping: false,
  });
}
