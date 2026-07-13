import { Server as SocketIOServer } from "socket.io";
import { Server as HTTPServer } from "http";
import logger from "../utils/logger";
import { NotificationService } from "./notification.service";
import { AuthenticatedUser, SocketContext } from "../socket/types";
import { createSocketAuthMiddleware } from "../socket/middleware/auth.middleware";
import * as rooms from "../socket/handlers/rooms.handlers";
import * as engagement from "../socket/handlers/engagement.handlers";
import * as messaging from "../socket/handlers/messaging.handlers";

class SocketService {
  private io: SocketIOServer;
  private connectedUsers: Map<string, AuthenticatedUser> = new Map();
  private streamViewers: Map<string, Set<string>> = new Map();

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true,
      },
      transports: ["websocket", "polling"],
      path: "/socket.io/",
      pingTimeout: 60000,
      pingInterval: 25000,
      upgradeTimeout: 10000,
      maxHttpBufferSize: 1e6,
      connectTimeout: 45000,
      allowEIO3: true,
    });

    this.io.use(createSocketAuthMiddleware(this.connectedUsers));
    this.setupEventHandlers();

    try {
      (NotificationService as any).setSocketService?.(this);
    } catch {}
    logger.info("Socket.IO service initialized");
  }

  private ctx(): SocketContext {
    return {
      io: this.io,
      connectedUsers: this.connectedUsers,
      streamViewers: this.streamViewers,
    };
  }

  private setupEventHandlers(): void {
    this.io.on("connection", socket => {
      const user = socket.data.user as AuthenticatedUser;
      const ctx = this.ctx();

      logger.info("Socket connection established", {
        userId: user.userId,
        socketId: socket.id,
      });

      socket.join(`user:${user.userId}`);

      socket.on("disconnect", () => rooms.handleDisconnect(ctx, socket, user));
      socket.on("join-media", (mediaId: string) =>
        rooms.handleJoinMedia(socket, user, mediaId)
      );
      socket.on("leave-media", (mediaId: string) =>
        rooms.handleLeaveMedia(socket, mediaId)
      );
      socket.on("join-content", (data: { contentId: string; contentType: string }) =>
        rooms.handleJoinContent(ctx, socket, user, data)
      );
      socket.on("leave-content", (data: { contentId: string; contentType: string }) =>
        rooms.handleLeaveContent(ctx, socket, data)
      );
      socket.on("join-stream", (data: { streamId: string; action: "join" | "leave" }) =>
        rooms.handleJoinStream(ctx, socket, user, data)
      );
      socket.on("leave-stream", (data: { streamId: string; action: "join" | "leave" }) =>
        rooms.handleLeaveStream(ctx, socket, user, data)
      );

      socket.on("new-comment", async (data) =>
        engagement.handleNewComment(ctx, socket, user, data)
      );
      socket.on("comment-reaction", async (data) =>
        engagement.handleCommentReaction(ctx, socket, user, data)
      );
      socket.on("media-reaction", async (data) =>
        engagement.handleMediaReaction(ctx, socket, user, data)
      );
      socket.on("content-reaction", async (data) =>
        engagement.handleContentReaction(ctx, socket, user, data)
      );
      socket.on("content-comment", async (data) =>
        engagement.handleContentComment(ctx, socket, user, data)
      );
      socket.on("typing-start", (mediaId: string) =>
        engagement.handleTypingStart(socket, user, mediaId)
      );
      socket.on("typing-stop", (mediaId: string) =>
        engagement.handleTypingStop(socket, user, mediaId)
      );
      socket.on("user-presence", (status: "online" | "away" | "offline") =>
        engagement.handleUserPresence(socket, user, status)
      );

      socket.on("stream-chat", async (data) =>
        messaging.handleStreamChat(ctx, socket, user, data)
      );
      socket.on("stream-status", (data) =>
        messaging.handleStreamStatus(ctx, socket, user, data)
      );
      socket.on("send-message", async (data) =>
        messaging.handleSendMessage(ctx, socket, user, data)
      );
      socket.on("join-chat", (recipientId: string) =>
        messaging.handleJoinChat(socket, user, recipientId)
      );
      socket.on("leave-chat", (recipientId: string) =>
        messaging.handleLeaveChat(socket, recipientId)
      );
      socket.on("chat-typing-start", (recipientId: string) =>
        messaging.handleChatTypingStart(ctx, user, recipientId)
      );
      socket.on("chat-typing-stop", (recipientId: string) =>
        messaging.handleChatTypingStop(ctx, user, recipientId)
      );
    });
  }

  public getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  public getStreamViewersCount(streamId: string): number {
    return this.streamViewers.get(streamId)?.size || 0;
  }

  public broadcastToAll(event: string, data: any): void {
    this.io.emit(event, data);
  }

  public broadcastToRoom(room: string, event: string, data: any): void {
    this.io.to(room).emit(event, data);
  }

  public sendToUser(userId: string, event: string, data: any): void {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  public getIO(): SocketIOServer {
    return this.io;
  }
}

export default SocketService;
