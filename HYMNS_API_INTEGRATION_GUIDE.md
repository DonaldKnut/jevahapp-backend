# Hymns API Integration Guide

## Overview

This guide shows how to integrate free hymns APIs with your existing audio UI and backend to create a hymns section.

## Recommended Free APIs

### 1. Hymnary.org API (Primary Choice)

```typescript
// Base URL: https://hymnary.org/api
// Free tier: 1000 requests/month
// Response format: JSON with hymns, lyrics, metadata
```

### 2. Open Hymnal API (Backup)

```typescript
// Base URL: https://openhymnal.org/api
// Free tier: Unlimited
// Response format: JSON with traditional hymns
```

## Backend Implementation

### 1. Create Hymns Model

```typescript
// src/models/hymn.model.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IHymn extends Document {
  title: string;
  author: string;
  composer?: string;
  year?: number;
  category: string;
  lyrics: string[];
  audioUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  hymnNumber?: string;
  meter?: string;
  key?: string;
  scripture?: string[];
  tags: string[];
  source: "hymnary" | "openhymnal" | "manual";
  externalId: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const hymnSchema = new Schema<IHymn>(
  {
    title: { type: String, required: true, index: true },
    author: { type: String, required: true },
    composer: { type: String },
    year: { type: Number },
    category: {
      type: String,
      required: true,
      enum: [
        "praise",
        "worship",
        "traditional",
        "contemporary",
        "gospel",
        "christmas",
        "easter",
      ],
      index: true,
    },
    lyrics: [{ type: String }],
    audioUrl: { type: String },
    thumbnailUrl: { type: String },
    duration: { type: Number },
    hymnNumber: { type: String },
    meter: { type: String },
    key: { type: String },
    scripture: [{ type: String }],
    tags: [{ type: String, index: true }],
    source: {
      type: String,
      enum: ["hymnary", "openhymnal", "manual"],
      default: "manual",
    },
    externalId: { type: String, index: true },
    viewCount: { type: Number, default: 0 },
    likeCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    shareCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Indexes for better performance
hymnSchema.index({ title: "text", author: "text", lyrics: "text" });
hymnSchema.index({ category: 1, isActive: 1 });
hymnSchema.index({ source: 1, externalId: 1 });

export const Hymn =
  mongoose.models.Hymn || mongoose.model<IHymn>("Hymn", hymnSchema);
```

### 2. Create Hymns Service

