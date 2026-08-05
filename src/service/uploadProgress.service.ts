import { Server as SocketIOServer } from "socket.io";
import logger from "../utils/logger";
import { VerificationProgress } from "./optimizedVerification.service";

export type UploadProgressSnapshot = VerificationProgress & {
  mediaId?: string;
  userId?: string;
};

/** Map internal stages → FE contract stages (see FRONTEND_UPLOAD_PROGRESS_HANDOFF). */
const STAGE_ALIASES: Record<string, string> = {
  file_received: "received",
  received: "received",
  uploading: "uploading",
  validating: "processing",
  analyzing: "processing",
  processing: "processing",
  moderating: "verifying",
  verifying: "verifying",
  scanning: "scanning",
  finalizing: "finalizing",
  under_review: "complete",
  complete: "complete",
  rejected: "rejected",
  error: "error",
};

function normalizeStage(stage: string): string {
  const key = String(stage || "").toLowerCase();
  return STAGE_ALIASES[key] || key || "processing";
}

/**
 * Upload progress service for real-time progress updates.
 * Correlates with FE via X-Upload-ID → uploadId on every event.
 */
export class UploadProgressService {
  private io: SocketIOServer | null = null;
  private uploadSessions: Map<
    string,
    {
      userId: string;
      startTime: Date;
      lastProgress: number;
      last?: UploadProgressSnapshot;
      mediaId?: string;
    }
  > = new Map();

  initialize(io: SocketIOServer): void {
    this.io = io;
    logger.info("Upload progress service initialized with Socket.IO");
  }

  /**
   * Accept client X-Upload-ID when present; otherwise generate a server id.
   */
  resolveUploadId(headerValue: unknown): string {
    const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const fromClient =
      typeof raw === "string" ? raw.trim().slice(0, 128) : "";
    if (fromClient && /^[A-Za-z0-9_-]+$/.test(fromClient)) {
      return fromClient;
    }
    return `upload_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  registerUploadSession(uploadId: string, userId: string): void {
    const existing = this.uploadSessions.get(uploadId);
    this.uploadSessions.set(uploadId, {
      userId,
      startTime: existing?.startTime || new Date(),
      lastProgress: existing?.lastProgress ?? 0,
      last: existing?.last,
      mediaId: existing?.mediaId,
    });
  }

  getUploadSession(
    uploadId: string
  ): { userId: string; startTime: Date; last?: UploadProgressSnapshot } | null {
    const s = this.uploadSessions.get(uploadId);
    if (!s) return null;
    return { userId: s.userId, startTime: s.startTime, last: s.last };
  }

  getProgressStatus(
    uploadId: string,
    requestingUserId: string
  ): UploadProgressSnapshot | null {
    const s = this.uploadSessions.get(uploadId);
    if (!s || s.userId !== requestingUserId) return null;
    return (
      s.last || {
        uploadId,
        progress: 0,
        stage: "received",
        message: "Waiting for upload…",
        timestamp: new Date().toISOString(),
        userId: s.userId,
        mediaId: s.mediaId,
      }
    );
  }

  setMediaId(uploadId: string, mediaId: string): void {
    const s = this.uploadSessions.get(uploadId);
    if (s) {
      s.mediaId = mediaId;
      if (s.last) s.last.mediaId = mediaId;
    }
  }

  /**
   * Send progress update — monotonic progress, FE-normalized stage names.
   */
  sendProgress(progress: VerificationProgress, userId?: string): void {
    const session = this.uploadSessions.get(progress.uploadId);
    const resolvedUserId = userId || session?.userId;
    const stage = normalizeStage(progress.stage);
    let nextProgress = Math.max(
      0,
      Math.min(100, Math.round(Number(progress.progress) || 0))
    );

    // Terminal stages may reset display value but never regress mid-flight
    // except error/rejected which keep last progress when FE sends 0.
    if (session && stage !== "error" && stage !== "rejected") {
      nextProgress = Math.max(session.lastProgress, nextProgress);
    } else if (
      session &&
      (stage === "error" || stage === "rejected") &&
      nextProgress === 0
    ) {
      nextProgress = session.lastProgress || 0;
    }

    const payload: UploadProgressSnapshot = {
      uploadId: progress.uploadId,
      progress: nextProgress,
      stage,
      message: progress.message || "",
      timestamp: progress.timestamp || new Date().toISOString(),
      userId: resolvedUserId,
      mediaId: session?.mediaId,
    };

    if (session) {
      session.lastProgress = nextProgress;
      session.last = payload;
      if (resolvedUserId) session.userId = resolvedUserId;
    }

    if (!this.io) {
      logger.warn("Socket.IO not initialized, cannot send progress", {
        uploadId: payload.uploadId,
      });
      return;
    }

    try {
      if (resolvedUserId) {
        this.io.to(`user:${resolvedUserId}`).emit("upload-progress", payload);
      } else {
        this.io.emit("upload-progress", payload);
      }

      logger.debug("Progress sent", {
        uploadId: payload.uploadId,
        progress: payload.progress,
        stage: payload.stage,
      });
    } catch (error: any) {
      logger.error("Error sending progress update:", error);
    }
  }

  clearUploadSession(uploadId: string, delayMs = 0): void {
    if (delayMs <= 0) {
      this.uploadSessions.delete(uploadId);
      return;
    }
    // Keep pollable briefly after complete so FE can catch final state
    setTimeout(() => {
      this.uploadSessions.delete(uploadId);
    }, delayMs);
  }

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

export const uploadProgressService = new UploadProgressService();
