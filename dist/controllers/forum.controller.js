"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.deleteForumPost = exports.updateForum = exports.updateForumPost = exports.getForumPosts = exports.createForumPost = exports.listForums = exports.createForum = void 0;
const forum_model_1 = require("../models/forum.model");
const forumPost_model_1 = require("../models/forumPost.model");
const mediaInteraction_model_1 = require("../models/mediaInteraction.model");
const user_model_1 = require("../models/user.model");
const mongoose_1 = __importStar(require("mongoose"));
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Create Forum (Authenticated Users)
 */
const createForum = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { title, description, categoryId } = req.body || {};
        if (!title || typeof title !== "string" || title.trim().length < 3) {
            res.status(400).json({ success: false, error: "Validation error: title must be at least 3 characters" });
            return;
        }
        if (title.length > 100) {
            res.status(400).json({ success: false, error: "Validation error: title must be less than 100 characters" });
            return;
        }
        if (!description || typeof description !== "string" || description.trim().length < 10) {
            res.status(400).json({ success: false, error: "Validation error: description must be at least 10 characters" });
            return;
        }
        if (description.length > 500) {
            res.status(400).json({ success: false, error: "Validation error: description must be less than 500 characters" });
            return;
        }
        if (!categoryId || typeof categoryId !== "string" || !mongoose_1.Types.ObjectId.isValid(categoryId)) {
            res.status(400).json({ success: false, error: "Validation error: categoryId is required" });
            return;
        }
        // Verify category exists (legacy categories may not have isCategory flag yet)
        const category = yield forum_model_1.Forum.findOne({
            _id: new mongoose_1.Types.ObjectId(categoryId),
            isActive: true,
            $or: [{ isCategory: true }, { categoryId: { $exists: false } }],
        }).select("title description isCategory");
        if (!category) {
            res.status(400).json({ success: false, error: "Validation error: category not found" });
            return;
        }
        if (!req.userId) {
            res.status(401).json({ success: false, error: "Unauthorized: Authentication required" });
            return;
        }
        const forum = yield forum_model_1.Forum.create({
            title: title.trim(),
            description: description.trim(),
            createdBy: req.userId,
            isActive: true,
            isCategory: false,
            categoryId: category._id,
            postsCount: 0,
            participantsCount: 0,
        });
        yield forum.populate([
            { path: "createdBy", select: "firstName lastName username avatar" },
            { path: "categoryId", select: "title description" },
        ]);
        logger_1.default.info("Forum created", { forumId: forum._id, createdBy: req.userId, categoryId: category._id });
        res.status(201).json({
            success: true,
            data: serializeForum(forum),
        });
    }
    catch (error) {
        logger_1.default.error("Error creating forum", { error: error.message, userId: req.userId });
        res.status(500).json({ success: false, error: "Failed to create forum" });
    }
});
exports.createForum = createForum;
/**
 * Get All Forums
 */
const listForums = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const page = Math.max(parseInt(String(req.query.page || 1), 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(String(req.query.limit || 20), 10) || 20, 1), 100);
        const viewParam = String(req.query.view || req.query.type || "categories").toLowerCase();
        const categoryFilter = req.query.categoryId;
        const query = { isActive: true };
        // Handle categories view - return only categories (isCategory: true, categoryId: null)
        if (viewParam === "categories") {
            query.isCategory = true;
            query.$or = [
                { categoryId: null },
                { categoryId: { $exists: false } }
            ];
        }
        // Handle discussions view - return discussions under a specific category
        else if (viewParam === "discussions") {
            // categoryId is required for discussions view
            if (!categoryFilter || typeof categoryFilter !== "string" || !mongoose_1.Types.ObjectId.isValid(categoryFilter)) {
                res.status(400).json({
                    success: false,
                    error: "categoryId is required when view=discussions"
                });
                return;
            }
            query.isCategory = false;
            query.categoryId = new mongoose_1.Types.ObjectId(categoryFilter);
        }
        // Handle all view - return all active forums
        else if (viewParam === "all") {
            // No additional filtering - return all active forums
        }
        // Default to categories if view param is not recognized
        else {
            query.isCategory = true;
            query.$or = [
                { categoryId: null },
                { categoryId: { $exists: false } }
            ];
        }
        const [forums, total] = yield Promise.all([
            forum_model_1.Forum.find(query)
                .populate("createdBy", "firstName lastName username avatar")
                .populate("categoryId", "title description")
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit),
            forum_model_1.Forum.countDocuments(query),
        ]);
        res.status(200).json({
            success: true,
            data: {
                forums: forums.map(serializeForum),
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                    hasMore: page * limit < total,
                },
            },
        });
    }
    catch (error) {
        logger_1.default.error("Error listing forums", { error: error.message });
        res.status(500).json({ success: false, error: "Failed to list forums" });
    }
});
exports.listForums = listForums;
/**
 * Create Forum Post
 */
