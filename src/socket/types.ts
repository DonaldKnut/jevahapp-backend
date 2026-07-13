import { Server as SocketIOServer } from "socket.io";

export interface AuthenticatedUser {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
}

export interface CommentData {
  mediaId: string;
  content: string;
  parentCommentId?: string;
}

export interface ReactionData {
  mediaId: string;
  actionType: "like" | "dislike" | "favorite" | "share";
}

export interface ViewerData {
  streamId: string;
  action: "join" | "leave";
}

export interface SocketContext {
  io: SocketIOServer;
  connectedUsers: Map<string, AuthenticatedUser>;
  streamViewers: Map<string, Set<string>>;
}
