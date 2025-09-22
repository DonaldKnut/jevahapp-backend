"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const socket_io_client_1 = __importDefault(require("socket.io-client"));
const async_storage_1 = __importDefault(require("@react-native-async-storage/async-storage"));
const useInteractionStore_1 = require("../store/useInteractionStore");
class SocketManager {
    constructor(config) {
        this.socket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.eventHandlers = {};
        this.serverUrl = config.serverUrl;
        this.authToken = config.authToken;
    }
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.socket = (0, socket_io_client_1.default)(this.serverUrl, {
                    auth: {
                        token: this.authToken,
                    },
                    transports: ["websocket", "polling"],
                    timeout: 20000,
                });
                this.setupEventHandlers();
                console.log("✅ Connected to real-time server");
            }
            catch (error) {
                console.error("❌ Failed to connect to real-time server:", error);
                throw error;
            }
        });
    }
    setupEventHandlers() {
        if (!this.socket)
            return;
        // Connection events
        this.socket.on("connect", () => {
            console.log("🔌 Connected to real-time server");
            this.reconnectAttempts = 0;
        });
        this.socket.on("disconnect", reason => {
            console.log("🔌 Disconnected from real-time server:", reason);
            this.handleReconnect();
        });
        this.socket.on("connect_error", error => {
            console.error("❌ Connection error:", error);
            this.handleReconnect();
        });
        // Real-time interaction events
        this.socket.on("content-like-update", data => {
            console.log("📡 Real-time like update received:", data);
            this.handleContentLikeUpdate(data);
        });
        this.socket.on("content-bookmark-update", data => {
            console.log("📡 Real-time bookmark update received:", data);
            this.handleContentBookmarkUpdate(data);
        });
        this.socket.on("content-comment", data => {
            console.log("📡 Real-time comment received:", data);
            this.handleContentComment(data);
        });
        this.socket.on("content-share", data => {
            console.log("📡 Real-time share received:", data);
            this.handleContentShare(data);
        });
        // Legacy event handlers for backward compatibility
        this.socket.on("content-reaction", data => {
            console.log("📡 Real-time reaction received:", data);
            this.handleContentReaction(data);
        });
        this.socket.on("new-comment", data => {
            console.log("📡 New comment received:", data);
            this.handleNewComment(data);
        });
        this.socket.on("media-reaction", data => {
            console.log("📡 Media reaction received:", data);
            this.handleMediaReaction(data);
        });
        // User presence events
        this.socket.on("user-presence", data => {
            console.log("📡 User presence update:", data);
            this.handleUserPresence(data);
        });
        // Live stream events
        this.socket.on("stream-update", data => {
            console.log("📡 Stream update received:", data);
            this.handleStreamUpdate(data);
        });
        // Typing indicators
        this.socket.on("user-typing", data => {
            console.log("📡 User typing:", data);
            this.handleTypingIndicator(data);
        });
        // Notification events
        this.socket.on("new_notification", data => {
            console.log("📡 New notification received:", data);
            this.handleNewNotification(data);
        });
    }
    handleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
            console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`);
            setTimeout(() => {
                this.connect().catch(error => {
                    console.error("❌ Reconnection failed:", error);
                });
            }, delay);
        }
        else {
            console.error("❌ Max reconnection attempts reached");
        }
    }
    // Real-time interaction event handlers
    handleContentLikeUpdate(data) {
        // Update Zustand store
        useInteractionStore_1.useInteractionStore
            .getState()
            .setLikeStatus(data.contentId, data.userLiked, data.likeCount);
        // Call custom handler if provided
        if (this.eventHandlers.onContentReaction) {
            this.eventHandlers.onContentReaction(data);
        }
    }
    handleContentBookmarkUpdate(data) {
        // Update Zustand store
        useInteractionStore_1.useInteractionStore
            .getState()
            .setBookmarkStatus(data.mediaId, data.userBookmarked, data.bookmarkCount);
        // Call custom handler if provided
        if (this.eventHandlers.onBookmarkUpdate) {
            this.eventHandlers.onBookmarkUpdate(data);
        }
    }
    handleContentComment(data) {
        if (this.eventHandlers.onContentComment) {
            this.eventHandlers.onContentComment(data);
        }
    }
    handleContentShare(data) {
        if (this.eventHandlers.onShareUpdate) {
            this.eventHandlers.onShareUpdate(data);
        }
    }
    // Legacy event handlers
    handleContentReaction(data) {
        if (this.eventHandlers.onContentReaction) {
            this.eventHandlers.onContentReaction(data);
        }
    }
    handleNewComment(data) {
        if (this.eventHandlers.onContentComment) {
            this.eventHandlers.onContentComment(data);
        }
    }
    handleMediaReaction(data) {
        if (this.eventHandlers.onContentReaction) {
            this.eventHandlers.onContentReaction(data);
        }
    }
    handleUserPresence(data) {
        // Handle user presence updates
        console.log("User presence:", data);
    }
    handleStreamUpdate(data) {
        // Handle live stream updates
        console.log("Stream update:", data);
    }
    handleTypingIndicator(data) {
        // Handle typing indicators
        console.log("Typing indicator:", data);
    }
    handleNewNotification(data) {
        // Handle new notifications
        console.log("New notification:", data);
    }
    // Public methods for sending events
    sendLike(contentId, contentType) {
        if (this.socket && this.socket.connected) {
            this.socket.emit("content-like", {
                contentId,
                contentType,
                timestamp: new Date().toISOString(),
            });
        }
    }
    sendBookmark(mediaId) {
        if (this.socket && this.socket.connected) {
            this.socket.emit("content-bookmark", {
                mediaId,
                timestamp: new Date().toISOString(),
            });
        }
    }
    sendComment(contentId, contentType, comment) {
        if (this.socket && this.socket.connected) {
            this.socket.emit("content-comment", {
                contentId,
                contentType,
                comment,
                timestamp: new Date().toISOString(),
            });
        }
    }
    sendShare(contentId, contentType, platform) {
        if (this.socket && this.socket.connected) {
            this.socket.emit("content-share", {
                contentId,
                contentType,
                platform,
                timestamp: new Date().toISOString(),
            });
        }
    }
    // Room management
    joinContentRoom(contentId, contentType) {
        if (this.socket && this.socket.connected) {
            this.socket.emit("join-content", { contentId, contentType });
            console.log(`📡 Joined room: ${contentType}:${contentId}`);
        }
    }
    leaveContentRoom(contentId, contentType) {
        if (this.socket && this.socket.connected) {
            this.socket.emit("leave-content", { contentId, contentType });
            console.log(`📡 Left room: ${contentType}:${contentId}`);
        }
    }
    joinUserRoom(userId) {
        if (this.socket && this.socket.connected) {
            this.socket.emit("join-user", { userId });
            console.log(`📡 Joined user room: ${userId}`);
        }
    }
    leaveUserRoom(userId) {
        if (this.socket && this.socket.connected) {
            this.socket.emit("leave-user", { userId });
            console.log(`📡 Left user room: ${userId}`);
        }
    }
    // Set custom event handlers
    setEventHandlers(handlers) {
        this.eventHandlers = Object.assign(Object.assign({}, this.eventHandlers), handlers);
    }
    // Connection status
    isConnected() {
        var _a;
        return ((_a = this.socket) === null || _a === void 0 ? void 0 : _a.connected) || false;
    }
    getConnectionState() {
        if (!this.socket)
            return "disconnected";
        return this.socket.connected ? "connected" : "disconnected";
    }
    // Cleanup
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            console.log("🔌 Disconnected from real-time server");
        }
    }
    // Utility methods
    getAuthToken() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield async_storage_1.default.getItem("auth_token");
            }
            catch (error) {
                console.error("Error getting auth token:", error);
                return null;
            }
        });
    }
    setAuthToken(token) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield async_storage_1.default.setItem("auth_token", token);
                this.authToken = token;
            }
            catch (error) {
                console.error("Error setting auth token:", error);
            }
        });
    }
    // Reconnect with new token
    reconnectWithToken(token) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.setAuthToken(token);
            this.disconnect();
            yield this.connect();
        });
    }
}
exports.default = SocketManager;