const createForumPost = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { forumId } = req.params;
        const { content, embeddedLinks, tags } = req.body || {};
        if (!mongoose_1.Types.ObjectId.isValid(forumId)) {
            res.status(400).json({ success: false, error: "Invalid forum ID" });
            return;
        }
        // Check if forum exists
        const forum = yield forum_model_1.Forum.findById(forumId);
        if (!forum || !forum.isActive) {
            res.status(404).json({ success: false, error: "Forum not found or inactive" });
            return;
        }
        if (forum.isCategory) {
            res.status(400).json({ success: false, error: "Cannot post directly to a category" });
            return;
        }
        if (!content || typeof content !== "string" || content.trim().length === 0) {
            res.status(400).json({ success: false, error: "Validation error: content is required" });
            return;
        }
        if (content.length > 5000) {
            res.status(400).json({ success: false, error: "Validation error: content must be less than 5000 characters" });
            return;
        }
        // Validate embedded links if provided
        if (embeddedLinks && Array.isArray(embeddedLinks)) {
            if (embeddedLinks.length > 5) {
                res.status(400).json({ success: false, error: "Validation error: maximum 5 embedded links allowed" });
                return;
            }
            for (const link of embeddedLinks) {
                if (!link.url || typeof link.url !== "string") {
                    res.status(400).json({ success: false, error: "Validation error: each link must have a valid URL" });
                    return;
                }
                // Validate URL format
                try {
                    new URL(link.url);
                }
                catch (_a) {
                    res.status(400).json({ success: false, error: "Validation error: invalid URL format" });
                    return;
                }
                if (!link.type || !["video", "article", "resource", "other"].includes(link.type)) {
                    res.status(400).json({ success: false, error: "Validation error: link type must be video, article, resource, or other" });
                    return;
                }
                if (link.title && link.title.length > 200) {
                    res.status(400).json({ success: false, error: "Validation error: link title must be less than 200 characters" });
                    return;
                }
                if (link.description && link.description.length > 500) {
                    res.status(400).json({ success: false, error: "Validation error: link description must be less than 500 characters" });
                    return;
                }
            }
        }
        // Validate tags if provided
        if (tags !== undefined) {
            if (!Array.isArray(tags)) {
                res.status(400).json({ success: false, error: "Validation error: tags must be an array" });
                return;
            }
            if (tags.length > 10) {
                res.status(400).json({ success: false, error: "Validation error: maximum 10 tags allowed" });
                return;
            }
            for (const tag of tags) {
                if (typeof tag !== "string" || tag.trim().length === 0) {
                    res.status(400).json({ success: false, error: "Validation error: each tag must be a non-empty string" });
                    return;
                }
                if (tag.length > 50) {
                    res.status(400).json({ success: false, error: "Validation error: each tag must be less than 50 characters" });
                    return;
                }
            }
        }
        const post = yield forumPost_model_1.ForumPost.create({
            forumId: new mongoose_1.default.Types.ObjectId(forumId),
            userId: req.userId,
            content: content.trim(),
            embeddedLinks: Array.isArray(embeddedLinks) ? embeddedLinks : undefined,
            tags: Array.isArray(tags) ? tags.map((tag) => tag.trim()) : undefined,
            likesCount: 0,
            commentsCount: 0,
        });
        // Update forum stats
        forum.postsCount = (forum.postsCount || 0) + 1;
        // Check if this is a new participant
        const existingPosts = yield forumPost_model_1.ForumPost.findOne({
            forumId: forum._id,
            userId: req.userId,
        });
        if (!existingPosts || String(existingPosts._id) === String(post._id)) {
            forum.participantsCount = (forum.participantsCount || 0) + 1;
        }
        yield forum.save();
        yield post.populate("userId", "firstName lastName username avatar");
        logger_1.default.info("Forum post created", { postId: post._id, forumId: forum._id, userId: req.userId });
        res.status(201).json({
            success: true,
            data: yield serializeForumPost(post, req.userId),
        });
    }
    catch (error) {
        logger_1.default.error("Error creating forum post", { error: error.message, forumId: req.params.forumId });
        res.status(500).json({ success: false, error: "Failed to create forum post" });
    }
});
exports.createForumPost = createForumPost;
/**
 * Get Forum Posts
 */
