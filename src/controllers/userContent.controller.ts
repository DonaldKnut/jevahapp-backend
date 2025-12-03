import { Request, Response } from "express";
import mongoose from "mongoose";
import { Media } from "../models/media.model";

function getTargetUserId(req: Request): mongoose.Types.ObjectId | null {
  const userId = (req.query.userId as string) || req.userId;
  if (!userId) return null;
  return new mongoose.Types.ObjectId(userId);
}

function parsePaging(req: Request) {
  const page = Math.max(parseInt(String(req.query.page || "1"), 10) || 1, 1);
  const limit = Math.min(
    Math.max(parseInt(String(req.query.limit || "20"), 10) || 20, 1),
    50
  );
  const skip = (page - 1) * limit;
  const sortParam = String(req.query.sort || "recent");
  const sort: Record<string, 1 | -1> =
    sortParam === "popular"
      ? { likeCount: -1, viewCount: -1, createdAt: -1 }
      : { createdAt: -1 };
  return { page, limit, skip, sort };
}

export async function getProfileTabs(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const targetId = getTargetUserId(req);
    if (!targetId) {
      res.status(400).json({ success: false, message: "userId required" });
      return;
    }

    const [photosCount, postsCount, videosCount, audiosCount] =
      await Promise.all([
        Media.countDocuments({
          uploadedBy: targetId,
          contentType: { $in: ["image"] },
        }),
        Media.countDocuments({
          uploadedBy: targetId,
          contentType: { $in: ["ebook", "devotional", "sermon"] },
        }),
        Media.countDocuments({
          uploadedBy: targetId,
          contentType: { $in: ["videos", "sermon", "live", "recording"] },
        }),
        Media.countDocuments({
          uploadedBy: targetId,
          contentType: { $in: ["audio", "music", "podcast"] },
        }),
      ]);

    const tabs: Array<{ key: string; label: string; count: number }> = [];
    if (photosCount > 0)
      tabs.push({ key: "photos", label: "Photos", count: photosCount });
    if (postsCount > 0)
      tabs.push({ key: "posts", label: "Posts", count: postsCount });
    if (videosCount > 0)
      tabs.push({ key: "videos", label: "Videos", count: videosCount });
    if (audiosCount > 0)
      tabs.push({ key: "audios", label: "Audios", count: audiosCount });

    res.status(200).json({
      success: true,
      user: {
        id: targetId.toString(),
        displayName: req.user?.firstName || "",
        avatarUrl: req.user?.avatarUpload || req.user?.avatar || undefined,
      },
      tabs,
    });
    return;
  } catch (e) {
    res.status(500).json({ success: false, message: "Internal server error" });
    return;
  }
}

async function listByContentTypes(
  req: Request,
  res: Response,
  types: string[],
  map: (doc: any) => any
) {
  try {
    const targetId = getTargetUserId(req);
    if (!targetId) {
      res.status(400).json({ success: false, message: "userId required" });
      return;
    }
    const { page, limit, skip, sort } = parsePaging(req);
    const [items, total] = await Promise.all([
      Media.find({ uploadedBy: targetId, contentType: { $in: types } })
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Media.countDocuments({
        uploadedBy: targetId,
        contentType: { $in: types },
      }),
    ]);
    res.status(200).json({
      success: true,
      items: items.map(map),
      page,
      pageSize: limit,
      total,
    });
    return;
  } catch (e) {
    res.status(500).json({ success: false, message: "Internal server error" });
    return;
  }
}

export function getUserPhotos(req: Request, res: Response) {
  return listByContentTypes(req, res, ["image"], d => ({
    id: d._id,
    type: "photo",
    url: d.fileUrl || d.coverImageUrl,
    thumbnailUrl: d.thumbnailUrl,
    createdAt: d.createdAt,
    likes: d.likeCount || 0,
    comments: d.commentCount || 0,
  }));
}

export function getUserPosts(req: Request, res: Response) {
  return listByContentTypes(req, res, ["ebook", "devotional", "sermon"], d => ({
    id: d._id,
    type: "post",
    title: d.title,
    body: d.description,
    imageUrl: d.thumbnailUrl || d.coverImageUrl,
    createdAt: d.createdAt,
    likes: d.likeCount || 0,
    comments: d.commentCount || 0,
  }));
}

export function getUserVideos(req: Request, res: Response) {
  return listByContentTypes(
    req,
    res,
    ["videos", "sermon", "live", "recording"],
    d => ({
      id: d._id,
      type: "video",
      title: d.title,
      fileUrl: d.fileUrl || d.playbackUrl || d.hlsUrl,
      thumbnailUrl: d.thumbnailUrl,
      durationSec: d.duration || 0,
      createdAt: d.createdAt,
      views: d.viewCount || d.totalViews || 0,
      likes: d.likeCount || 0,
      comments: d.commentCount || 0,
    })
  );
}

