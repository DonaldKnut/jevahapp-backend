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
exports.deleteGroupPermanently = exports.updateGroup = exports.leaveGroup = exports.joinGroup = exports.getGroup = exports.listGroups = exports.createGroup = exports.voteOnPoll = exports.getMyPolls = exports.getPoll = exports.listPolls = exports.createPoll = exports.deleteForumThread = exports.updateForumThread = exports.getForumThread = exports.listForumThreads = exports.createForumThread = exports.deletePrayerPost = exports.updatePrayerPost = exports.getPrayerPost = exports.listPrayerPosts = exports.createPrayerPost = void 0;
const prayerPost_model_1 = require("../models/prayerPost.model");
const forumThread_model_1 = require("../models/forumThread.model");
const poll_model_1 = require("../models/poll.model");
const group_model_1 = require("../models/group.model");
const logger_1 = __importDefault(require("../utils/logger"));
// ===== Prayer Wall =====
const createPrayerPost = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { content, anonymous, media } = req.body || {};
    if (!content || typeof content !== "string") {
        res.status(400).json({ success: false, message: "Validation error: content is required" });
        return;
    }
    if (media && !Array.isArray(media)) {
        res.status(400).json({ success: false, message: "Validation error: media must be an array of strings" });
        return;
    }
    const doc = yield prayerPost_model_1.PrayerPost.create({
        content,
        anonymous: Boolean(anonymous),
        media: Array.isArray(media) ? media : [],
        authorId: req.userId,
    });
    logger_1.default.info("Prayer post created", { postId: doc._id, authorId: req.userId });
    res.status(201).json({ success: true, post: serialize(doc) });
});
exports.createPrayerPost = createPrayerPost;
const listPrayerPosts = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const page = Math.max(parseInt(String(req.query.page || 1), 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || 20), 10) || 20, 1), 100);
    const sortParam = String(req.query.sort || "recent");
    const sort = sortParam === "recent" ? { createdAt: -1 } : { createdAt: -1 };
    const [items, total] = yield Promise.all([
        prayerPost_model_1.PrayerPost.find().populate("authorId", "firstName lastName avatar").sort(sort).skip((page - 1) * limit).limit(limit),
        prayerPost_model_1.PrayerPost.countDocuments(),
    ]);
    res.status(200).json({ success: true, items: items.map(serialize), page, pageSize: items.length, total });
});
exports.listPrayerPosts = listPrayerPosts;
const getPrayerPost = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const doc = yield prayerPost_model_1.PrayerPost.findById(req.params.id).populate("authorId", "firstName lastName avatar");
    if (!doc) {
        res.status(404).json({ success: false, message: "Not Found" });
        return;
    }
    res.status(200).json({ success: true, post: serialize(doc) });
});
exports.getPrayerPost = getPrayerPost;
const updatePrayerPost = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const post = yield prayerPost_model_1.PrayerPost.findById(req.params.id);
    if (!post) {
        res.status(404).json({ success: false, message: "Not Found" });
        return;
    }
    if (String(post.authorId) !== String(req.userId)) {
        res.status(403).json({ success: false, message: "Forbidden: Only author can edit" });
        return;
    }
    const { content, anonymous, media } = req.body || {};
    if (content !== undefined)
        post.content = content;
    if (anonymous !== undefined)
        post.anonymous = Boolean(anonymous);
    if (media !== undefined) {
        if (!Array.isArray(media)) {
            res.status(400).json({ success: false, message: "Validation error: media must be an array" });
            return;
        }
        post.media = media;
    }
    yield post.save();
    logger_1.default.info("Prayer post updated", { postId: post._id, authorId: req.userId });
    res.status(200).json({ success: true, post: serialize(post) });
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
    const { question, options, multiSelect, closesAt } = req.body || {};
    if (!question || typeof question !== "string") {
        res.status(400).json({ success: false, message: "Validation error: question is required" });
        return;
    }
    if (!Array.isArray(options) || options.length < 2) {
        res.status(400).json({ success: false, message: "Validation error: options must be an array with at least 2 items" });
        return;
    }
    const doc = yield poll_model_1.Poll.create({
        question,
        options,
        multiSelect: Boolean(multiSelect),
        closesAt: closesAt ? new Date(closesAt) : undefined,
        authorId: req.userId,
        votes: [],
    });
    logger_1.default.info("Poll created", { pollId: doc._id, authorId: req.userId });
    res.status(201).json({ success: true, poll: serializePoll(doc, req.userId) });
});
exports.createPoll = createPoll;
const listPolls = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const page = Math.max(parseInt(String(req.query.page || 1), 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || 20), 10) || 20, 1), 100);
    const status = String(req.query.status || "all");
    const now = new Date();
    const query = {};
    if (status === "open")
        query.$or = [{ closesAt: { $gt: now } }, { closesAt: { $exists: false } }];
    if (status === "closed")
        query.closesAt = { $lte: now };
    const [items, total] = yield Promise.all([
        poll_model_1.Poll.find(query).populate("authorId", "firstName lastName avatar").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
        poll_model_1.Poll.countDocuments(query),
    ]);
    res.status(200).json({ success: true, items: items.map(poll => serializePoll(poll)), page, pageSize: items.length, total });
});
exports.listPolls = listPolls;
const getPoll = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const doc = yield poll_model_1.Poll.findById(req.params.id).populate("authorId", "firstName lastName avatar");
    if (!doc) {
        res.status(404).json({ success: false, message: "Not Found" });
        return;
    }
    res.status(200).json({ success: true, poll: serializePoll(doc, req.userId) });
});
exports.getPoll = getPoll;
const getMyPolls = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const page = Math.max(parseInt(String(req.query.page || 1), 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || 20), 10) || 20, 1), 100);
    if (!req.userId) {
        res.status(401).json({ success: false, message: "Unauthorized: User not authenticated" });
        return;
    }
    const [items, total] = yield Promise.all([
        poll_model_1.Poll.find({ authorId: req.userId })
            .populate("authorId", "firstName lastName avatar")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit),
        poll_model_1.Poll.countDocuments({ authorId: req.userId }),
    ]);
    res.status(200).json({
        success: true,
        items: items.map(poll => serializePoll(poll, req.userId)),
        page,
        pageSize: items.length,
        total,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
        }
    });
});
exports.getMyPolls = getMyPolls;
const voteOnPoll = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { optionIndex } = req.body || {};
    if (optionIndex === undefined) {
        res.status(400).json({ success: false, message: "Validation error: optionIndex is required" });
        return;
    }
    const poll = yield poll_model_1.Poll.findById(req.params.id);
    if (!poll) {
        res.status(404).json({ success: false, message: "Not Found" });
        return;
    }
    const optionIndexes = Array.isArray(optionIndex) ? optionIndex : [optionIndex];
    if (!poll.multiSelect && optionIndexes.length !== 1) {
        res.status(400).json({ success: false, message: "Validation error: multiSelect disabled; provide single optionIndex" });
        return;
    }
    // Remove previous vote by user, then add
    poll.votes = poll.votes.filter((v) => String(v.userId) !== String(req.userId));
    poll.votes.push({ userId: req.userId, optionIndexes, votedAt: new Date() });
    yield poll.save();
    logger_1.default.info("Poll voted", { pollId: poll._id, userId: req.userId });
    res.status(200).json({ success: true, poll: serializePoll(poll, req.userId) });
});
exports.voteOnPoll = voteOnPoll;
// ===== Groups =====
const createGroup = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, description, visibility } = req.body || {};
    if (!name || typeof name !== "string") {
        res.status(400).json({ success: false, message: "Validation error: name is required" });
        return;
    }
    const doc = yield group_model_1.Group.create({
        name,
        description: description || "",
        visibility: visibility || "public",
        ownerId: req.userId,
        members: [{ userId: req.userId, joinedAt: new Date() }],
    });
    logger_1.default.info("Group created", { groupId: doc._id, ownerId: req.userId });
    res.status(201).json({ success: true, group: serialize(doc) });
});
exports.createGroup = createGroup;
const listGroups = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const page = Math.max(parseInt(String(req.query.page || 1), 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || 20), 10) || 20, 1), 100);
    const mine = String(req.query.mine || "false") === "true";
    const query = mine && req.userId ? { "members.userId": req.userId } : { visibility: "public" };
    const [items, total] = yield Promise.all([
        group_model_1.Group.find(query).populate("ownerId", "firstName lastName avatar").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
        group_model_1.Group.countDocuments(query),
    ]);
    res.status(200).json({ success: true, items: items.map(serialize), page, pageSize: items.length, total });
});
exports.listGroups = listGroups;
const getGroup = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const group = yield group_model_1.Group.findById(req.params.id).populate("ownerId", "firstName lastName avatar");
    if (!group) {
        res.status(404).json({ success: false, message: "Not Found" });
        return;
    }
    const isMember = group.members.some((m) => String(m.userId) === String(req.userId));
    if (group.visibility === "private" && !isMember && String(group.ownerId) !== String(req.userId)) {
        res.status(403).json({ success: false, message: "Forbidden" });
        return;
    }
    res.status(200).json({ success: true, group: serialize(group) });
});
exports.getGroup = getGroup;
const joinGroup = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const group = yield group_model_1.Group.findById(req.params.id);
    if (!group) {
        res.status(404).json({ success: false, message: "Not Found" });
        return;
    }
    const already = group.members.some((m) => String(m.userId) === String(req.userId));
    if (!already) {
        group.members.push({ userId: req.userId, joinedAt: new Date() });
        yield group.save();
        logger_1.default.info("Group joined", { groupId: group._id, userId: req.userId });
    }
    res.status(200).json({ success: true, membership: { groupId: group._id, userId: req.userId } });
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
        res.status(404).json({ success: false, message: "Not Found" });
        return;
    }
    if (String(group.ownerId) !== String(req.userId)) {
        res.status(403).json({ success: false, message: "Forbidden: Only owner can edit" });
        return;
    }
    const { name, description, visibility } = req.body || {};
    if (name !== undefined)
        group.name = name;
    if (description !== undefined)
        group.description = description;
    if (visibility !== undefined) {
        if (!["public", "private"].includes(visibility)) {
            res.status(400).json({ success: false, message: "Validation error: visibility must be 'public' or 'private'" });
            return;
        }
        group.visibility = visibility;
    }
    yield group.save();
    logger_1.default.info("Group updated", { groupId: group._id, ownerId: req.userId });
    res.status(200).json({ success: true, group: serialize(group) });
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
 * Serialize Poll with enriched options (votesCount, percentage, _id)
 */