```typescript
// src/service/hymns.service.ts
import { Hymn, IHymn } from "../models/hymn.model";
import logger from "../utils/logger";

export class HymnsService {
  /**
   * Fetch hymns from external API and sync with database
   */
  static async syncHymnsFromAPI(
    source: "hymnary" | "openhymnal" = "hymnary"
  ): Promise<void> {
    try {
      let hymns: any[] = [];

      if (source === "hymnary") {
        hymns = await this.fetchFromHymnary();
      } else if (source === "openhymnal") {
        hymns = await this.fetchFromOpenHymnal();
      }

      for (const hymnData of hymns) {
        await this.upsertHymn(hymnData, source);
      }

      logger.info(`Synced ${hymns.length} hymns from ${source}`);
    } catch (error: any) {
      logger.error("Error syncing hymns:", error);
      throw error;
    }
  }

  /**
   * Fetch hymns from Hymnary.org API
   */
  private static async fetchFromHymnary(): Promise<any[]> {
    try {
      // Note: Replace with actual Hymnary.org API endpoint
      const response = await fetch("https://hymnary.org/api/hymns?limit=50");

      if (!response.ok) {
        throw new Error(`Hymnary API error: ${response.status}`);
      }

      const data = await response.json();
      return data.hymns || [];
    } catch (error) {
      logger.warn("Hymnary API unavailable, using fallback data");
      return this.getFallbackHymns();
    }
  }

  /**
   * Fetch hymns from Open Hymnal API
   */
  private static async fetchFromOpenHymnal(): Promise<any[]> {
    try {
      // Note: Replace with actual Open Hymnal API endpoint
      const response = await fetch("https://openhymnal.org/api/hymns");

      if (!response.ok) {
        throw new Error(`Open Hymnal API error: ${response.status}`);
      }

      const data = await response.json();
      return data.hymns || [];
    } catch (error) {
      logger.warn("Open Hymnal API unavailable, using fallback data");
      return this.getFallbackHymns();
    }
  }

  /**
   * Fallback hymns data for development/testing
   */
  private static getFallbackHymns(): any[] {
    return [
      {
        title: "Amazing Grace",
        author: "John Newton",
        composer: "Traditional",
        year: 1779,
        category: "traditional",
        lyrics: [
          "Amazing grace! How sweet the sound",
          "That saved a wretch like me!",
          "I once was lost, but now am found;",
          "Was blind, but now I see.",
        ],
        hymnNumber: "1",
        meter: "8.6.8.6",
        key: "C Major",
        scripture: ["Ephesians 2:8-9"],
        tags: ["grace", "salvation", "traditional"],
        externalId: "amazing-grace-1",
      },
      {
        title: "How Great Thou Art",
        author: "Carl Boberg",
        composer: "Stuart Hine",
        year: 1885,
        category: "praise",
        lyrics: [
          "O Lord my God, when I in awesome wonder",
          "Consider all the worlds Thy hands have made",
          "I see the stars, I hear the rolling thunder",
          "Thy power throughout the universe displayed",
        ],
        hymnNumber: "2",
        meter: "11.10.11.10",
        key: "G Major",
        scripture: ["Psalm 8:3-4"],
        tags: ["praise", "creation", "worship"],
        externalId: "how-great-thou-art-2",
      },
    ];
  }

  /**
   * Upsert hymn to database
   */
  private static async upsertHymn(
    hymnData: any,
    source: string
  ): Promise<IHymn> {
    const filter = {
      source: source as any,
      externalId: hymnData.externalId,
    };

    const update = {
      title: hymnData.title,
      author: hymnData.author,
      composer: hymnData.composer,
      year: hymnData.year,
      category: hymnData.category,
      lyrics: hymnData.lyrics,
      hymnNumber: hymnData.hymnNumber,
      meter: hymnData.meter,
      key: hymnData.key,
      scripture: hymnData.scripture,
      tags: hymnData.tags,
      source: source as any,
      externalId: hymnData.externalId,
      isActive: true,
    };

    return await Hymn.findOneAndUpdate(filter, update, {
      upsert: true,
      new: true,
    });
  }

  /**
   * Get hymns with pagination and filtering
   */
  static async getHymns(
    options: {
      page?: number;
      limit?: number;
      category?: string;
      search?: string;
      sortBy?: "title" | "author" | "year" | "viewCount" | "likeCount";
      sortOrder?: "asc" | "desc";
    } = {}
  ): Promise<{
    hymns: IHymn[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const {
      page = 1,
      limit = 20,
      category,
      search,
      sortBy = "title",
      sortOrder = "asc",
    } = options;

    const query: any = { isActive: true };

    // Add category filter
    if (category) {
      query.category = category;
    }

    // Add search filter
    if (search) {
      query.$text = { $search: search };
    }

    // Build sort object
    const sort: any = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    const skip = (page - 1) * limit;

    const [hymns, total] = await Promise.all([
      Hymn.find(query).sort(sort).skip(skip).limit(limit).lean(),
      Hymn.countDocuments(query),
    ]);

    return {
      hymns,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get hymn by ID
   */
  static async getHymnById(id: string): Promise<IHymn | null> {
    return await Hymn.findById(id);
  }

  /**
   * Increment view count
   */
  static async incrementViewCount(id: string): Promise<void> {
    await Hymn.findByIdAndUpdate(id, { $inc: { viewCount: 1 } });
  }

  /**
   * Update interaction counts
   */
  static async updateInteractionCounts(
    id: string,
    updates: {
      likeCount?: number;
      commentCount?: number;
      shareCount?: number;
    }
  ): Promise<void> {
    const updateFields: any = {};
    if (updates.likeCount !== undefined)
      updateFields.likeCount = updates.likeCount;
    if (updates.commentCount !== undefined)
      updateFields.commentCount = updates.commentCount;
    if (updates.shareCount !== undefined)
      updateFields.shareCount = updates.shareCount;

    await Hymn.findByIdAndUpdate(id, updateFields);
  }
}
```

### 3. Create Hymns Controller