export function getUserAudios(req: Request, res: Response) {
  return listByContentTypes(req, res, ["audio", "music", "podcast"], d => ({
    id: d._id,
    type: "audio",
    title: d.title,
    fileUrl: d.fileUrl,
    durationSec: d.duration || 0,
    createdAt: d.createdAt,
    plays: d.listenCount || 0,
    likes: d.likeCount || 0,
    comments: d.commentCount || 0,
  }));
}

/**
 * Get all user's uploaded content with basic engagement metrics
 * Unified endpoint for listing all content by the authenticated user
 */
export async function getMyContent(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    const { page, limit, skip, sort } = parsePaging(req);
    const contentType = req.query.contentType as string | undefined;

    // Build query
    const query: any = {
      uploadedBy: new mongoose.Types.ObjectId(userId),
    };

    // Filter by content type if provided
    if (contentType && contentType !== "all") {
      const typeMap: { [key: string]: string[] } = {
        video: ["videos", "sermon", "live", "recording"],
        audio: ["audio", "music", "podcast"],
        photo: ["image"],
        post: ["ebook", "devotional", "sermon"],
      };
      if (typeMap[contentType]) {
        query.contentType = { $in: typeMap[contentType] };
      } else {
        query.contentType = contentType;
      }
    }

    // Get content with pagination
    const [items, total] = await Promise.all([
      Media.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .select("_id title description contentType thumbnailUrl fileUrl viewCount likeCount commentCount shareCount downloadCount createdAt updatedAt")
        .lean(),
      Media.countDocuments(query),
    ]);

    // Format response with engagement metrics
    const formattedItems = items.map((doc: any) => ({
      id: doc._id.toString(),
      title: doc.title || "Untitled",
      description: doc.description || "",
      contentType: doc.contentType,
      thumbnailUrl: doc.thumbnailUrl,
      fileUrl: doc.fileUrl,
      engagement: {
        views: doc.viewCount || 0,
        likes: doc.likeCount || 0,
        comments: doc.commentCount || 0,
        shares: doc.shareCount || 0,
        downloads: doc.downloadCount || 0,
      },
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }));

    res.status(200).json({
      success: true,
      data: formattedItems,
      pagination: {
        page,
        pageSize: limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("Get my content error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve your content",
      error: error.message,
    });
  }
}

export async function getUserContentById(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ success: false, message: "invalid id" });
      return;
    }
    const doc = await Media.findById(id);
    if (!doc) {
      res.status(404).json({ success: false, message: "not found" });
      return;
    }
    let item: any;
    if (["videos", "sermon", "live", "recording"].includes(doc.contentType)) {
      item = {
        id: doc._id,
        type: "video",
        title: doc.title,
        fileUrl: doc.fileUrl || doc.playbackUrl || doc.hlsUrl,
        thumbnailUrl: doc.thumbnailUrl,
        durationSec: doc.duration || 0,
        createdAt: doc.createdAt,
        views: doc.viewCount || doc.totalViews || 0,
        likes: doc.likeCount || 0,
        comments: doc.commentCount || 0,
        description: doc.description,
        tags: doc.tags,
      };
    } else if (["audio", "music", "podcast"].includes(doc.contentType)) {
      item = {
        id: doc._id,
        type: "audio",
        title: doc.title,
        fileUrl: doc.fileUrl,
        durationSec: doc.duration || 0,
        createdAt: doc.createdAt,
        plays: doc.listenCount || 0,
        likes: doc.likeCount || 0,
        comments: doc.commentCount || 0,
        description: doc.description,
        tags: doc.tags,
      };
    } else if (["ebook", "devotional", "sermon"].includes(doc.contentType)) {
      item = {
        id: doc._id,
        type: "post",
        title: doc.title,
        body: doc.description,
        imageUrl: doc.thumbnailUrl || doc.coverImageUrl,
        createdAt: doc.createdAt,
        likes: doc.likeCount || 0,
        comments: doc.commentCount || 0,
        tags: doc.tags,
      };
    } else {
      item = {
        id: doc._id,
        type: "photo",
        url: doc.fileUrl || doc.coverImageUrl,
        thumbnailUrl: doc.thumbnailUrl,
        createdAt: doc.createdAt,
        likes: doc.likeCount || 0,
        comments: doc.commentCount || 0,
      };
    }
    res.status(200).json({ success: true, item });
    return;
  } catch (e) {
    res.status(500).json({ success: false, message: "Internal server error" });
    return;
  }
}
