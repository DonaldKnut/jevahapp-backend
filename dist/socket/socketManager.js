"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIO = getIO;
/**
 * Socket Manager Utility
 * Provides access to Socket.IO server instance for emitting events
 */
class SocketManager {
    constructor() {
        this.io = null;
        // Private constructor for singleton pattern
    }
    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!SocketManager.instance) {
            SocketManager.instance = new SocketManager();
        }
        return SocketManager.instance;
    }
    /**
     * Initialize with Socket.IO server instance
     */
    setIO(io) {
        this.io = io;
    }
    /**
     * Get Socket.IO server instance
     * Uses lazy import to avoid circular dependencies
     */
    getIO() {
        if (!this.io) {
            try {
                // Lazy import to avoid circular dependency
                const { socketService } = require("../app");
                if (socketService) {
                    this.io = socketService.getIO();
                }
            }
            catch (error) {
                // Socket service not initialized yet
                return null;
            }
        }
        return this.io;
    }
}
// Export singleton instance
const socketManager = SocketManager.getInstance();
/**
 * Get Socket.IO server instance
 * This is the main export used by controllers
 */
function getIO() {
    return socketManager.getIO();
}
exports.default = socketManager;
