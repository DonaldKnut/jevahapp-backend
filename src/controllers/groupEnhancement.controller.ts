import { Request, Response } from "express";
import { Group } from "../models/group.model";
import { User } from "../models/user.model";
import fileUploadService from "../service/fileUpload.service";
import mongoose, { Types } from "mongoose";
import logger from "../utils/logger";
import multer from "multer";

// Configure multer for image upload
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, and WebP images are allowed."));
    }
  },
});

/**
 * Upload Group Profile Image
 */
export const uploadGroupImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const file = req.file as Express.Multer.File;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, error: "Invalid group ID" });
      return;
    }

    if (!file) {
      res.status(400).json({ success: false, error: "No image file provided" });
      return;
    }

    const group = await Group.findById(id);
    if (!group) {
      res.status(404).json({ success: false, error: "Group not found" });
      return;
    }

    // Check if user is owner or admin
    const isOwner = String(group.ownerId) === String(req.userId);
    const userMember = group.members.find((m: any) => String(m.userId) === String(req.userId));
    const isAdmin = userMember?.role === "admin";

    if (!isOwner && !isAdmin) {
      res.status(403).json({ success: false, error: "Forbidden: Only group admins can upload images" });
      return;
    }

    // Upload image to cloud storage
    const uploadResult = await fileUploadService.uploadMedia(
      file.buffer,
      `groups/${id}`,
      file.mimetype
    );

    // Update group with image URL
    group.profileImageUrl = uploadResult.secure_url;
    await group.save();

    logger.info("Group image uploaded", { groupId: id, userId: req.userId, imageUrl: uploadResult.secure_url });

    res.status(200).json({
      success: true,
      data: {
        profileImageUrl: uploadResult.secure_url,
      },
    });
  } catch (error: any) {
    logger.error("Error uploading group image", { error: error.message, groupId: req.params.id });
    res.status(500).json({ success: false, error: "Failed to upload group image" });
  }
};

/**
 * Add Members to Group (Bulk Add)
 */
export const addGroupMembers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { userIds } = req.body || {};

    if (!Types.ObjectId.isValid(id)) {
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
    const invalidIds = userIds.filter((userId: any) => !Types.ObjectId.isValid(userId));
    if (invalidIds.length > 0) {
      res.status(400).json({ success: false, error: `Validation error: invalid user IDs: ${invalidIds.join(", ")}` });
      return;
    }

    const group = await Group.findById(id);
    if (!group) {
      res.status(404).json({ success: false, error: "Group not found" });
      return;
    }

    // Check if user is owner or admin
    const isOwner = String(group.ownerId) === String(req.userId);
    const userMember = group.members.find((m: any) => String(m.userId) === String(req.userId));
    const isAdmin = userMember?.role === "admin";

    if (!isOwner && !isAdmin) {
      res.status(403).json({ success: false, error: "Forbidden: Only group admins can add members" });
      return;
    }

    // Verify all users exist
    const users = await User.find({ _id: { $in: userIds } });
    const existingUserIds = users.map((u) => String(u._id));
    const missingUserIds = userIds.filter((userId: string) => !existingUserIds.includes(userId));

    if (missingUserIds.length > 0) {
      res.status(400).json({ success: false, error: `Validation error: users not found: ${missingUserIds.join(", ")}` });
      return;
    }

    // Add new members (skip if already member)
    const addedMembers: any[] = [];
    const failedUsers: string[] = [];

    for (const userId of userIds) {
      const userIdObj = new Types.ObjectId(userId);
      const isAlreadyMember = group.members.some((m: any) => String(m.userId) === userId);

      if (!isAlreadyMember) {
        group.members.push({
          userId: userIdObj,
          role: "member",
          joinedAt: new Date(),
        });
        addedMembers.push(userIdObj);
      } else {
        failedUsers.push(userId);
      }
    }

    if (addedMembers.length > 0) {
      await group.save();
    }

    // Populate member info
    const memberDocs = group.members
      .filter((m: any) => addedMembers.some((id) => String(id) === String(m.userId)))
      .map((m: any) => m.userId);

    const populatedMembers = await User.find({ _id: { $in: memberDocs } })
      .select("firstName lastName username avatar")
      .lean();

    const formattedMembers = group.members
      .filter((m: any) => addedMembers.some((id) => String(id) === String(m.userId)))
      .map((m: any) => {
        const user = populatedMembers.find((u: any) => String(u._id) === String(m.userId));
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

    logger.info("Group members added", { groupId: id, userId: req.userId, addedCount: addedMembers.length });

    res.status(200).json({
      success: true,
      data: {
        addedMembers: formattedMembers,
        failedUsers: failedUsers.map((id) => ({ userId: id, reason: "Already a member" })),
      },
    });
  } catch (error: any) {
    logger.error("Error adding group members", { error: error.message, groupId: req.params.id });
    res.status(500).json({ success: false, error: "Failed to add group members" });
  }
};

/**
 * Remove Member from Group
 */
export const removeGroupMember = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, userId } = req.params;

    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(userId)) {
      res.status(400).json({ success: false, error: "Invalid group or user ID" });
      return;
    }

    const group = await Group.findById(id);
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
    const userMember = group.members.find((m: any) => String(m.userId) === String(req.userId));
    const isAdmin = userMember?.role === "admin";

    if (!isOwner && !isAdmin) {
      res.status(403).json({ success: false, error: "Forbidden: Only group admins can remove members" });
      return;
    }

    // Check if target user is a member
    const targetMember = group.members.find((m: any) => String(m.userId) === userId);
    if (!targetMember) {
      res.status(404).json({ success: false, error: "User is not a member of this group" });
      return;
    }

    // Remove member
    group.members = group.members.filter((m: any) => String(m.userId) !== userId);
    await group.save();

    logger.info("Group member removed", { groupId: id, removedUserId: userId, userId: req.userId });

    res.status(200).json({
      success: true,
      message: "Member removed successfully",
    });
  } catch (error: any) {
    logger.error("Error removing group member", { error: error.message, groupId: req.params.id });
    res.status(500).json({ success: false, error: "Failed to remove group member" });
  }
};

// Export multer middleware for route usage
export const uploadMiddleware = upload.single("profileImage");