function serializePoll(doc, userId) {
    const obj = doc.toObject ? doc.toObject() : doc;
    // Calculate votes per option
    const totalVotes = obj.votes.length;
    const optionsWithStats = obj.options.map((text, index) => {
        const votesCount = obj.votes.filter((v) => v.optionIndexes && v.optionIndexes.includes(index)).length;
        const percentage = totalVotes > 0
            ? Math.round((votesCount / totalVotes) * 100)
            : 0;
        return {
            _id: `${obj._id}_${index}`, // Generate option ID
            text,
            votesCount,
            percentage,
        };
    });
    // Check if user voted
    const userVote = userId ? obj.votes.find((v) => String(v.userId) === String(userId)) : null;
    const userVoted = !!userVote;
    // Determine if poll is active
    const now = new Date();
    const isActive = !obj.closesAt || new Date(obj.closesAt) > now;
    // Handle populated authorId
    let author = undefined;
    if (obj.authorId && typeof obj.authorId === "object" && obj.authorId._id) {
        author = {
            id: String(obj.authorId._id),
            firstName: obj.authorId.firstName,
            lastName: obj.authorId.lastName,
            avatar: obj.authorId.avatar,
        };
    }
    else if (obj.authorId) {
        author = {
            id: String(obj.authorId),
        };
    }
    return {
        _id: String(obj._id),
        id: String(obj._id),
        title: obj.question, // Use question as title for frontend compatibility
        question: obj.question,
        description: obj.description || undefined,
        options: optionsWithStats, // Return options as objects with stats
        multiSelect: obj.multiSelect || false,
        totalVotes,
        expiresAt: obj.closesAt || obj.expiresAt,
        closesAt: obj.closesAt || obj.expiresAt,
        createdAt: obj.createdAt,
        updatedAt: obj.updatedAt,
        isActive,
        userVoted,
        author,
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
