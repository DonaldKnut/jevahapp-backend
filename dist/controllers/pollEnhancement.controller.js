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
exports.deletePoll = exports.updatePoll = void 0;
exports.serializePoll = serializePoll;
const poll_model_1 = require("../models/poll.model");
const user_model_1 = require("../models/user.model");
const mongoose_1 = require("mongoose");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Update Poll (Admin Only)
 */
const updatePoll = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { title, question, description, expiresAt, closesAt, isActive } = req.body || {};
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
            res.status(400).json({ success: false, error: "Invalid poll ID" });
            return;
        }
        const poll = yield poll_model_1.Poll.findById(id);
        if (!poll) {
            res.status(404).json({ success: false, error: "Poll not found" });
            return;
        }
        // Check if user is admin
        const user = yield user_model_1.User.findById(req.userId);
        if (!user || user.role !== "admin") {
            res.status(403).json({ success: false, error: "Forbidden: Admin access required" });
            return;
        }
        // Update title/question
        if (title !== undefined) {
            if (typeof title !== "string" || title.trim().length < 5) {
                res.status(400).json({ success: false, error: "Validation error: title must be at least 5 characters" });
                return;
            }
            if (title.length > 200) {
                res.status(400).json({ success: false, error: "Validation error: title must be less than 200 characters" });
                return;
            }
            poll.question = title.trim();
            poll.title = title.trim();
        }
        else if (question !== undefined) {
            if (typeof question !== "string" || question.trim().length < 5) {
                res.status(400).json({ success: false, error: "Validation error: question must be at least 5 characters" });
                return;
            }
            if (question.length > 200) {
                res.status(400).json({ success: false, error: "Validation error: question must be less than 200 characters" });
                return;
            }
            poll.question = question.trim();
            poll.title = question.trim();
        }
        // Update description
        if (description !== undefined) {
            if (description === null) {
                poll.description = undefined;
            }
            else if (typeof description === "string") {
                if (description.length > 500) {
                    res.status(400).json({ success: false, error: "Validation error: description must be less than 500 characters" });
                    return;
                }
                poll.description = description.trim();
            }
            else {
                res.status(400).json({ success: false, error: "Validation error: description must be a string or null" });
                return;
            }
        }
        // Update expiresAt/closesAt
        if (expiresAt !== undefined || closesAt !== undefined) {
            const expiryDate = expiresAt || closesAt;
            if (expiryDate === null) {
                poll.closesAt = undefined;
                poll.expiresAt = undefined;
            }
            else {
                const date = new Date(expiryDate);
                if (isNaN(date.getTime())) {
                    res.status(400).json({ success: false, error: "Validation error: invalid date format" });
                    return;
                }
                if (date <= new Date()) {
                    res.status(400).json({ success: false, error: "Validation error: expiry date must be in the future" });
                    return;
                }
                poll.closesAt = date;
                poll.expiresAt = date;
            }
        }
        yield poll.save();
        yield poll.populate("authorId", "firstName lastName username avatar");
        logger_1.default.info("Poll updated", { pollId: poll._id, userId: req.userId });
        res.status(200).json({
            success: true,
            data: yield serializePoll(poll, req.userId),
        });
    }
    catch (error) {
        logger_1.default.error("Error updating poll", { error: error.message, pollId: req.params.id });
        res.status(500).json({ success: false, error: "Failed to update poll" });
    }
});
exports.updatePoll = updatePoll;
/**
 * Delete Poll (Admin Only)
 */
const deletePoll = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
            res.status(400).json({ success: false, error: "Invalid poll ID" });
            return;
        }
        const poll = yield poll_model_1.Poll.findById(id);
        if (!poll) {
            res.status(404).json({ success: false, error: "Poll not found" });
            return;
        }
        // Check if user is admin
        const user = yield user_model_1.User.findById(req.userId);
        if (!user || user.role !== "admin") {
            res.status(403).json({ success: false, error: "Forbidden: Admin access required" });
            return;
        }
        yield poll_model_1.Poll.findByIdAndDelete(id);
        logger_1.default.info("Poll deleted", { pollId: id, userId: req.userId });
        res.status(200).json({
            success: true,
            message: "Poll deleted successfully",
        });
    }
    catch (error) {
        logger_1.default.error("Error deleting poll", { error: error.message, pollId: req.params.id });
        res.status(500).json({ success: false, error: "Failed to delete poll" });
    }
});
exports.deletePoll = deletePoll;
/**
 * Serialize Poll with enhanced format
 */
function serializePoll(doc, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const obj = doc.toObject ? doc.toObject() : doc;
        // Calculate votes per option
        const totalVotes = obj.votes.length;
        const optionsWithStats = obj.options.map((text, index) => {
            const votesCount = obj.votes.filter((v) => v.optionIndexes.includes(index)).length;
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
        const userVote = userId && mongoose_1.Types.ObjectId.isValid(userId)
            ? obj.votes.find((v) => String(v.userId) === String(userId))
            : null;
        // Determine if poll is active
        const now = new Date();
        const isActive = !obj.closesAt || new Date(obj.closesAt) > now;
        return {
            _id: String(obj._id),
            title: obj.title || obj.question,
            question: obj.question || obj.title,
            description: obj.description || undefined,
            createdBy: String(((_a = obj.authorId) === null || _a === void 0 ? void 0 : _a._id) || obj.authorId),
            options: optionsWithStats,
            totalVotes,
            expiresAt: obj.expiresAt || obj.closesAt,
            closesAt: obj.closesAt || obj.expiresAt,
            createdAt: obj.createdAt,
            updatedAt: obj.updatedAt,
            isActive,
            userVoted: !!userVote,
            userVoteOptionId: userVote && userVote.optionIndexes.length > 0
                ? `${obj._id}_${userVote.optionIndexes[0]}`
                : undefined,
            createdByUser: obj.authorId && typeof obj.authorId === "object" && obj.authorId._id
                ? {
                    _id: String(obj.authorId._id),
                    username: obj.authorId.username,
                    avatarUrl: obj.authorId.avatar,
                }
                : null,
        };
    });
}
