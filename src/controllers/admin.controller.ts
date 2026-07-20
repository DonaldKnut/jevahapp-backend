import { Request, Response } from "express";
import { User } from "../models/user.model";
import { isMasterAdminUser } from "../config/superAdmin";

/**
 * Get all users (admin only)
 */
export const getAllUsers = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const users = await User.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
};

/**
 * Update a user's role (admin only) — legacy controller.
 * Prefer PATCH /api/admin/users/:id/role (master-admin gated).
 */
export const updateUserRole = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const adminId = req.userId;

    if (!role) {
      res.status(400).json({ success: false, message: "Role is required" });
      return;
    }

    const actor = await User.findById(adminId).select("email role");
    if (!isMasterAdminUser(actor)) {
      res.status(403).json({
        success: false,
        message: "Only the master admin can change user roles",
        code: "MASTER_ADMIN_REQUIRED",
      });
      return;
    }

    const existing = await User.findById(id).select("email role");
    if (!existing) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    if (isMasterAdminUser(existing) && role !== "admin") {
      res.status(403).json({
        success: false,
        message: "Cannot change the role of the master admin account",
        code: "MASTER_ADMIN_PROTECTED",
      });
      return;
    }

    const user = await User.findByIdAndUpdate(id, { role }, { new: true });

    res.status(200).json({
      success: true,
      message: "User role updated successfully",
      user,
    });
  } catch (error) {
    console.error("Update role error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update user role",
    });
  }
};