const getForumPosts = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { forumId } = req.params;
        const page = Math.max(parseInt(String(req.query.page || 1), 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(String(req.query.limit || 20), 10) || 20, 1), 100);
        const sortBy = String(req.query.sortBy || "createdAt");
        const sortOrder = String(req.query.sortOrder || "desc") === "asc" ? 1 : -1;
        if (!mongoose_1.Types.ObjectId.isValid(forumId)) {
            res.status(400).json({ success: false, error: "Invalid forum ID" });
            return;
        }
        // Check if forum exists
        const forum = yield forum_model_1.Forum.findById(forumId);
        if (!forum || !forum.isActive) {
            res.status(404).json({ success: false, error: "Forum not found or inactive" });
            return;
        }
        // Build sort object
        const sort = {};
        if (sortBy === "likesCount")
            sort.likesCount = sortOrder;
        else if (sortBy === "commentsCount")
            sort.commentsCount = sortOrder;
        else
            sort.createdAt = sortOrder;
        const [posts, total] = yield Promise.all([
            forumPost_model_1.ForumPost.find({ forumId: new mongoose_1.Types.ObjectId(forumId) })
                .populate("userId", "firstName lastName username avatar")
                .sort(sort)
                .skip((page - 1) * limit)
                .limit(limit),
            forumPost_model_1.ForumPost.countDocuments({ forumId: new mongoose_1.Types.ObjectId(forumId) }),
        ]);
        const userId = req.userId;
        const formattedPosts = yield Promise.all(posts.map((post) => __awaiter(void 0, void 0, void 0, function* () { return yield serializeForumPost(post, userId); })));
        res.status(200).json({
            success: true,
            data: {
                posts: formattedPosts,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                    hasMore: page * limit < total,
                },
            },
        });
    }
    catch (error) {
        logger_1.default.error("Error getting forum posts", { error: error.message, forumId: req.params.forumId });
        res.status(500).json({ success: false, error: "Failed to get forum posts" });
    }
});
exports.getForumPosts = getForumPosts;
/**
 * Update Forum Post
 */
