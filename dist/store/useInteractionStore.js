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
exports.useInteractionStore = void 0;
const zustand_1 = require("zustand");
const middleware_1 = require("zustand/middleware");
const async_storage_1 = __importDefault(require("@react-native-async-storage/async-storage"));
const tokenUtils_1 = __importDefault(require("../utils/tokenUtils"));
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "https://jevahapp-backend.onrender.com";
exports.useInteractionStore = (0, zustand_1.create)()((0, middleware_1.persist)((set, get) => ({
    // Initial state
    userLikes: {},
    likeCounts: {},
    userBookmarks: {},
    bookmarkCounts: {},
    loadingLikes: {},
    loadingBookmarks: {},
    // Toggle like with optimistic updates
    toggleLike: (contentId, contentType) => __awaiter(void 0, void 0, void 0, function* () {
        const { userLikes, likeCounts, loadingLikes } = get();
        const currentLiked = userLikes[contentId] || false;
        const currentCount = likeCounts[contentId] || 0;
        // Prevent multiple simultaneous requests
        if (loadingLikes[contentId]) {
            console.log("Like request already in progress for:", contentId);
            return;
        }
        // Set loading state
        set({
            loadingLikes: Object.assign(Object.assign({}, loadingLikes), { [contentId]: true }),
        });
        // Optimistic update
        set({
            userLikes: Object.assign(Object.assign({}, userLikes), { [contentId]: !currentLiked }),
            likeCounts: Object.assign(Object.assign({}, likeCounts), { [contentId]: currentCount + (currentLiked ? -1 : 1) }),
        });
        try {
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
            // Update with server response
            set({
                userLikes: Object.assign(Object.assign({}, get().userLikes), { [contentId]: data.data.liked }),
                likeCounts: Object.assign(Object.assign({}, get().likeCounts), { [contentId]: data.data.likeCount }),
            });
            console.log("✅ Like toggled successfully:", {
                contentId,
                contentType,
                liked: data.data.liked,
                count: data.data.likeCount,
            });
        }
        catch (error) {
            console.error("❌ Like toggle error:", error);
            // Rollback optimistic update
            set({
                userLikes: Object.assign(Object.assign({}, get().userLikes), { [contentId]: currentLiked }),
                likeCounts: Object.assign(Object.assign({}, get().likeCounts), { [contentId]: currentCount }),
            });
            throw error;
        }
        finally {
            // Clear loading state
            set({
                loadingLikes: Object.assign(Object.assign({}, get().loadingLikes), { [contentId]: false }),
            });
        }
    }),
    // Toggle bookmark with optimistic updates
    toggleBookmark: (mediaId) => __awaiter(void 0, void 0, void 0, function* () {
        const { userBookmarks, bookmarkCounts, loadingBookmarks } = get();
        const currentBookmarked = userBookmarks[mediaId] || false;
        const currentCount = bookmarkCounts[mediaId] || 0;
        // Prevent multiple simultaneous requests
        if (loadingBookmarks[mediaId]) {
            console.log("Bookmark request already in progress for:", mediaId);
            return;
        }
        // Set loading state
        set({
            loadingBookmarks: Object.assign(Object.assign({}, loadingBookmarks), { [mediaId]: true }),
        });
        // Optimistic update
        set({
            userBookmarks: Object.assign(Object.assign({}, userBookmarks), { [mediaId]: !currentBookmarked }),
            bookmarkCounts: Object.assign(Object.assign({}, bookmarkCounts), { [mediaId]: currentCount + (currentBookmarked ? -1 : 1) }),
        });
        try {
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
            // Update with server response
            set({
                userBookmarks: Object.assign(Object.assign({}, get().userBookmarks), { [mediaId]: data.data.bookmarked }),
                bookmarkCounts: Object.assign(Object.assign({}, get().bookmarkCounts), { [mediaId]: data.data.bookmarkCount }),
            });
            console.log("✅ Bookmark toggled successfully:", {
                mediaId,
                bookmarked: data.data.bookmarked,
                count: data.data.bookmarkCount,
            });
        }
        catch (error) {
            console.error("❌ Bookmark toggle error:", error);
            // Rollback optimistic update
            set({
                userBookmarks: Object.assign(Object.assign({}, get().userBookmarks), { [mediaId]: currentBookmarked }),
                bookmarkCounts: Object.assign(Object.assign({}, get().bookmarkCounts), { [mediaId]: currentCount }),
            });
            throw error;
        }
        finally {
            // Clear loading state
            set({
                loadingBookmarks: Object.assign(Object.assign({}, get().loadingBookmarks), { [mediaId]: false }),
            });
        }
    }),
    // Set like status (for real-time updates)
    setLikeStatus: (contentId, liked, count) => {
        set({
            userLikes: Object.assign(Object.assign({}, get().userLikes), { [contentId]: liked }),
            likeCounts: Object.assign(Object.assign({}, get().likeCounts), { [contentId]: count }),
        });
    },
    // Set bookmark status (for real-time updates)
    setBookmarkStatus: (mediaId, bookmarked, count) => {
        set({
            userBookmarks: Object.assign(Object.assign({}, get().userBookmarks), { [mediaId]: bookmarked }),
            bookmarkCounts: Object.assign(Object.assign({}, get().bookmarkCounts), { [mediaId]: count }),
        });
    },
    // Load user interactions on app start
    loadUserInteractions: () => __awaiter(void 0, void 0, void 0, function* () {
        try {
            console.log("🔄 Loading user interactions from storage...");
            // This would typically load from a user-specific endpoint
            // For now, we'll load from persisted storage
            console.log("✅ User interactions loaded from storage");
        }
        catch (error) {
            console.error("❌ Error loading user interactions:", error);
        }
    }),
    // Clear all interactions (for logout)
    clearInteractions: () => {
        set({
            userLikes: {},
            likeCounts: {},
            userBookmarks: {},
            bookmarkCounts: {},
            loadingLikes: {},
            loadingBookmarks: {},
        });
        console.log("🧹 Cleared all interactions");
    },
    // Get like status for a content item
    getLikeStatus: (contentId) => {
        const { userLikes, likeCounts } = get();
        return {
            isLiked: userLikes[contentId] || false,
            count: likeCounts[contentId] || 0,
        };
    },
    // Get bookmark status for a media item
    getBookmarkStatus: (mediaId) => {
        const { userBookmarks, bookmarkCounts } = get();
        return {
            isBookmarked: userBookmarks[mediaId] || false,
            count: bookmarkCounts[mediaId] || 0,
        };
    },
}), {
    name: "interaction-storage",
    storage: (0, middleware_1.createJSONStorage)(() => async_storage_1.default),
    partialize: state => ({
        userLikes: state.userLikes,
        likeCounts: state.likeCounts,
        userBookmarks: state.userBookmarks,
        bookmarkCounts: state.bookmarkCounts,
    }),
}));
