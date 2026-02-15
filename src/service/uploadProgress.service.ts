import { Server as SocketIOServer } from "socket.io";
import logger from "../utils/logger";
import { VerificationProgress } from "./optimizedVerification.service";

/**
 * Upload progress service for real-time progress updates
 * Integrates with Socket.IO for WebSocket-based progress updates
 */
export class UploadProgressService {
  private io: SocketIOServer | null = null;
  private uploadSessions: Map<string, { userId: string; startTime: Date }> = new Map();

  /**
   * Initialize with Socket.IO instance
   */
  initialize(io: SocketIOServer): void {
    this.io = io;
    logger.info("Upload progress service initialized with Socket.IO");
  }

  /**
   * Send progress update to client via Socket.IO
   */
  sendProgress(progress: VerificationProgress, userId?: string): void {
    if (!this.io) {
      logger.warn("Socket.IO not initialized, cannot send progress");
      return;
    }

    try {
      // Send to specific user room if userId provided
      if (userId) {
        this.io.to(`user:${userId}`).emit("upload-progress", progress);
      } else {
        // Broadcast to all (fallback, not recommended for production)
        this.io.emit("upload-progress", progress);
      }

      logger.debug("Progress sent", {
        uploadId: progress.uploadId,
        progress: progress.progress,
        stage: progress.stage,
      });
    } catch (error: any) {
      logger.error("Error sending progress update:", error);
    }
  }

  /**
   * Register an upload session
   */
  registerUploadSession(uploadId: string, userId: string): void {
    this.uploadSessions.set(uploadId, {
      userId,
      startTime: new Date(),
    });
  }

  /**
   * Get upload session info
   */
  getUploadSession(uploadId: string): { userId: string; startTime: Date } | null {
    return this.uploadSessions.get(uploadId) || null;
  }

  /**
   * Clear upload session
   */
  clearUploadSession(uploadId: string): void {
    this.uploadSessions.delete(uploadId);
  }

  /**
   * Cleanup old sessions (older than 1 hour)
   */
  cleanupOldSessions(): void {
    const oneHourAgo = Date.now() - 3600000;
    for (const [uploadId, session] of this.uploadSessions.entries()) {
      if (session.startTime.getTime() < oneHourAgo) {
        this.uploadSessions.delete(uploadId);
        logger.debug("Cleaned up old upload session", { uploadId });
      }
    }
  }
}

// Export singleton instance
export const uploadProgressService = new UploadProgressService();