const updateForumPost = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { postId } = req.params;
        const { content, embeddedLinks, tags } = req.body || {};
        if (!mongoose_1.Types.ObjectId.isValid(postId)) {
            res.status(400).json({ success: false, error: "Invalid post ID" });
            return;
        }
        const post = yield forumPost_model_1.ForumPost.findById(postId);
        if (!post) {
            res.status(404).json({ success: false, error: "Post not found" });
            return;
        }
        if (String(post.userId) !== String(req.userId)) {
            res.status(403).json({ success: false, error: "Forbidden: Only author can edit" });
            return;
        }
        if (content !== undefined) {
            if (typeof content !== "string" || content.trim().length === 0) {
                res.status(400).json({ success: false, error: "Validation error: content must be a non-empty string" });
                return;
            }
            if (content.length > 5000) {
                res.status(400).json({ success: false, error: "Validation error: content must be less than 5000 characters" });
                return;
            }
            post.content = content.trim();
        }
        if (embeddedLinks !== undefined) {
            if (embeddedLinks === null) {
                post.embeddedLinks = undefined;
            }
            else if (Array.isArray(embeddedLinks)) {
                if (embeddedLinks.length > 5) {
                    res.status(400).json({ success: false, error: "Validation error: maximum 5 embedded links allowed" });
                    return;
                }
                // Validate each link
                for (const link of embeddedLinks) {
                    if (!link.url || typeof link.url !== "string") {
                        res.status(400).json({ success: false, error: "Validation error: each link must have a valid URL" });
                        return;
                    }
                    try {
                        new URL(link.url);
                    }
                    catch (_a) {
                        res.status(400).json({ success: false, error: "Validation error: invalid URL format" });
                        return;
                    }
                    if (!link.type || !["video", "article", "resource", "other"].includes(link.type)) {
                        res.status(400).json({ success: false, error: "Validation error: link type must be video, article, resource, or other" });
                        return;
                    }
                }
                post.embeddedLinks = embeddedLinks;
            }
            else {
                res.status(400).json({ success: false, error: "Validation error: embeddedLinks must be an array or null" });
                return;
            }
        }
        if (tags !== undefined) {
            if (tags === null) {
                post.tags = undefined;
            }
            else if (Array.isArray(tags)) {
                if (tags.length > 10) {
                    res.status(400).json({ success: false, error: "Validation error: maximum 10 tags allowed" });
                    return;
                }
                for (const tag of tags) {
                    if (typeof tag !== "string" || tag.trim().length === 0) {
                        res.status(400).json({ success: false, error: "Validation error: each tag must be a non-empty string" });
                        return;
                    }
                    if (tag.length > 50) {
                        res.status(400).json({ success: false, error: "Validation error: each tag must be less than 50 characters" });
                        return;
                    }
                }
                post.tags = tags.map((tag) => tag.trim());
            }
            else {
                res.status(400).json({ success: false, error: "Validation error: tags must be an array or null" });
                return;
            }
        }
        yield post.save();
        yield post.populate("userId", "firstName lastName username avatar");
        logger_1.default.info("Forum post updated", { postId: post._id, userId: req.userId });
        res.status(200).json({
            success: true,
            data: yield serializeForumPost(post, req.userId),
        });
    }
    catch (error) {
        logger_1.default.error("Error updating forum post", { error: error.message, postId: req.params.postId });
        res.status(500).json({ success: false, error: "Failed to update forum post" });
    }
});
exports.updateForumPost = updateForumPost;
/**
 * Update Forum (Admin Only)
 */
const updateForum = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { forumId } = req.params;
        const { title, description } = req.body || {};
        if (!mongoose_1.Types.ObjectId.isValid(forumId)) {
            res.status(400).json({ success: false, error: "Invalid forum ID" });
            return;
        }
        if (!req.userId) {
            res.status(401).json({ success: false, error: "Unauthorized: Authentication required" });
            return;
        }
        // Check if user is admin
        const user = yield user_model_1.User.findById(req.userId);
        if (!user || user.role !== "admin") {
            res.status(403).json({ success: false, error: "Forbidden: Admin access required" });
            return;
        }
        const forum = yield forum_model_1.Forum.findById(forumId);
        if (!forum) {
            res.status(404).json({ success: false, error: "Forum not found" });
            return;
        }
        // Validate and update title if provided
        if (title !== undefined) {
            if (typeof title !== "string" || title.trim().length < 3) {
                res.status(400).json({ success: false, error: "Validation error: title must be at least 3 characters" });
                return;
            }
            if (title.length > 100) {
                res.status(400).json({ success: false, error: "Validation error: title must be less than 100 characters" });
                return;
            }
            forum.title = title.trim();
        }
        // Validate and update description if provided
        if (description !== undefined) {
            if (typeof description !== "string" || description.trim().length < 10) {
                res.status(400).json({ success: false, error: "Validation error: description must be at least 10 characters" });
                return;
            }
            if (description.length > 500) {
                res.status(400).json({ success: false, error: "Validation error: description must be less than 500 characters" });
                return;
            }
            forum.description = description.trim();
        }
        yield forum.save();
        yield forum.populate([
            { path: "createdBy", select: "firstName lastName username avatar" },
            { path: "categoryId", select: "title description" },
        ]);
        logger_1.default.info("Forum updated", { forumId: forum._id, updatedBy: req.userId });
        res.status(200).json({
            success: true,
            data: serializeForum(forum),
        });
    }
    catch (error) {
        logger_1.default.error("Error updating forum", { error: error.message, forumId: req.params.forumId, userId: req.userId });
        res.status(500).json({ success: false, error: "Failed to update forum" });
    }
});
exports.updateForum = updateForum;
/**
 * Delete Forum Post
 */
