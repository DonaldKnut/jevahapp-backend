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
exports.uploadMiddleware = exports.removeGroupMember = exports.addGroupMembers = exports.uploadGroupImage = void 0;
const group_model_1 = require("../models/group.model");
const user_model_1 = require("../models/user.model");
const fileUpload_service_1 = __importDefault(require("../service/fileUpload.service"));
const mongoose_1 = require("mongoose");
const logger_1 = __importDefault(require("../utils/logger"));
const multer_1 = __importDefault(require("multer"));
// Configure multer for image upload
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error("Invalid file type. Only JPEG, PNG, and WebP images are allowed."));
        }
    },
});
/**
 * Upload Group Profile Image
 */
const uploadGroupImage = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const file = req.file;
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
            res.status(400).json({ success: false, error: "Invalid group ID" });
            return;
        }
        if (!file) {
            res.status(400).json({ success: false, error: "No image file provided" });
            return;
        }
        const group = yield group_model_1.Group.findById(id);
        if (!group) {
            res.status(404).json({ success: false, error: "Group not found" });
            return;
        }
        // Check if user is owner or admin
        const isOwner = String(group.ownerId) === String(req.userId);
        const userMember = group.members.find((m) => String(m.userId) === String(req.userId));
        const isAdmin = (userMember === null || userMember === void 0 ? void 0 : userMember.role) === "admin";
        if (!isOwner && !isAdmin) {
            res.status(403).json({ success: false, error: "Forbidden: Only group admins can upload images" });
            return;
        }
        // Upload image to cloud storage
        const uploadResult = yield fileUpload_service_1.default.uploadMedia(file.buffer, `groups/${id}`, file.mimetype);
        // Update group with image URL
        group.profileImageUrl = uploadResult.secure_url;
        yield group.save();
        logger_1.default.info("Group image uploaded", { groupId: id, userId: req.userId, imageUrl: uploadResult.secure_url });
        res.status(200).json({
            success: true,
            data: {
                profileImageUrl: uploadResult.secure_url,
            },
        });
    }
    catch (error) {
        logger_1.default.error("Error uploading group image", { error: error.message, groupId: req.params.id });
        res.status(500).json({ success: false, error: "Failed to upload group image" });
    }
});
exports.uploadGroupImage = uploadGroupImage;
/**
 * Add Members to Group (Bulk Add)
 */
