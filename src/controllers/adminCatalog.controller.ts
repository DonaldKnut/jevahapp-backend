import { Request, Response } from "express";
import { Types } from "mongoose";
import { Announcement } from "../models/announcement.model";
import { ContentCategory } from "../models/contentCategory.model";
import { AuditService } from "../service/audit.service";
import { TRACK_CATEGORIES } from "../modules/audio/track.constants";
import logger from "../utils/logger";

function shapeAnnouncement(doc: any) {
  return {
    id: doc._id.toString(),
    title: doc.title,
    body: doc.body,
    audience: doc.audience,
    status: doc.status,
    startsAt: doc.startsAt || null,
    endsAt: doc.endsAt || null,
    publishedAt: doc.publishedAt || null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export const listAdminAnnouncements = async (req: Request, res: Response) => {
  try {
    const page = Math.max(parseInt(String(req.query.page || "1"), 10) || 1, 1);
    const limit = Math.min(parseInt(String(req.query.limit || "20"), 10) || 20, 100);
    const status = String(req.query.status || "").trim();
    const query: Record<string, unknown> = {};
    if (status) query.status = status;
    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      Announcement.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Announcement.countDocuments(query),
    ]);
    res.status(200).json({
      success: true,
      data: {
        items: rows.map(shapeAnnouncement),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
      },
    });
  } catch (error: any) {
    logger.error("List announcements error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to list announcements" });
  }
};

export const createAdminAnnouncement = async (req: Request, res: Response) => {
  try {
    const adminId = req.userId;
    if (!adminId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const { title, body, audience, status, startsAt, endsAt } = req.body || {};
    if (!title?.trim() || !body?.trim()) {
      res.status(400).json({ success: false, message: "title and body are required" });
      return;
    }
    const st = status === "published" ? "published" : status === "archived" ? "archived" : "draft";
    const doc = await Announcement.create({
      title: title.trim(),
      body: body.trim(),
      audience: audience || "all",
      status: st,
      startsAt: startsAt ? new Date(startsAt) : null,
      endsAt: endsAt ? new Date(endsAt) : null,
      createdByAdminId: adminId,
      publishedAt: st === "published" ? new Date() : null,
    });
    await AuditService.logAdminAction(adminId, "create_announcement", doc._id.toString(), {
      status: st,
    });
    res.status(201).json({ success: true, data: shapeAnnouncement(doc) });
  } catch (error: any) {
    logger.error("Create announcement error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to create announcement" });
  }
};

export const patchAdminAnnouncement = async (req: Request, res: Response) => {
  try {
    const adminId = req.userId;
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid id" });
      return;
    }
    const doc = await Announcement.findById(id);
    if (!doc) {
      res.status(404).json({ success: false, message: "Not found" });
      return;
    }
    const body = req.body || {};
    if (typeof body.title === "string") doc.title = body.title.trim();
    if (typeof body.body === "string") doc.body = body.body;
    if (body.audience) doc.audience = body.audience;
    if (["draft", "published", "archived"].includes(body.status)) {
      doc.status = body.status;
      if (body.status === "published" && !doc.publishedAt) doc.publishedAt = new Date();
    }
    if (body.startsAt !== undefined) {
      doc.startsAt = body.startsAt ? new Date(body.startsAt) : null;
    }
    if (body.endsAt !== undefined) {
      doc.endsAt = body.endsAt ? new Date(body.endsAt) : null;
    }
    await doc.save();
    if (adminId) {
      await AuditService.logAdminAction(adminId, "update_announcement", id, {
        status: doc.status,
      });
    }
    res.status(200).json({ success: true, data: shapeAnnouncement(doc) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Failed to update announcement" });
  }
};

/** Public active announcements for mobile / app */
export const listPublicAnnouncements = async (req: Request, res: Response) => {
  try {
    const audience = String(req.query.audience || "mobile");
    const now = new Date();
    const rows = await Announcement.find({
      status: "published",
      audience: { $in: ["all", audience] },
      $and: [
        { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
        { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
      ],
    })
      .sort({ publishedAt: -1 })
      .limit(20)
      .lean();
    res.status(200).json({
      success: true,
      data: { items: rows.map(shapeAnnouncement) },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Failed to load announcements" });
  }
};

function shapeCategory(doc: any) {
  return {
    id: doc._id.toString(),
    key: doc.key,
    label: doc.label,
    kind: doc.kind,
    sortOrder: doc.sortOrder,
    isActive: doc.isActive,
  };
}

export const listAdminCategories = async (_req: Request, res: Response) => {
  try {
    const rows = await ContentCategory.find().sort({ sortOrder: 1, key: 1 }).lean();
    // Seed defaults into response if empty (non-destructive)
    if (rows.length === 0) {
      res.status(200).json({
        success: true,
        data: {
          items: TRACK_CATEGORIES.map((key, i) => ({
            id: null,
            key,
            label: key.replace(/_/g, " "),
            kind: "audio",
            sortOrder: i,
            isActive: true,
            ephemeral: true,
          })),
        },
      });
      return;
    }
    res.status(200).json({ success: true, data: { items: rows.map(shapeCategory) } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Failed to list categories" });
  }
};

export const upsertAdminCategory = async (req: Request, res: Response) => {
  try {
    const adminId = req.userId;
    const { key, label, kind, sortOrder, isActive } = req.body || {};
    if (!key?.trim() || !label?.trim()) {
      res.status(400).json({ success: false, message: "key and label are required" });
      return;
    }
    const normalized = String(key).trim().toLowerCase().replace(/\s+/g, "_");
    const doc = await ContentCategory.findOneAndUpdate(
      { key: normalized },
      {
        $set: {
          label: label.trim(),
          kind: kind || "both",
          sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
          isActive: isActive !== false,
        },
        $setOnInsert: { key: normalized },
      },
      { upsert: true, new: true }
    );
    if (adminId) {
      await AuditService.logAdminAction(adminId, "upsert_category", doc._id.toString(), {
        key: normalized,
      });
    }
    res.status(200).json({ success: true, data: shapeCategory(doc) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Failed to save category" });
  }
};

export const deleteAdminCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid id" });
      return;
    }
    await ContentCategory.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: "Category deleted" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Failed to delete category" });
  }
};