const deleteForumPost = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { postId } = req.params;
        if (!mongoose_1.Types.ObjectId.isValid(postId)) {
            res.status(400).json({ success: false, error: "Invalid post ID" });
            return;
        }
        const post = yield forumPost_model_1.ForumPost.findById(postId);
        if (!post) {
            res.status(404).json({ success: false, error: "Post not found" });
            return;
        }
        // Check if user is author or admin
        const user = yield user_model_1.User.findById(req.userId);
        const isAuthor = String(post.userId) === String(req.userId);
        const isAdmin = (user === null || user === void 0 ? void 0 : user.role) === "admin";
        if (!isAuthor && !isAdmin) {
            res.status(403).json({ success: false, error: "Forbidden: Only author or admin can delete" });
            return;
        }
        // Update forum stats
        const forum = yield forum_model_1.Forum.findById(post.forumId);
        if (forum) {
            forum.postsCount = Math.max(0, (forum.postsCount || 0) - 1);
            yield forum.save();
        }
        yield forumPost_model_1.ForumPost.findByIdAndDelete(postId);
        logger_1.default.info("Forum post deleted", { postId, userId: req.userId, isAdmin });
        res.status(200).json({
            success: true,
            message: "Post deleted successfully",
        });
    }
    catch (error) {
        logger_1.default.error("Error deleting forum post", { error: error.message, postId: req.params.postId });
        res.status(500).json({ success: false, error: "Failed to delete forum post" });
    }
});
exports.deleteForumPost = deleteForumPost;
/**
 * Serialize Forum
 */
function serializeForum(doc) {
    var _a;
    const obj = doc.toObject ? doc.toObject() : doc;
    const category = obj.categoryId && typeof obj.categoryId === "object" && obj.categoryId._id
        ? {
            id: String(obj.categoryId._id),
            title: obj.categoryId.title,
            description: obj.categoryId.description,
        }
        : obj.categoryId
            ? { id: String(obj.categoryId) }
            : null;
    return {
        id: String(obj._id),
        _id: String(obj._id),
        title: obj.title,
        description: obj.description,
        isCategory: obj.isCategory || false,
        categoryId: obj.categoryId ? String(obj.categoryId._id || obj.categoryId) : null,
        category,
        createdBy: String(((_a = obj.createdBy) === null || _a === void 0 ? void 0 : _a._id) || obj.createdBy),
        createdAt: obj.createdAt,
        updatedAt: obj.updatedAt,
        isActive: obj.isActive,
        postsCount: obj.postsCount || 0,
        participantsCount: obj.participantsCount || 0,
        createdByUser: obj.createdBy && typeof obj.createdBy === "object" && obj.createdBy._id
            ? {
                _id: String(obj.createdBy._id),
                username: obj.createdBy.username,
                avatarUrl: obj.createdBy.avatar,
                firstName: obj.createdBy.firstName,
                lastName: obj.createdBy.lastName,
            }
            : null,
    };
}
/**
 * Serialize Forum Post with user interaction data
 */
function serializeForumPost(doc, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const obj = doc.toObject ? doc.toObject() : doc;
        // Check if user liked this post
        let userLiked = false;
        if (userId && mongoose_1.Types.ObjectId.isValid(userId)) {
            const like = yield mediaInteraction_model_1.MediaInteraction.findOne({
                user: userId,
                media: obj._id,
                interactionType: "like",
            });
            userLiked = !!like;
        }
        return {
            _id: String(obj._id),
            forumId: String(((_a = obj.forumId) === null || _a === void 0 ? void 0 : _a._id) || obj.forumId),
            userId: String(((_b = obj.userId) === null || _b === void 0 ? void 0 : _b._id) || obj.userId),
            content: obj.content,
            embeddedLinks: obj.embeddedLinks || [],
            createdAt: obj.createdAt,
            updatedAt: obj.updatedAt,
            likesCount: obj.likesCount || 0,
            commentsCount: obj.commentsCount || 0,
            userLiked,
            author: obj.userId && typeof obj.userId === "object" && obj.userId._id
                ? {
                    _id: String(obj.userId._id),
                    username: obj.userId.username,
                    firstName: obj.userId.firstName,
                    lastName: obj.userId.lastName,
                    avatarUrl: obj.userId.avatar,
                }
                : obj.userId
                    ? { _id: String(obj.userId) }
                    : null,
        };
    });
}
