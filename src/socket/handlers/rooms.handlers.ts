import logger from "../../utils/logger";
import { User } from "../../models/user.model";
import { AuthenticatedUser, SocketContext, ViewerData } from "../types";

export function handleDisconnect(
  ctx: SocketContext,
  socket: any,
  user: AuthenticatedUser
): void {
  ctx.connectedUsers.delete(socket.id);

  ctx.streamViewers.forEach((viewers, streamId) => {
    if (viewers.has(user.userId)) {
      viewers.delete(user.userId);
      ctx.io.to(`stream:${streamId}`).emit("viewer-left", {
        streamId,
        userId: user.userId,
        viewerCount: viewers.size,
      });
    }
  });

  // Persist lastSeen when this was the user's last socket
  const stillConnected = Array.from(ctx.connectedUsers.values()).some(
    u => u.userId === user.userId
  );
  if (!stillConnected) {
    User.findByIdAndUpdate(user.userId, { lastSeenAt: new Date() }).catch(() => {});
  }

  logger.info("User disconnected", { userId: user.userId, socketId: socket.id });
}

export function handleJoinMedia(
  socket: any,
  user: AuthenticatedUser,
  mediaId: string
): void {
  socket.join(`media:${mediaId}`);
  logger.debug("User joined media room", { userId: user.userId, mediaId });
}

export function handleLeaveMedia(socket: any, mediaId: string): void {
  socket.leave(`media:${mediaId}`);
  logger.debug("User left media room", {
    userId: socket.data.user.userId,
    mediaId,
  });
}

export function handleJoinContent(
  ctx: SocketContext,
  socket: any,
  user: AuthenticatedUser,
  data: { contentId: string; contentType: string }
): void {
  const { contentId, contentType } = data;
  const roomId = `content:${contentType}:${contentId}`;
  socket.join(roomId);

  const viewerCount = ctx.io.sockets.adapter.rooms.get(roomId)?.size || 0;
  // Live presence only — NEVER confuse with durable Mongo viewCount.
  ctx.io.to(roomId).emit("viewer-count-update", {
    contentId,
    contentType,
    viewerCount,
    kind: "live_presence",
  });

  logger.debug("User joined content room", {
    userId: user.userId,
    contentId,
    contentType,
    roomId,
    viewerCount,
  });
}

export function handleLeaveContent(
  ctx: SocketContext,
  socket: any,
  data: { contentId: string; contentType: string }
): void {
  const { contentId, contentType } = data;
  const roomId = `content:${contentType}:${contentId}`;
  socket.leave(roomId);

  const viewerCount = ctx.io.sockets.adapter.rooms.get(roomId)?.size || 0;
  // Live presence only — NEVER confuse with durable Mongo viewCount.
  ctx.io.to(roomId).emit("viewer-count-update", {
    contentId,
    contentType,
    viewerCount,
    kind: "live_presence",
  });

  logger.debug("User left content room", {
    userId: socket.data.user.userId,
    contentId,
    contentType,
    roomId,
    viewerCount,
  });
}

export function handleJoinStream(
  ctx: SocketContext,
  socket: any,
  user: AuthenticatedUser,
  data: ViewerData
): void {
  const { streamId } = data;
  socket.join(`stream:${streamId}`);

  if (!ctx.streamViewers.has(streamId)) {
    ctx.streamViewers.set(streamId, new Set());
  }
  ctx.streamViewers.get(streamId)!.add(user.userId);

  const viewerCount = ctx.streamViewers.get(streamId)!.size;
  ctx.io.to(`stream:${streamId}`).emit("viewer-joined", {
    streamId,
    userId: user.userId,
    viewerCount,
  });

  logger.info("User joined live stream", { userId: user.userId, streamId, viewerCount });
}

export function handleLeaveStream(
  ctx: SocketContext,
  socket: any,
  user: AuthenticatedUser,
  data: ViewerData
): void {
  const { streamId } = data;
  socket.leave(`stream:${streamId}`);

  const viewers = ctx.streamViewers.get(streamId);
  if (viewers) {
    viewers.delete(user.userId);
    ctx.io.to(`stream:${streamId}`).emit("viewer-left", {
      streamId,
      userId: user.userId,
      viewerCount: viewers.size,
    });
  }

  logger.info("User left live stream", { userId: user.userId, streamId });
}