const addGroupMembers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { userIds } = req.body || {};
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
            res.status(400).json({ success: false, error: "Invalid group ID" });
            return;
        }
        if (!Array.isArray(userIds) || userIds.length === 0) {
            res.status(400).json({ success: false, error: "Validation error: userIds must be a non-empty array" });
            return;
        }
        if (userIds.length > 50) {
            res.status(400).json({ success: false, error: "Validation error: maximum 50 users per request" });
            return;
        }
        // Validate all user IDs
        const invalidIds = userIds.filter((userId) => !mongoose_1.Types.ObjectId.isValid(userId));
        if (invalidIds.length > 0) {
            res.status(400).json({ success: false, error: `Validation error: invalid user IDs: ${invalidIds.join(", ")}` });
            return;
        }
        const group = yield group_model_1.Group.findById(id);
        if (!group) {
            res.status(404).json({ success: false, error: "Group not found" });
            return;
        }
        // Check if user is owner or admin
        const isOwner = String(group.ownerId) === String(req.userId);
        const userMember = group.members.find((m) => String(m.userId) === String(req.userId));
        const isAdmin = (userMember === null || userMember === void 0 ? void 0 : userMember.role) === "admin";
        if (!isOwner && !isAdmin) {
            res.status(403).json({ success: false, error: "Forbidden: Only group admins can add members" });
            return;
        }
        // Verify all users exist
        const users = yield user_model_1.User.find({ _id: { $in: userIds } });
        const existingUserIds = users.map((u) => String(u._id));
        const missingUserIds = userIds.filter((userId) => !existingUserIds.includes(userId));
        if (missingUserIds.length > 0) {
            res.status(400).json({ success: false, error: `Validation error: users not found: ${missingUserIds.join(", ")}` });
            return;
        }
        // Add new members (skip if already member)
        const addedMembers = [];
        const failedUsers = [];
        for (const userId of userIds) {
            const userIdObj = new mongoose_1.Types.ObjectId(userId);
            const isAlreadyMember = group.members.some((m) => String(m.userId) === userId);
            if (!isAlreadyMember) {
                group.members.push({
                    userId: userIdObj,
                    role: "member",
                    joinedAt: new Date(),
                });
                addedMembers.push(userIdObj);
            }
            else {
                failedUsers.push(userId);
            }
        }
        if (addedMembers.length > 0) {
            yield group.save();
        }
        // Populate member info
        const memberDocs = group.members
            .filter((m) => addedMembers.some((id) => String(id) === String(m.userId)))
            .map((m) => m.userId);
        const populatedMembers = yield user_model_1.User.find({ _id: { $in: memberDocs } })
            .select("firstName lastName username avatar")
            .lean();
        const formattedMembers = group.members
            .filter((m) => addedMembers.some((id) => String(id) === String(m.userId)))
            .map((m) => {
            const user = populatedMembers.find((u) => String(u._id) === String(m.userId));
            return {
                _id: String(m._id || m.userId),
                userId: String(m.userId),
                role: m.role,
                joinedAt: m.joinedAt,
                user: user
                    ? {
                        _id: String(user._id),
                        username: user.username,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        avatarUrl: user.avatar,
                    }
                    : null,
            };
        });
        logger_1.default.info("Group members added", { groupId: id, userId: req.userId, addedCount: addedMembers.length });
        res.status(200).json({
            success: true,
            data: {
                addedMembers: formattedMembers,
                failedUsers: failedUsers.map((id) => ({ userId: id, reason: "Already a member" })),
            },
        });
    }
    catch (error) {
        logger_1.default.error("Error adding group members", { error: error.message, groupId: req.params.id });
        res.status(500).json({ success: false, error: "Failed to add group members" });
    }
});
exports.addGroupMembers = addGroupMembers;
/**
 * Remove Member from Group
 */
const removeGroupMember = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id, userId } = req.params;
        if (!mongoose_1.Types.ObjectId.isValid(id) || !mongoose_1.Types.ObjectId.isValid(userId)) {
            res.status(400).json({ success: false, error: "Invalid group or user ID" });
            return;
        }
        const group = yield group_model_1.Group.findById(id);
        if (!group) {
            res.status(404).json({ success: false, error: "Group not found" });
            return;
        }
        // Check if trying to remove owner
        if (String(group.ownerId) === userId) {
            res.status(400).json({ success: false, error: "Cannot remove group owner" });
            return;
        }
        // Check if user is owner or admin
        const isOwner = String(group.ownerId) === String(req.userId);
        const userMember = group.members.find((m) => String(m.userId) === String(req.userId));
        const isAdmin = (userMember === null || userMember === void 0 ? void 0 : userMember.role) === "admin";
        if (!isOwner && !isAdmin) {
            res.status(403).json({ success: false, error: "Forbidden: Only group admins can remove members" });
            return;
        }
        // Check if target user is a member
        const targetMember = group.members.find((m) => String(m.userId) === userId);
        if (!targetMember) {
            res.status(404).json({ success: false, error: "User is not a member of this group" });
            return;
        }
        // Remove member
        group.members = group.members.filter((m) => String(m.userId) !== userId);
        yield group.save();
        logger_1.default.info("Group member removed", { groupId: id, removedUserId: userId, userId: req.userId });
        res.status(200).json({
            success: true,
            message: "Member removed successfully",
        });
    }
    catch (error) {
        logger_1.default.error("Error removing group member", { error: error.message, groupId: req.params.id });
        res.status(500).json({ success: false, error: "Failed to remove group member" });
    }
});
exports.removeGroupMember = removeGroupMember;
// Export multer middleware for route usage
exports.uploadMiddleware = upload.single("profileImage");
