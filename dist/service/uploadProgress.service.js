"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadProgressService = exports.UploadProgressService = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Upload progress service for real-time progress updates
 * Integrates with Socket.IO for WebSocket-based progress updates
 */
class UploadProgressService {
    constructor() {
        this.io = null;
        this.uploadSessions = new Map();
    }
    /**
     * Initialize with Socket.IO instance
     */
    initialize(io) {
        this.io = io;
        logger_1.default.info("Upload progress service initialized with Socket.IO");
    }
    /**
     * Send progress update to client via Socket.IO
     */
    sendProgress(progress, userId) {
        if (!this.io) {
            logger_1.default.warn("Socket.IO not initialized, cannot send progress");
            return;
        }
        try {
            // Send to specific user room if userId provided
            if (userId) {
                this.io.to(`user:${userId}`).emit("upload-progress", progress);
            }
            else {
                // Broadcast to all (fallback, not recommended for production)
                this.io.emit("upload-progress", progress);
            }
            logger_1.default.debug("Progress sent", {
                uploadId: progress.uploadId,
                progress: progress.progress,
                stage: progress.stage,
            });
        }
        catch (error) {
            logger_1.default.error("Error sending progress update:", error);
        }
    }
    /**
     * Register an upload session
     */
    registerUploadSession(uploadId, userId) {
        this.uploadSessions.set(uploadId, {
            userId,
            startTime: new Date(),
        });
    }
    /**
     * Get upload session info
     */
    getUploadSession(uploadId) {
        return this.uploadSessions.get(uploadId) || null;
    }
    /**
     * Clear upload session
     */
    clearUploadSession(uploadId) {
        this.uploadSessions.delete(uploadId);
    }
    /**
     * Cleanup old sessions (older than 1 hour)
     */
    cleanupOldSessions() {
        const oneHourAgo = Date.now() - 3600000;
        for (const [uploadId, session] of this.uploadSessions.entries()) {
            if (session.startTime.getTime() < oneHourAgo) {
                this.uploadSessions.delete(uploadId);
                logger_1.default.debug("Cleaned up old upload session", { uploadId });
            }
        }
    }
}
exports.UploadProgressService = UploadProgressService;
// Export singleton instance
exports.uploadProgressService = new UploadProgressService();
