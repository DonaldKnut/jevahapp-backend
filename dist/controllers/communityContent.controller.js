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
exports.deleteGroupPermanently = exports.updateGroup = exports.leaveGroup = exports.joinGroup = exports.getGroup = exports.listGroups = exports.createGroup = exports.voteOnPoll = exports.getPoll = exports.listPolls = exports.createPoll = exports.deleteForumThread = exports.updateForumThread = exports.getForumThread = exports.listForumThreads = exports.createForumThread = exports.deletePrayerPost = exports.updatePrayerPost = exports.getPrayerPost = exports.listPrayerPosts = exports.createPrayerPost = void 0;
const prayerPost_model_1 = require("../models/prayerPost.model");
const forumThread_model_1 = require("../models/forumThread.model");
const poll_model_1 = require("../models/poll.model");
const group_model_1 = require("../models/group.model");
const user_model_1 = require("../models/user.model");
const mediaInteraction_model_1 = require("../models/mediaInteraction.model");
const mongoose_1 = require("mongoose");
const logger_1 = __importDefault(require("../utils/logger"));
// ===== Prayer Wall =====
const createPrayerPost = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { content, prayerText, verse, color, shape, anonymous, media } = req.body || {};
    // Support both content and prayerText (prayerText is preferred)
    const prayerContent = prayerText || content;
    if (!prayerContent || typeof prayerContent !== "string" || prayerContent.trim().length === 0) {
        res.status(400).json({ success: false, message: "Validation error: prayerText/content is required" });
        return;
    }
    if (prayerContent.length > 2000) {
        res.status(400).json({ success: false, message: "Validation error: prayerText must be less than 2000 characters" });
        return;
    }
    // Validate verse if provided
    if (verse) {
        if (typeof verse !== "object" || !verse.text || !verse.reference) {
            res.status(400).json({ success: false, message: "Validation error: verse must have text and reference" });
            return;
        }
    }
    // Validate color if provided
    if (color && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) {
        res.status(400).json({ success: false, message: "Validation error: color must be a valid hex color code" });
        return;
    }
    // Validate shape if provided
    const validShapes = ["rectangle", "circle", "scalloped", "square", "square2", "square3", "square4"];
    if (shape && !validShapes.includes(shape)) {
        res.status(400).json({ success: false, message: `Validation error: shape must be one of: ${validShapes.join(", ")}` });
        return;
    }
    if (media && !Array.isArray(media)) {
        res.status(400).json({ success: false, message: "Validation error: media must be an array of strings" });
        return;
    }
    const doc = yield prayerPost_model_1.PrayerPost.create({
        content: prayerContent.trim(),
        prayerText: prayerContent.trim(),
        verse: verse ? { text: verse.text.trim(), reference: verse.reference.trim() } : undefined,
        color: color || "#A16CE5",
        shape: shape || "square",
        anonymous: Boolean(anonymous),
        media: Array.isArray(media) ? media : [],
        authorId: req.userId,
        likesCount: 0,
        commentsCount: 0,
    });
    logger_1.default.info("Prayer post created", { postId: doc._id, authorId: req.userId });
    // Populate author and serialize
    yield doc.populate("authorId", "firstName lastName username avatar");
    res.status(201).json({ success: true, data: serializePrayer(doc, req.userId) });
});
exports.createPrayerPost = createPrayerPost;
const listPrayerPosts = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const page = Math.max(parseInt(String(req.query.page || 1), 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || 20), 10) || 20, 1), 100);
    const sortBy = String(req.query.sortBy || "createdAt");
    const sortOrder = String(req.query.sortOrder || "desc") === "asc" ? 1 : -1;
    // Build sort object
    const sort = {};
    if (sortBy === "likesCount")
        sort.likesCount = sortOrder;
    else if (sortBy === "commentsCount")
        sort.commentsCount = sortOrder;
    else
        sort.createdAt = sortOrder;
    const [items, total] = yield Promise.all([
        prayerPost_model_1.PrayerPost.find().populate("authorId", "firstName lastName username avatar").sort(sort).skip((page - 1) * limit).limit(limit),
        prayerPost_model_1.PrayerPost.countDocuments(),
    ]);
    // Check user likes for each prayer
    const userId = req.userId;
    const prayers = yield Promise.all(items.map((item) => __awaiter(void 0, void 0, void 0, function* () {
        return yield serializePrayer(item, userId);
    })));
    res.status(200).json({
        success: true,
        data: {
            prayers,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasMore: page * limit < total,
            },
        },
    });
});
exports.listPrayerPosts = listPrayerPosts;
const getPrayerPost = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const doc = yield prayerPost_model_1.PrayerPost.findById(req.params.id).populate("authorId", "firstName lastName username avatar");
    if (!doc) {
        res.status(404).json({ success: false, error: "Prayer not found" });
        return;
    }
    res.status(200).json({ success: true, data: serializePrayer(doc, req.userId) });
});
exports.getPrayerPost = getPrayerPost;
const updatePrayerPost = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const post = yield prayerPost_model_1.PrayerPost.findById(req.params.id);
    if (!post) {
        res.status(404).json({ success: false, error: "Prayer not found" });
        return;
    }
    if (String(post.authorId) !== String(req.userId)) {
        res.status(403).json({ success: false, error: "Forbidden: Only author can edit" });
        return;
    }
    const { content, prayerText, verse, color, shape, anonymous, media } = req.body || {};
    // Update content/prayerText
    if (prayerText !== undefined) {
        if (typeof prayerText !== "string" || prayerText.trim().length === 0) {
            res.status(400).json({ success: false, error: "Validation error: prayerText must be a non-empty string" });
            return;
        }
        post.content = prayerText.trim();
        post.prayerText = prayerText.trim();
    }
    else if (content !== undefined) {
        if (typeof content !== "string" || content.trim().length === 0) {
            res.status(400).json({ success: false, error: "Validation error: content must be a non-empty string" });
            return;
        }
        post.content = content.trim();
        post.prayerText = content.trim();
    }
    // Update verse
    if (verse !== undefined) {
        if (verse === null) {
            post.verse = undefined;
        }
        else if (typeof verse === "object" && verse.text && verse.reference) {
            post.verse = { text: verse.text.trim(), reference: verse.reference.trim() };
        }
        else {
            res.status(400).json({ success: false, error: "Validation error: verse must have text and reference" });
            return;
        }
    }
    // Update color
    if (color !== undefined) {
        if (!/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) {
            res.status(400).json({ success: false, error: "Validation error: color must be a valid hex color code" });
            return;
        }
        post.color = color;
    }
    // Update shape
    if (shape !== undefined) {
        const validShapes = ["rectangle", "circle", "scalloped", "square", "square2", "square3", "square4"];
        if (!validShapes.includes(shape)) {
            res.status(400).json({ success: false, error: `Validation error: shape must be one of: ${validShapes.join(", ")}` });
            return;
        }
        post.shape = shape;
    }
    if (anonymous !== undefined)
        post.anonymous = Boolean(anonymous);
    if (media !== undefined) {
        if (!Array.isArray(media)) {
            res.status(400).json({ success: false, error: "Validation error: media must be an array" });
            return;
        }
        post.media = media;
    }
    yield post.save();
    yield post.populate("authorId", "firstName lastName username avatar");
    logger_1.default.info("Prayer post updated", { postId: post._id, authorId: req.userId });
    res.status(200).json({ success: true, data: serializePrayer(post, req.userId) });
});
exports.updatePrayerPost = updatePrayerPost;
const deletePrayerPost = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const post = yield prayerPost_model_1.PrayerPost.findById(req.params.id);
    if (!post) {
        res.status(404).json({ success: false, message: "Not Found" });
        return;
    }
    if (String(post.authorId) !== String(req.userId)) {
        res.status(403).json({ success: false, message: "Forbidden: Only author can delete" });
        return;
    }
    yield prayerPost_model_1.PrayerPost.findByIdAndDelete(req.params.id);
    logger_1.default.info("Prayer post deleted", { postId: req.params.id, authorId: req.userId });
    res.status(200).json({ success: true, message: "Post deleted" });
});
exports.deletePrayerPost = deletePrayerPost;
// ===== Forum =====
const createForumThread = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { title, body, tags } = req.body || {};
    if (!title || typeof title !== "string") {
        res.status(400).json({ success: false, message: "Validation error: title is required" });
        return;
    }
    if (!body || typeof body !== "string") {
        res.status(400).json({ success: false, message: "Validation error: body is required" });
        return;
    }
    if (tags && !Array.isArray(tags)) {
        res.status(400).json({ success: false, message: "Validation error: tags must be an array of strings" });
        return;
    }
    const doc = yield forumThread_model_1.ForumThread.create({
        title,
        body,
        tags: Array.isArray(tags) ? tags : [],
        authorId: req.userId,
    });
    logger_1.default.info("Forum thread created", { threadId: doc._id, authorId: req.userId });
    res.status(201).json({ success: true, thread: serialize(doc) });
});
exports.createForumThread = createForumThread;
const listForumThreads = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const page = Math.max(parseInt(String(req.query.page || 1), 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || 20), 10) || 20, 1), 100);
    const sortParam = String(req.query.sort || "recent");
    const sort = sortParam === "active" ? { updatedAt: -1 } : { createdAt: -1 };
    const [items, total] = yield Promise.all([
        forumThread_model_1.ForumThread.find().populate("authorId", "firstName lastName avatar").sort(sort).skip((page - 1) * limit).limit(limit),
        forumThread_model_1.ForumThread.countDocuments(),
    ]);
    res.status(200).json({ success: true, items: items.map(serialize), page, pageSize: items.length, total });
});
exports.listForumThreads = listForumThreads;
const getForumThread = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const doc = yield forumThread_model_1.ForumThread.findById(req.params.id).populate("authorId", "firstName lastName avatar");
    if (!doc) {
        res.status(404).json({ success: false, message: "Not Found" });
        return;
    }
    res.status(200).json({ success: true, thread: serialize(doc) });
});
exports.getForumThread = getForumThread;
const updateForumThread = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const thread = yield forumThread_model_1.ForumThread.findById(req.params.id);
    if (!thread) {
        res.status(404).json({ success: false, message: "Not Found" });
        return;
    }
    if (String(thread.authorId) !== String(req.userId)) {
        res.status(403).json({ success: false, message: "Forbidden: Only author can edit" });
        return;
    }
    const { title, body, tags } = req.body || {};
    if (title !== undefined)
        thread.title = title;
    if (body !== undefined)
        thread.body = body;
    if (tags !== undefined) {
        if (!Array.isArray(tags)) {
            res.status(400).json({ success: false, message: "Validation error: tags must be an array" });
            return;
        }
        thread.tags = tags;
    }
    yield thread.save();
    logger_1.default.info("Forum thread updated", { threadId: thread._id, authorId: req.userId });
    res.status(200).json({ success: true, thread: serialize(thread) });
});
exports.updateForumThread = updateForumThread;
const deleteForumThread = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const thread = yield forumThread_model_1.ForumThread.findById(req.params.id);
    if (!thread) {
        res.status(404).json({ success: false, message: "Not Found" });
        return;
    }
    if (String(thread.authorId) !== String(req.userId)) {
        res.status(403).json({ success: false, message: "Forbidden: Only author can delete" });
        return;
    }
    yield forumThread_model_1.ForumThread.findByIdAndDelete(req.params.id);
    logger_1.default.info("Forum thread deleted", { threadId: req.params.id, authorId: req.userId });
    res.status(200).json({ success: true, message: "Thread deleted" });
});
exports.deleteForumThread = deleteForumThread;
// ===== Polls =====
const createPoll = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // Check if user is admin
    const user = yield user_model_1.User.findById(req.userId);
    if (!user || user.role !== "admin") {
        res.status(403).json({ success: false, error: "Forbidden: Admin access required" });
        return;
    }
    const { question, title, description, options, multiSelect, closesAt, expiresAt } = req.body || {};
    // Support both question and title
    const pollQuestion = title || question;
    if (!pollQuestion || typeof pollQuestion !== "string" || pollQuestion.trim().length < 5) {
        res.status(400).json({ success: false, error: "Validation error: title/question must be at least 5 characters" });
        return;
    }
    if (pollQuestion.length > 200) {
        res.status(400).json({ success: false, error: "Validation error: title/question must be less than 200 characters" });
        return;
    }
    if (!Array.isArray(options) || options.length < 2 || options.length > 10) {
        res.status(400).json({ success: false, error: "Validation error: options must be an array with 2-10 items" });
        return;
    }
    // Validate each option
    for (const option of options) {
        if (typeof option !== "string" || option.trim().length === 0) {
            res.status(400).json({ success: false, error: "Validation error: each option must be a non-empty string" });
            return;
        }
        if (option.length > 200) {
            res.status(400).json({ success: false, error: "Validation error: each option must be less than 200 characters" });
            return;
        }
    }
    // Validate description if provided
    if (description !== undefined && description !== null && description.length > 500) {
        res.status(400).json({ success: false, error: "Validation error: description must be less than 500 characters" });
        return;
    }
    // Validate expiry date if provided
    const expiryDate = expiresAt || closesAt;
    if (expiryDate) {
        const date = new Date(expiryDate);
        if (isNaN(date.getTime())) {
            res.status(400).json({ success: false, error: "Validation error: invalid date format" });
            return;
        }
        if (date <= new Date()) {
            res.status(400).json({ success: false, error: "Validation error: expiry date must be in the future" });
            return;
        }
    }
    const doc = yield poll_model_1.Poll.create({
        question: pollQuestion.trim(),
        title: pollQuestion.trim(),
        description: description ? description.trim() : undefined,
        options: options.map((opt) => opt.trim()),
        multiSelect: Boolean(multiSelect),
        closesAt: expiryDate ? new Date(expiryDate) : undefined,
        expiresAt: expiryDate ? new Date(expiryDate) : undefined,
        authorId: req.userId,
        votes: [],
    });
    yield doc.populate("authorId", "firstName lastName username avatar");
    logger_1.default.info("Poll created", { pollId: doc._id, authorId: req.userId });
    // Import serializePoll from pollEnhancement
    const { serializePoll } = yield Promise.resolve().then(() => __importStar(require("./pollEnhancement.controller")));
    res.status(201).json({ success: true, data: yield serializePoll(doc, req.userId) });
});
exports.createPoll = createPoll;
const listPolls = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const page = Math.max(parseInt(String(req.query.page || 1), 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || 20), 10) || 20, 1), 100);
    const status = String(req.query.status || "active");
    const sortBy = String(req.query.sortBy || "createdAt");
    const sortOrder = String(req.query.sortOrder || "desc") === "asc" ? 1 : -1;
    const now = new Date();
    const query = {};
    if (status === "active") {
        query.$or = [{ closesAt: { $gt: now } }, { closesAt: { $exists: false } }, { expiresAt: { $gt: now } }, { expiresAt: { $exists: false } }];
    }
    else if (status === "expired") {
        query.$or = [
            { closesAt: { $lte: now } },
            { expiresAt: { $lte: now } },
        ];
    }
    // "all" status doesn't filter
    // Build sort object
    const sort = {};
    if (sortBy === "totalVotes") {
        // Sort by vote count (requires aggregation or post-processing)
        sort.createdAt = sortOrder; // Default sort for now
    }
    else {
        sort.createdAt = sortOrder;
    }
    const [items, total] = yield Promise.all([
        poll_model_1.Poll.find(query)
            .populate("authorId", "firstName lastName username avatar")
            .sort(sort)
            .skip((page - 1) * limit)
            .limit(limit),
        poll_model_1.Poll.countDocuments(query),
    ]);
    // Import serializePoll
    const { serializePoll } = yield Promise.resolve().then(() => __importStar(require("./pollEnhancement.controller")));
    const polls = yield Promise.all(items.map((item) => __awaiter(void 0, void 0, void 0, function* () { return yield serializePoll(item, req.userId); })));
    res.status(200).json({
        success: true,
        data: {
            polls,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasMore: page * limit < total,
            },
        },
    });
});
exports.listPolls = listPolls;
const getPoll = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const doc = yield poll_model_1.Poll.findById(req.params.id).populate("authorId", "firstName lastName username avatar");
    if (!doc) {
        res.status(404).json({ success: false, error: "Poll not found" });
        return;
    }
    // Import serializePoll
    const { serializePoll } = yield Promise.resolve().then(() => __importStar(require("./pollEnhancement.controller")));
    res.status(200).json({ success: true, data: yield serializePoll(doc, req.userId) });
});
exports.getPoll = getPoll;
const voteOnPoll = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { optionIndex, optionId } = req.body || {};
    // Support both optionIndex and optionId
    let optionIndexes;
    if (optionId !== undefined) {
        // Extract index from optionId (format: pollId_index)
        const parts = String(optionId).split("_");
        if (parts.length < 2) {
            res.status(400).json({ success: false, error: "Validation error: invalid optionId format" });
            return;
        }
        const index = parseInt(parts[parts.length - 1], 10);
        if (isNaN(index)) {
            res.status(400).json({ success: false, error: "Validation error: invalid optionId" });
            return;
        }
        optionIndexes = [index];
    }
    else if (optionIndex !== undefined) {
        optionIndexes = Array.isArray(optionIndex) ? optionIndex : [optionIndex];
    }
    else {
        res.status(400).json({ success: false, error: "Validation error: optionIndex or optionId is required" });
        return;
    }
    const poll = yield poll_model_1.Poll.findById(req.params.id);
    if (!poll) {
        res.status(404).json({ success: false, error: "Poll not found" });
        return;
    }
    // Check if poll is active
    const now = new Date();
    if (poll.closesAt && new Date(poll.closesAt) <= now) {
        res.status(400).json({ success: false, error: "Poll has expired" });
        return;
    }
    // Validate option indices
    for (const idx of optionIndexes) {
        if (typeof idx !== "number" || idx < 0 || idx >= poll.options.length) {
            res.status(400).json({ success: false, error: `Validation error: invalid option index: ${idx}` });
            return;
        }
    }
    if (!poll.multiSelect && optionIndexes.length !== 1) {
        res.status(400).json({ success: false, error: "Validation error: multiSelect disabled; provide single option" });
        return;
    }
    // Remove previous vote by user, then add
    poll.votes = poll.votes.filter((v) => String(v.userId) !== String(req.userId));
    poll.votes.push({ userId: req.userId, optionIndexes, votedAt: new Date() });
    yield poll.save();
    yield poll.populate("authorId", "firstName lastName username avatar");
    logger_1.default.info("Poll voted", { pollId: poll._id, userId: req.userId });
    // Import serializePoll
    const { serializePoll } = yield Promise.resolve().then(() => __importStar(require("./pollEnhancement.controller")));
    res.status(200).json({ success: true, data: yield serializePoll(poll, req.userId) });
});
exports.voteOnPoll = voteOnPoll;
// ===== Groups =====
const createGroup = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, description, visibility, isPublic } = req.body || {};
    // Support both visibility and isPublic
    const groupVisibility = visibility || (isPublic === false ? "private" : "public");
    if (!name || typeof name !== "string" || name.trim().length < 3) {
        res.status(400).json({ success: false, error: "Validation error: name must be at least 3 characters" });
        return;
    }
    if (name.length > 100) {
        res.status(400).json({ success: false, error: "Validation error: name must be less than 100 characters" });
        return;
    }
    if (description && description.length > 500) {
        res.status(400).json({ success: false, error: "Validation error: description must be less than 500 characters" });
        return;
    }
    if (!["public", "private"].includes(groupVisibility)) {
        res.status(400).json({ success: false, error: "Validation error: visibility must be 'public' or 'private'" });
        return;
    }
    const doc = yield group_model_1.Group.create({
        name: name.trim(),
        description: (description || "").trim(),
        visibility: groupVisibility,
        ownerId: req.userId,
        members: [{ userId: req.userId, role: "admin", joinedAt: new Date() }],
    });
    yield doc.populate("ownerId", "firstName lastName username avatar");
    yield doc.populate("members.userId", "firstName lastName username avatar");
    logger_1.default.info("Group created", { groupId: doc._id, ownerId: req.userId });
    res.status(201).json({ success: true, data: serializeGroup(doc, req.userId) });
});
exports.createGroup = createGroup;
const listGroups = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const page = Math.max(parseInt(String(req.query.page || 1), 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || 20), 10) || 20, 1), 100);
    const mine = String(req.query.mine || "false") === "true";
    const search = String(req.query.search || "").trim();
    const sortBy = String(req.query.sortBy || "membersCount");
    const sortOrder = String(req.query.sortOrder || "desc") === "asc" ? 1 : -1;
    // Build query
    let query = {};
    if (mine && req.userId) {
        query["members.userId"] = req.userId;
    }
    else {
        query.visibility = "public";
    }
    // Add search if provided
    if (search) {
        query.$or = [
            { name: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
        ];
    }
    // Build sort object
    const sort = {};
    if (sortBy === "membersCount") {
        // Sort by member count (requires aggregation or post-processing)
        sort.createdAt = sortOrder; // Default sort for now
    }
    else if (sortBy === "name") {
        sort.name = sortOrder;
    }
    else {
        sort.createdAt = sortOrder;
    }
    const [items, total] = yield Promise.all([
        group_model_1.Group.find(query)
            .populate("ownerId", "firstName lastName username avatar")
            .populate("members.userId", "firstName lastName username avatar")
            .sort(sort)
            .skip((page - 1) * limit)
            .limit(limit),
        group_model_1.Group.countDocuments(query),
    ]);
    const groups = items.map((item) => serializeGroup(item, req.userId));
    res.status(200).json({
        success: true,
        data: {
            groups,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasMore: page * limit < total,
            },
        },
    });
});
exports.listGroups = listGroups;
const getGroup = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const group = yield group_model_1.Group.findById(req.params.id)
        .populate("ownerId", "firstName lastName username avatar")
        .populate("members.userId", "firstName lastName username avatar");
    if (!group) {
        res.status(404).json({ success: false, error: "Group not found" });
        return;
    }
    const isMember = group.members.some((m) => String(m.userId) === String(req.userId));
    if (group.visibility === "private" && !isMember && String(group.ownerId) !== String(req.userId)) {
        res.status(403).json({ success: false, error: "Forbidden: Private group access denied" });
        return;
    }
    res.status(200).json({ success: true, data: serializeGroup(group, req.userId) });
});
exports.getGroup = getGroup;
const joinGroup = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const group = yield group_model_1.Group.findById(req.params.id);
    if (!group) {
        res.status(404).json({ success: false, error: "Group not found" });
        return;
    }
    // Check if group is public
    if (group.visibility !== "public") {
        res.status(403).json({ success: false, error: "Forbidden: Cannot join private group directly" });
        return;
    }
    const already = group.members.some((m) => String(m.userId) === String(req.userId));
    if (!already) {
        group.members.push({ userId: req.userId, role: "member", joinedAt: new Date() });
        yield group.save();
        logger_1.default.info("Group joined", { groupId: group._id, userId: req.userId });
    }
    res.status(200).json({
        success: true,
        data: {
            _id: group._id,
            userId: req.userId,
            groupId: String(group._id),
            role: "member",
            joinedAt: new Date(),
        },
    });
});
exports.joinGroup = joinGroup;
const leaveGroup = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const group = yield group_model_1.Group.findById(req.params.id);
    if (!group) {
        res.status(404).json({ success: false, message: "Not Found" });
        return;
    }
    group.members = group.members.filter((m) => String(m.userId) !== String(req.userId));
    yield group.save();
    logger_1.default.info("Group left", { groupId: group._id, userId: req.userId });
    res.status(200).json({ success: true });
});
exports.leaveGroup = leaveGroup;
const updateGroup = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const group = yield group_model_1.Group.findById(req.params.id);
    if (!group) {
        res.status(404).json({ success: false, error: "Group not found" });
        return;
    }
    // Check if user is owner or admin
    const isOwner = String(group.ownerId) === String(req.userId);
    const userMember = group.members.find((m) => String(m.userId) === String(req.userId));
    const isAdmin = (userMember === null || userMember === void 0 ? void 0 : userMember.role) === "admin";
    if (!isOwner && !isAdmin) {
        res.status(403).json({ success: false, error: "Forbidden: Only group admins can edit" });
        return;
    }
    const { name, description, visibility, isPublic } = req.body || {};
    if (name !== undefined) {
        if (typeof name !== "string" || name.trim().length < 3) {
            res.status(400).json({ success: false, error: "Validation error: name must be at least 3 characters" });
            return;
        }
        if (name.length > 100) {
            res.status(400).json({ success: false, error: "Validation error: name must be less than 100 characters" });
            return;
        }
        group.name = name.trim();
    }
    if (description !== undefined) {
        if (description !== null && (typeof description !== "string" || description.length > 500)) {
            res.status(400).json({ success: false, error: "Validation error: description must be less than 500 characters" });
            return;
        }
        group.description = description === null ? "" : (description || "").trim();
    }
    // Support both visibility and isPublic
    const visibilityValue = visibility || (isPublic !== undefined ? (isPublic ? "public" : "private") : undefined);
    if (visibilityValue !== undefined) {
        if (!["public", "private"].includes(visibilityValue)) {
            res.status(400).json({ success: false, error: "Validation error: visibility must be 'public' or 'private'" });
            return;
        }
        group.visibility = visibilityValue;
    }
    yield group.save();
    yield group.populate("ownerId", "firstName lastName username avatar");
    yield group.populate("members.userId", "firstName lastName username avatar");
    logger_1.default.info("Group updated", { groupId: group._id, userId: req.userId });
    res.status(200).json({ success: true, data: serializeGroup(group, req.userId) });
});
exports.updateGroup = updateGroup;
const deleteGroupPermanently = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const group = yield group_model_1.Group.findById(req.params.id);
    if (!group) {
        res.status(404).json({ success: false, message: "Not Found" });
        return;
    }
    if (String(group.ownerId) !== String(req.userId)) {
        res.status(403).json({ success: false, message: "Forbidden: Only owner can delete" });
        return;
    }
    yield group_model_1.Group.findByIdAndDelete(req.params.id);
    logger_1.default.info("Group deleted", { groupId: req.params.id, ownerId: req.userId });
    res.status(200).json({ success: true, message: "Group deleted" });
});
exports.deleteGroupPermanently = deleteGroupPermanently;
exports.default = {
    createPrayerPost: exports.createPrayerPost,
    listPrayerPosts: exports.listPrayerPosts,
    getPrayerPost: exports.getPrayerPost,
    updatePrayerPost: exports.updatePrayerPost,
    deletePrayerPost: exports.deletePrayerPost,
    createForumThread: exports.createForumThread,
    listForumThreads: exports.listForumThreads,
    getForumThread: exports.getForumThread,
    updateForumThread: exports.updateForumThread,
    deleteForumThread: exports.deleteForumThread,
    createPoll: exports.createPoll,
    listPolls: exports.listPolls,
    getPoll: exports.getPoll,
    voteOnPoll: exports.voteOnPoll,
    createGroup: exports.createGroup,
    listGroups: exports.listGroups,
    getGroup: exports.getGroup,
    joinGroup: exports.joinGroup,
    leaveGroup: exports.leaveGroup,
    updateGroup: exports.updateGroup,
    deleteGroupPermanently: exports.deleteGroupPermanently,
};
/**
 * Serialize prayer post with user interaction data
 */