```typescript
// src/controllers/hymns.controller.ts
import { Request, Response } from "express";
import { HymnsService } from "../service/hymns.service";
import logger from "../utils/logger";

/**
 * Get hymns with pagination and filtering
 */
export const getHymns = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      search,
      sortBy = "title",
      sortOrder = "asc",
    } = req.query;

    const result = await HymnsService.getHymns({
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      category: category as string,
      search: search as string,
      sortBy: sortBy as any,
      sortOrder: sortOrder as any,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error("Get hymns error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get hymns",
    });
  }
};

/**
 * Get hymn by ID
 */
export const getHymnById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const hymn = await HymnsService.getHymnById(id);

    if (!hymn) {
      res.status(404).json({
        success: false,
        message: "Hymn not found",
      });
      return;
    }

    // Increment view count
    await HymnsService.incrementViewCount(id);

    res.status(200).json({
      success: true,
      data: hymn,
    });
  } catch (error: any) {
    logger.error("Get hymn by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get hymn",
    });
  }
};

/**
 * Sync hymns from external APIs
 */
export const syncHymns = async (req: Request, res: Response): Promise<void> => {
  try {
    const { source = "hymnary" } = req.body;

    await HymnsService.syncHymnsFromAPI(source as any);

    res.status(200).json({
      success: true,
      message: `Hymns synced successfully from ${source}`,
    });
  } catch (error: any) {
    logger.error("Sync hymns error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to sync hymns",
    });
  }
};
```

### 4. Create Hymns Routes

```typescript
// src/routes/hymns.routes.ts
import express from "express";
import { verifyToken } from "../middleware/auth.middleware";
import { rateLimiter } from "../middleware/rateLimiter";
import {
  getHymns,
  getHymnById,
  syncHymns,
} from "../controllers/hymns.controller";

const router = express.Router();

/**
 * @route   GET /api/hymns
 * @desc    Get hymns with pagination and filtering
 * @access  Public
 * @query   { page?: number, limit?: number, category?: string, search?: string, sortBy?: string, sortOrder?: string }
 */
router.get("/", getHymns);

/**
 * @route   GET /api/hymns/:id
 * @desc    Get hymn by ID
 * @access  Public
 */
router.get("/:id", getHymnById);

/**
 * @route   POST /api/hymns/sync
 * @desc    Sync hymns from external APIs
 * @access  Protected (Admin only)
 */
router.post("/sync", verifyToken, rateLimiter(5, 60000), syncHymns);

export default router;
```

### 5. Mount Routes in app.ts

```typescript
// Add to src/app.ts
import hymnsRoutes from "./routes/hymns.routes";

// Add this line with other route mounts
app.use("/api/hymns", hymnsRoutes);
```

## Frontend Integration

### 1. Map Hymn Data to Your Audio UI

```typescript
// utils/hymnMapper.ts
export const mapHymnToAudioFormat = (hymn: any) => {
  return {
    _id: hymn._id,
    title: hymn.title,
    author: hymn.author,
    composer: hymn.composer,
    year: hymn.year,
    category: hymn.category,
    lyrics: hymn.lyrics,
    audioUrl: hymn.audioUrl || null, // Will be null initially
    thumbnailUrl: hymn.thumbnailUrl || getDefaultHymnThumbnail(hymn.category),
    duration: hymn.duration || 0,
    hymnNumber: hymn.hymnNumber,
    meter: hymn.meter,
    key: hymn.key,
    scripture: hymn.scripture,
    tags: hymn.tags,
    // Map to your existing audio format
    contentType: "hymn",
    fileUrl: hymn.audioUrl,
    imageUrl: hymn.thumbnailUrl,
    views: hymn.viewCount || 0,
    likes: hymn.likeCount || 0,
    comments: hymn.commentCount || 0,
    saves: 0, // Will be handled by bookmark system
    createdAt: hymn.createdAt,
    // Add hymn-specific fields
    hymnData: {
      hymnNumber: hymn.hymnNumber,
      meter: hymn.meter,
      key: hymn.key,
      scripture: hymn.scripture,
      lyrics: hymn.lyrics,
    },
  };
};

const getDefaultHymnThumbnail = (category: string) => {
  const thumbnails = {
    praise: "https://via.placeholder.com/400x400/FF6B6B/FFFFFF?text=Praise",
    worship: "https://via.placeholder.com/400x400/4ECDC4/FFFFFF?text=Worship",
    traditional:
      "https://via.placeholder.com/400x400/45B7D1/FFFFFF?text=Traditional",
    contemporary:
      "https://via.placeholder.com/400x400/96CEB4/FFFFFF?text=Contemporary",
    gospel: "https://via.placeholder.com/400x400/FFEAA7/FFFFFF?text=Gospel",
    christmas:
      "https://via.placeholder.com/400x400/DDA0DD/FFFFFF?text=Christmas",
    easter: "https://via.placeholder.com/400x400/98D8C8/FFFFFF?text=Easter",
  };
  return thumbnails[category] || thumbnails.traditional;
};
```

