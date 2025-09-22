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
exports.InteractionAPI = void 0;
const tokenUtils_1 = __importDefault(require("../utils/tokenUtils"));
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "https://jevahapp-backend.onrender.com";
class InteractionAPI {
    /**
     * Toggle like on any content type
     * @param contentId - The ID of the content to like/unlike
     * @param contentType - The type of content (media, devotional, artist, merch, ebook, podcast)
     * @returns Promise<LikeResponse>
     */
    static toggleLike(contentId, contentType) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(`🔄 Toggling like for ${contentType}:${contentId}`);
                const response = yield fetch(`${API_BASE_URL}/api/content/${contentType}/${contentId}/like`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${yield tokenUtils_1.default.getAuthToken()}`,
                    },
                });
                if (!response.ok) {
                    const errorData = yield response.json();
                    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
                }
                const data = yield response.json();
                console.log(`✅ Like toggled successfully:`, data);
                return data;
            }
            catch (error) {
                console.error("❌ Toggle like error:", error);
                throw error;
            }
        });
    }
    /**
     * Toggle bookmark on media
     * @param mediaId - The ID of the media to bookmark/unbookmark
     * @returns Promise<BookmarkResponse>
     */
    static toggleBookmark(mediaId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(`🔄 Toggling bookmark for media:${mediaId}`);
                const response = yield fetch(`${API_BASE_URL}/api/bookmark/${mediaId}/toggle`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${yield tokenUtils_1.default.getAuthToken()}`,
                    },
                });
                if (!response.ok) {
                    const errorData = yield response.json();
                    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
                }
                const data = yield response.json();
                console.log(`✅ Bookmark toggled successfully:`, data);
                return data;
            }
            catch (error) {
                console.error("❌ Toggle bookmark error:", error);
                throw error;
            }
        });
    }
    /**
     * Get bookmark status for media
     * @param mediaId - The ID of the media to check
     * @returns Promise<BookmarkStatusResponse>
     */
    static getBookmarkStatus(mediaId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(`🔄 Getting bookmark status for media:${mediaId}`);
                const response = yield fetch(`${API_BASE_URL}/api/bookmark/${mediaId}/status`, {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${yield tokenUtils_1.default.getAuthToken()}`,
                    },
                });
                if (!response.ok) {
                    const errorData = yield response.json();
                    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
                }
                const data = yield response.json();
                console.log(`✅ Bookmark status retrieved:`, data);
                return data;
            }
            catch (error) {
                console.error("❌ Get bookmark status error:", error);
                throw error;
            }
        });
    }
    /**
     * Get user's bookmarks
     * @param page - Page number (default: 1)
     * @param limit - Items per page (default: 20)
     * @returns Promise<UserBookmarksResponse>
     */
    static getUserBookmarks() {
        return __awaiter(this, arguments, void 0, function* (page = 1, limit = 20) {
            try {
                console.log(`🔄 Getting user bookmarks (page: ${page}, limit: ${limit})`);
                const response = yield fetch(`${API_BASE_URL}/api/bookmark/user?page=${page}&limit=${limit}`, {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${yield tokenUtils_1.default.getAuthToken()}`,
                    },
                });
                if (!response.ok) {
                    const errorData = yield response.json();
                    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
                }
                const data = yield response.json();
                console.log(`✅ User bookmarks retrieved:`, data);
                return data;
            }
            catch (error) {
                console.error("❌ Get user bookmarks error:", error);
                throw error;
            }
        });
    }
    /**
     * Get bookmark statistics for media
     * @param mediaId - The ID of the media to get stats for
     * @returns Promise<any>
     */
    static getBookmarkStats(mediaId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(`🔄 Getting bookmark stats for media:${mediaId}`);
                const response = yield fetch(`${API_BASE_URL}/api/bookmark/${mediaId}/stats`, {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${yield tokenUtils_1.default.getAuthToken()}`,
                    },
                });
                if (!response.ok) {
                    const errorData = yield response.json();
                    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
                }
                const data = yield response.json();
                console.log(`✅ Bookmark stats retrieved:`, data);
                return data;
            }
            catch (error) {
                console.error("❌ Get bookmark stats error:", error);
                throw error;
            }
        });
    }
    /**
     * Bulk bookmark operations
     * @param mediaIds - Array of media IDs
     * @param action - 'add' or 'remove'
     * @returns Promise<any>
     */
    static bulkBookmark(mediaIds, action) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(`🔄 Bulk bookmark ${action} for ${mediaIds.length} items`);
                const response = yield fetch(`${API_BASE_URL}/api/bookmark/bulk`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${yield tokenUtils_1.default.getAuthToken()}`,
                    },
                    body: JSON.stringify({
                        mediaIds,
                        action,
                    }),
                });
                if (!response.ok) {
                    const errorData = yield response.json();
                    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
                }
                const data = yield response.json();
                console.log(`✅ Bulk bookmark ${action} completed:`, data);
                return data;
            }
            catch (error) {
                console.error(`❌ Bulk bookmark ${action} error:`, error);
                throw error;
            }
        });
    }
    /**
     * Get content metadata including interaction counts
     * @param contentId - The ID of the content
     * @param contentType - The type of content
     * @returns Promise<any>
     */
    static getContentMetadata(contentId, contentType) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(`🔄 Getting content metadata for ${contentType}:${contentId}`);
                const response = yield fetch(`${API_BASE_URL}/api/content/${contentType}/${contentId}/metadata`, {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${yield tokenUtils_1.default.getAuthToken()}`,
                    },
                });
                if (!response.ok) {
                    const errorData = yield response.json();
                    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
                }
                const data = yield response.json();
                console.log(`✅ Content metadata retrieved:`, data);
                return data;
            }
            catch (error) {
                console.error("❌ Get content metadata error:", error);
                throw error;
            }
        });
    }
    /**
     * Share content
     * @param contentId - The ID of the content to share
     * @param contentType - The type of content
     * @param platform - The platform to share to (optional)
     * @returns Promise<any>
     */
    static shareContent(contentId, contentType, platform) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(`🔄 Sharing ${contentType}:${contentId}${platform ? ` to ${platform}` : ""}`);
                const response = yield fetch(`${API_BASE_URL}/api/content/${contentType}/${contentId}/share`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${yield tokenUtils_1.default.getAuthToken()}`,
                    },
                    body: JSON.stringify({
                        platform,
                    }),
                });
                if (!response.ok) {
                    const errorData = yield response.json();
                    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
                }
                const data = yield response.json();
                console.log(`✅ Content shared successfully:`, data);
                return data;
            }
            catch (error) {
                console.error("❌ Share content error:", error);
                throw error;
            }
        });
    }
    /**
     * Add comment to content
     * @param contentId - The ID of the content
     * @param contentType - The type of content
     * @param content - The comment content
     * @param parentCommentId - Parent comment ID for replies (optional)
     * @returns Promise<any>
     */
    static addComment(contentId, contentType, content, parentCommentId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(`🔄 Adding comment to ${contentType}:${contentId}`);
                const response = yield fetch(`${API_BASE_URL}/api/content/${contentType}/${contentId}/comment`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${yield tokenUtils_1.default.getAuthToken()}`,
                    },
                    body: JSON.stringify({
                        content,
                        parentCommentId,
                    }),
                });
                if (!response.ok) {
                    const errorData = yield response.json();
                    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
                }
                const data = yield response.json();
                console.log(`✅ Comment added successfully:`, data);
                return data;
            }
            catch (error) {
                console.error("❌ Add comment error:", error);
                throw error;
            }
        });
    }
    /**
     * Get comments for content
     * @param contentId - The ID of the content
     * @param contentType - The type of content
     * @param page - Page number (default: 1)
     * @param limit - Items per page (default: 20)
     * @returns Promise<any>
     */
    static getComments(contentId_1, contentType_1) {
        return __awaiter(this, arguments, void 0, function* (contentId, contentType, page = 1, limit = 20) {
            try {
                console.log(`🔄 Getting comments for ${contentType}:${contentId} (page: ${page}, limit: ${limit})`);
                const response = yield fetch(`${API_BASE_URL}/api/content/${contentType}/${contentId}/comments?page=${page}&limit=${limit}`, {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${yield tokenUtils_1.default.getAuthToken()}`,
                    },
                });
                if (!response.ok) {
                    const errorData = yield response.json();
                    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
                }
                const data = yield response.json();
                console.log(`✅ Comments retrieved:`, data);
                return data;
            }
            catch (error) {
                console.error("❌ Get comments error:", error);
                throw error;
            }
        });
    }
}
exports.InteractionAPI = InteractionAPI;
exports.default = InteractionAPI;