function serializePrayer(doc, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const obj = doc.toObject ? doc.toObject() : doc;
        // Check if user liked this prayer
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
            userId: String(((_a = obj.authorId) === null || _a === void 0 ? void 0 : _a._id) || obj.authorId),
            prayerText: obj.prayerText || obj.content,
            content: obj.content || obj.prayerText,
            verse: obj.verse || undefined,
            color: obj.color || "#A16CE5",
            shape: obj.shape || "square",
            createdAt: obj.createdAt,
            updatedAt: obj.updatedAt,
            likesCount: obj.likesCount || 0,
            commentsCount: obj.commentsCount || 0,
            userLiked,
            author: obj.authorId && typeof obj.authorId === "object" && obj.authorId._id
                ? {
                    _id: String(obj.authorId._id),
                    username: obj.authorId.username,
                    firstName: obj.authorId.firstName,
                    lastName: obj.authorId.lastName,
                    avatarUrl: obj.authorId.avatar,
                }
                : obj.authorId
                    ? { _id: String(obj.authorId) }
                    : null,
            anonymous: obj.anonymous || false,
            media: obj.media || [],
        };
    });
}
/**
 * Serialize Group with enhanced format
 */
function serializeGroup(doc, userId) {
    var _a, _b, _c;
    const obj = doc.toObject ? doc.toObject() : doc;
    const isMember = userId && obj.members.some((m) => String(m.userId) === String(userId));
    const userMember = userId ? obj.members.find((m) => String(m.userId) === String(userId)) : null;
    return {
        _id: String(obj._id),
        name: obj.name,
        description: obj.description || "",
        profileImageUrl: obj.profileImageUrl || undefined,
        createdBy: String(((_a = obj.ownerId) === null || _a === void 0 ? void 0 : _a._id) || obj.ownerId),
        isPublic: obj.visibility === "public",
        visibility: obj.visibility,
        membersCount: ((_b = obj.members) === null || _b === void 0 ? void 0 : _b.length) || 0,
        createdAt: obj.createdAt,
        updatedAt: obj.updatedAt,
        members: ((_c = obj.members) === null || _c === void 0 ? void 0 : _c.map((m) => {
            var _a;
            return ({
                _id: String(m._id || m.userId),
                userId: String(((_a = m.userId) === null || _a === void 0 ? void 0 : _a._id) || m.userId),
                role: m.role || (String(m.userId) === String(obj.ownerId) ? "admin" : "member"),
                joinedAt: m.joinedAt,
                user: m.userId && typeof m.userId === "object" && m.userId._id
                    ? {
                        _id: String(m.userId._id),
                        username: m.userId.username,
                        firstName: m.userId.firstName,
                        lastName: m.userId.lastName,
                        avatarUrl: m.userId.avatar,
                    }
                    : null,
            });
        })) || [],
        creator: obj.ownerId && typeof obj.ownerId === "object" && obj.ownerId._id
            ? {
                _id: String(obj.ownerId._id),
                username: obj.ownerId.username,
                avatarUrl: obj.ownerId.avatar,
            }
            : null,
        isMember: !!isMember,
        userRole: (userMember === null || userMember === void 0 ? void 0 : userMember.role) || (isMember ? "member" : undefined),
    };
}
function serialize(doc) {
    const obj = doc.toObject ? doc.toObject() : doc;
    obj.id = String(obj._id);
    delete obj._id;
    delete obj.__v;
    // Handle populated authorId
    if (obj.authorId && typeof obj.authorId === "object" && obj.authorId._id) {
        obj.author = {
            id: String(obj.authorId._id),
            firstName: obj.authorId.firstName,
            lastName: obj.authorId.lastName,
            avatar: obj.authorId.avatar,
        };
        delete obj.authorId;
    }
    // Handle populated ownerId
    if (obj.ownerId && typeof obj.ownerId === "object" && obj.ownerId._id) {
        obj.owner = {
            id: String(obj.ownerId._id),
            firstName: obj.ownerId.firstName,
            lastName: obj.ownerId.lastName,
            avatar: obj.ownerId.avatar,
        };
        delete obj.ownerId;
    }
    return obj;
}