### 2. Create Hymns API Service

```typescript
// services/hymnsAPI.ts
import { API_BASE_URL } from "../utils/api";
import { mapHymnToAudioFormat } from "../utils/hymnMapper";

export class HymnsAPI {
  private baseURL: string;

  constructor() {
    this.baseURL = API_BASE_URL || "http://localhost:5000";
  }

  /**
   * Get hymns with pagination and filtering
   */
  async getHymns(
    options: {
      page?: number;
      limit?: number;
      category?: string;
      search?: string;
      sortBy?: string;
      sortOrder?: string;
    } = {}
  ) {
    try {
      const queryParams = new URLSearchParams();

      if (options.page) queryParams.append("page", options.page.toString());
      if (options.limit) queryParams.append("limit", options.limit.toString());
      if (options.category) queryParams.append("category", options.category);
      if (options.search) queryParams.append("search", options.search);
      if (options.sortBy) queryParams.append("sortBy", options.sortBy);
      if (options.sortOrder) queryParams.append("sortOrder", options.sortOrder);

      const response = await fetch(
        `${this.baseURL}/api/hymns?${queryParams.toString()}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        // Map hymns to audio format for your existing UI
        const mappedHymns = result.data.hymns.map(mapHymnToAudioFormat);

        return {
          hymns: mappedHymns,
          pagination: result.data.pagination,
        };
      }

      throw new Error(result.message || "Failed to get hymns");
    } catch (error) {
      console.error("Error getting hymns:", error);
      throw error;
    }
  }

  /**
   * Get hymn by ID
   */
  async getHymnById(id: string) {
    try {
      const response = await fetch(`${this.baseURL}/api/hymns/${id}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        return mapHymnToAudioFormat(result.data);
      }

      throw new Error(result.message || "Failed to get hymn");
    } catch (error) {
      console.error("Error getting hymn:", error);
      throw error;
    }
  }
}

export const hymnsAPI = new HymnsAPI();
```

### 3. Use in Your Existing Audio UI

```typescript
// In your component
import { hymnsAPI } from '../services/hymnsAPI';
import { MusicCard } from '../components/MusicCard';

const HymnsScreen = () => {
  const [hymns, setHymns] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadHymns();
  }, []);

  const loadHymns = async () => {
    setLoading(true);
    try {
      const result = await hymnsAPI.getHymns({
        category: 'traditional',
        limit: 20
      });
      setHymns(result.hymns);
    } catch (error) {
      console.error('Failed to load hymns:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView>
      {hymns.map((hymn, index) => (
        <MusicCard
          key={hymn._id}
          audio={hymn} // Your existing MusicCard will work with hymn data
          index={index}
          onLike={handleLike}
          onComment={handleComment}
          onSave={handleSave}
          onShare={handleShare}
          onDownload={handleDownload}
        />
      ))}
    </ScrollView>
  );
};
```

## Free API Endpoints to Use

### 1. Hymnary.org (Recommended)

```typescript
// Base URL: https://hymnary.org/api
// Endpoints:
GET /api/hymns?category=praise&limit=50
GET /api/hymns/{id}
GET /api/search?q=amazing grace
```

### 2. Open Hymnal (Backup)

```typescript
// Base URL: https://openhymnal.org/api
// Endpoints:
GET / api / hymns;
GET / api / hymns / { id };
GET / api / categories;
```

### 3. Hymn Database (Alternative)

```typescript
// Base URL: https://hymndb.com/api
// Endpoints:
GET / api / hymns;
GET / api / hymns / { id };
```

## Implementation Steps

1. **Create the backend models and services** (as shown above)
2. **Set up the API routes** and mount them in app.ts
3. **Create the frontend mapping service** to convert hymn data to your audio format
4. **Test with fallback data** first, then integrate real APIs
5. **Add hymns to your existing audio UI** - it should work seamlessly!

This approach lets you reuse your existing `MusicCard` component and audio player while adding hymns as a new content type. The hymns will integrate with your existing interaction system (likes, comments, saves, views) automatically.
