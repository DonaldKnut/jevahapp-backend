import { Request, Response } from "express";
import { Types } from "mongoose";
import { Media } from "../models/media.model";
import {
  shapeSermonCard,
  publicSermonFilter,
} from "../modules/sermons/sermon.formatter";
import {
  decodeCatalogCursor,
  catalogCursorFilter,
  nextCatalogCursorFromDoc,
} from "../modules/audio/catalogCursor";
import logger from "../utils/logger";

const SERMON_SELECT =
  "title description speaker church scripture series category topics language duration durationSec thumbnailUrl coverImageUrl fileUrl playbackUrl hlsUrl fileMimeType mediaType viewCount likeCount totalViews totalLikes moderationStatus isHidden publicationState publishedAt processing createdAt updatedAt";

/**
 * GET /api/sermons?page&limit&search&series&topic&language&cursor
 */
export const listPublicSermons = async (req: Request, res: Response) => {
  try {
    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit || "20"), 10) || 20, 1),
      50
    );
    const page = Math.max(parseInt(String(req.query.page || "1"), 10) || 1, 1);
    const search = String(req.query.search || "").trim();
    const series = String(req.query.series || "").trim();
    const topic = String(req.query.topic || req.query.topics || "").trim();
    const language = String(req.query.language || "").trim();
    const cursor = decodeCatalogCursor(String(req.query.cursor || ""));

    const filter: Record<string, unknown> = publicSermonFilter();
    const andExtra: Record<string, unknown>[] = [];

    if (series) {
      andExtra.push({ series: new RegExp(series, "i") });
    }
    if (topic) {
      andExtra.push({ topics: new RegExp(topic, "i") });
    }
    if (language) {
      andExtra.push({ language: new RegExp(`^${language}$`, "i") });
    }
    if (search.length >= 2) {
      andExtra.push({
        $or: [
          { title: new RegExp(search, "i") },
          { speaker: new RegExp(search, "i") },
          { church: new RegExp(search, "i") },
          { series: new RegExp(search, "i") },
          { scripture: new RegExp(search, "i") },
          { description: new RegExp(search, "i") },
        ],
      });
    }
    const cursorClause = catalogCursorFilter(cursor, "publishedAt", "desc");
    if (cursorClause) andExtra.push(cursorClause);
    if (andExtra.length) {
      const existing = Array.isArray((filter as any).$and)
        ? (filter as any).$and
        : [];
      (filter as any).$and = [...existing, ...andExtra];
    }

    const q = Media.find(filter)
      .select(SERMON_SELECT)
      .sort({ publishedAt: -1, _id: -1 });
    if (!cursor) q.skip((page - 1) * limit);

    const [rows, total] = await Promise.all([
      q.limit(limit + 1).lean(),
      Media.countDocuments(filter),
    ]);

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const items = pageRows.map(shapeSermonCard);
    // Only return playable ready items (belt + suspenders)
    const playable = items.filter(
      (s) => s.processingStatus === "ready" && s.playbackUrl
    );

    const nextCursor =
      hasMore && pageRows.length
        ? nextCatalogCursorFromDoc(pageRows[pageRows.length - 1], "publishedAt")
        : null;

    res.status(200).json({
      success: true,
      data: {
        items: playable.length ? playable : items.filter((s) => s.playbackUrl),
        total,
        page: cursor ? undefined : page,
        limit,
        nextCursor,
        hasMore,
        pagination: {
          page: cursor ? undefined : page,
          limit,
          total,
          pages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (error: any) {
    logger.error("List public sermons error", { error: error.message });
    res.status(200).json({
      success: true,
      data: {
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        pagination: { page: 1, limit: 20, total: 0, pages: 0 },
      },
    });
  }
};

/**
 * GET /api/sermons/featured
 */
export const listFeaturedSermons = async (_req: Request, res: Response) => {
  try {
    const rows = await Media.find(publicSermonFilter())
      .select(SERMON_SELECT)
      .sort({ viewCount: -1, publishedAt: -1 })
      .limit(3)
      .lean();
    const items = rows
      .map(shapeSermonCard)
      .filter((s) => s.playbackUrl && s.processingStatus === "ready");
    res.status(200).json({ success: true, data: { items } });
  } catch (error: any) {
    logger.error("Featured sermons error", { error: error.message });
    res.status(200).json({ success: true, data: { items: [] } });
  }
};

/**
 * GET /api/sermons/topics
 */
export const listSermonTopics = async (_req: Request, res: Response) => {
  try {
    const [byTopic, bySeries] = await Promise.all([
      Media.aggregate([
        { $match: publicSermonFilter() },
        { $unwind: { path: "$topics", preserveNullAndEmptyArrays: false } },
        {
          $group: {
            _id: { $toLower: "$topics" },
            label: { $first: "$topics" },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 40 },
      ]),
      Media.aggregate([
        {
          $match: {
            ...publicSermonFilter(),
            series: { $exists: true, $nin: [null, ""] },
          },
        },
        {
          $group: {
            _id: { $toLower: "$series" },
            label: { $first: "$series" },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 40 },
      ]),
    ]);

    const topics = byTopic.map((t: any) => ({
      slug: String(t._id || "").replace(/\s+/g, "_"),
      label: t.label,
      count: t.count,
      kind: "topic" as const,
    }));
    const series = bySeries.map((t: any) => ({
      slug: String(t._id || "").replace(/\s+/g, "_"),
      label: t.label,
      count: t.count,
      kind: "series" as const,
    }));

    res.status(200).json({
      success: true,
      data: { items: [...topics, ...series], topics, series },
    });
  } catch (error: any) {
    logger.error("Sermon topics error", { error: error.message });
    res.status(200).json({ success: true, data: { items: [], topics: [], series: [] } });
  }
};

/**
 * GET /api/sermons/:id
 */
export const getPublicSermonById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid sermon id" });
      return;
    }
    const doc = await Media.findOne({
      _id: id,
      ...publicSermonFilter(),
    })
      .select(SERMON_SELECT)
      .lean();

    if (!doc) {
      res.status(404).json({ success: false, message: "Sermon not found" });
      return;
    }
    const card = shapeSermonCard(doc);
    if (!card.playbackUrl) {
      res.status(404).json({ success: false, message: "Sermon not playable yet" });
      return;
    }
    res.status(200).json({ success: true, data: card });
  } catch (error: any) {
    logger.error("Get sermon error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to load sermon" });
  }
};
