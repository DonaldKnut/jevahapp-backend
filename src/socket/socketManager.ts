import { Server as SocketIOServer } from "socket.io";

/**
 * Socket Manager Utility
 * Provides access to Socket.IO server instance for emitting events
 */
class SocketManager {
  private static instance: SocketManager;
  private io: SocketIOServer | null = null;

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager();
    }
    return SocketManager.instance;
  }

  /**
   * Initialize with Socket.IO server instance
   */
  public setIO(io: SocketIOServer): void {
    this.io = io;
  }

  /**
   * Get Socket.IO server instance
   * Uses lazy import to avoid circular dependencies
   */
  public getIO(): SocketIOServer | null {
    if (!this.io) {
      try {
        // Lazy import to avoid circular dependency
        const { socketService } = require("../app");
        if (socketService) {
          this.io = socketService.getIO();
        }
      } catch (error) {
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
export function getIO(): SocketIOServer | null {
  return socketManager.getIO();
}

export default socketManager;

