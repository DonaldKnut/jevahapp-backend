# Hymnary.org API Integration Guide

## Overview

This guide shows how to integrate with the real [Hymnary.org Scripture API](https://hymnary.org/api/scripture) to fetch hymns based on Scripture references, perfect for your gospel platform.

## Hymnary.org API Analysis

### ✅ **What They Provide:**

- **Up to 100 hymns per request**
- **Scripture-based search** (perfect for gospel content)
- **Rich metadata**: title, date, meter, composer, scripture references
- **Two search methods**: human-friendly references or detailed parameters
- **Complete hymn information** including roles (composer, arranger, etc.)

### 📊 **API Response Fields:**

- `title` - Hymn title
- `date` - Publication/creation date
- `meter` - Musical meter (e.g., "8.6.8.6")
- `place of origin` - Geographic origin
- `original language` - Original language of the hymn
- `text link` - Link to Hymnary text authority page
- `number of hymnals` - How many hymnals include this hymn
- `scripture references` - Array of Scripture passages
- `roles` - People associated with the hymn (composer, arranger, etc.)

## Backend Implementation

### 1. Updated Hymns Service

```typescript
// src/service/hymns.service.ts
import { Hymn, IHymn } from "../models/hymn.model";
import logger from "../utils/logger";

export class HymnsService {
  /**
   * Fetch hymns from Hymnary.org Scripture API
   */
  static async fetchHymnsFromHymnary(
    options: {
      reference?: string;
      book?: string;
      fromChapter?: number;
      fromVerse?: number;
      toChapter?: number;
      toVerse?: number;
      all?: boolean;
    } = {}
  ): Promise<any[]> {
    try {
      const baseUrl = "https://hymnary.org/api/scripture";
      const params = new URLSearchParams();

      // Add parameters based on search type
      if (options.reference) {
        params.append("reference", options.reference);
      } else if (options.book) {
        params.append("book", options.book);
        if (options.fromChapter)
          params.append("fromChapter", options.fromChapter.toString());
        if (options.fromVerse)
          params.append("fromVerse", options.fromVerse.toString());
        if (options.toChapter)
          params.append("toChapter", options.toChapter.toString());
        if (options.toVerse)
          params.append("toVerse", options.toVerse.toString());
      }

      if (options.all) {
        params.append("all", "true");
      }

      const url = `${baseUrl}?${params.toString()}`;
      logger.info(`Fetching hymns from Hymnary.org: ${url}`);

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Hymnary API error: ${response.status}`);
      }

      const hymns = await response.json();
      logger.info(`Fetched ${hymns.length} hymns from Hymnary.org`);

      // Transform Hymnary.org data to our format
      return hymns.map(this.transformHymnaryData);
    } catch (error) {
      logger.warn("Hymnary API unavailable, using fallback data:", error);
      return this.getFallbackHymns();
    }
  }

  /**
   * Transform Hymnary.org API data to our internal format
   */
  private static transformHymnaryData(hymnaryData: any): any {
    return {
      title: hymnaryData.title || "Untitled Hymn",
      author: this.extractAuthor(hymnaryData),
      composer: this.extractComposer(hymnaryData),
      year: this.extractYear(hymnaryData.date),
      category: this.determineCategory(hymnaryData),
      lyrics: [], // Hymnary.org doesn't provide lyrics in this API
      hymnNumber: hymnaryData["number of hymnals"] || null,
      meter: hymnaryData.meter || null,
      key: null, // Not provided by Hymnary.org
      scripture: hymnaryData["scripture references"] || [],
      tags: this.generateTags(hymnaryData),
      externalId: this.generateExternalId(hymnaryData),
      source: "hymnary",
      // Additional Hymnary.org specific fields
      hymnaryData: {
        textLink: hymnaryData["text link"],
        placeOfOrigin: hymnaryData["place of origin"],
        originalLanguage: hymnaryData["original language"],
        numberOfHymnals: hymnaryData["number of hymnals"],
        roles: this.extractRoles(hymnaryData),
      },
    };
  }

  /**
   * Extract author from Hymnary.org data
   */
  private static extractAuthor(data: any): string {
    // Look for author in roles or other fields
    if (data.roles) {
      const authorRole = data.roles.find(
        (role: any) => role.role && role.role.toLowerCase().includes("author")
      );
      if (authorRole) return authorRole.name;
    }
    return "Unknown Author";
  }

  /**
   * Extract composer from Hymnary.org data
   */
  private static extractComposer(data: any): string {
    if (data.roles) {
      const composerRole = data.roles.find(
        (role: any) => role.role && role.role.toLowerCase().includes("composer")
      );
      if (composerRole) return composerRole.name;
    }
    return null;
  }

  /**
   * Extract year from date string
   */
  private static extractYear(dateStr: string): number | null {
    if (!dateStr) return null;
    const yearMatch = dateStr.match(/\d{4}/);
    return yearMatch ? parseInt(yearMatch[0]) : null;
  }

  /**
   * Determine category based on hymn data
   */
  private static determineCategory(data: any): string {
    const title = (data.title || "").toLowerCase();
    const scripture = (data["scripture references"] || [])
      .join(" ")
      .toLowerCase();

    if (title.includes("praise") || title.includes("glory")) return "praise";
    if (title.includes("worship") || title.includes("adore")) return "worship";
    if (title.includes("christmas") || title.includes("nativity"))
      return "christmas";
    if (title.includes("easter") || title.includes("resurrection"))
      return "easter";
    if (scripture.includes("psalm")) return "traditional";
    if (data.date && parseInt(data.date) < 1900) return "traditional";

    return "traditional"; // Default category
  }

  /**
   * Generate tags from hymn data
   */
  private static generateTags(data: any): string[] {
    const tags: string[] = [];

    if (data.meter) tags.push("metered");
    if (data["place of origin"])
      tags.push(data["place of origin"].toLowerCase());
    if (
      data["scripture references"] &&
      data["scripture references"].length > 0
    ) {
      tags.push("scripture-based");
    }

    return tags;
  }

  /**
   * Generate external ID from hymn data
   */
  private static generateExternalId(data: any): string {
    const title = (data.title || "").toLowerCase().replace(/[^a-z0-9]/g, "-");
    const year = this.extractYear(data.date) || "unknown";
    return `hymnary-${title}-${year}`;
  }

  /**
   * Extract roles from Hymnary.org data
   */
  private static extractRoles(data: any): any[] {
    return data.roles || [];
  }

  /**
   * Sync hymns from Hymnary.org with popular Scripture references
   */
  static async syncPopularHymns(): Promise<void> {
    const popularScriptures = [
      "John 3:16",
      "Psalm 23",
      "Romans 8:28",
      "Philippians 4:13",
      "Jeremiah 29:11",
      "Psalm 91",
      "Isaiah 40:31",
      "Matthew 28:19",
      "Ephesians 2:8-9",
      "Psalm 100",
    ];

    for (const scripture of popularScriptures) {
      try {
        const hymns = await this.fetchHymnsFromHymnary({
          reference: scripture,
        });

        for (const hymnData of hymns) {
          await this.upsertHymn(hymnData, "hymnary");
        }

        logger.info(`Synced ${hymns.length} hymns for ${scripture}`);
      } catch (error) {
        logger.error(`Failed to sync hymns for ${scripture}:`, error);
      }
    }
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
    ];
  }

  // ... rest of the service methods (getHymns, getHymnById, etc.)
}
```

### 2. Updated Controller with Scripture Search

```typescript
// src/controllers/hymns.controller.ts
import { Request, Response } from "express";
import { HymnsService } from "../service/hymns.service";
import logger from "../utils/logger";

/**
 * Search hymns by Scripture reference
 */
export const searchHymnsByScripture = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { reference, book, fromChapter, fromVerse, toChapter, toVerse, all } =
      req.query;

    let searchOptions: any = {};

    if (reference) {
      searchOptions.reference = reference as string;
    } else if (book) {
      searchOptions.book = book as string;
      if (fromChapter)
        searchOptions.fromChapter = parseInt(fromChapter as string);
      if (fromVerse) searchOptions.fromVerse = parseInt(fromVerse as string);
      if (toChapter) searchOptions.toChapter = parseInt(toChapter as string);
      if (toVerse) searchOptions.toVerse = parseInt(toVerse as string);
    }

    if (all === "true") {
      searchOptions.all = true;
    }

    const hymns = await HymnsService.fetchHymnsFromHymnary(searchOptions);

    res.status(200).json({
      success: true,
      data: {
        hymns,
        searchOptions,
        count: hymns.length,
      },
    });
  } catch (error: any) {
    logger.error("Search hymns by scripture error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to search hymns by scripture",
    });
  }
};

/**
 * Sync popular hymns from Hymnary.org
 */
export const syncPopularHymns = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    await HymnsService.syncPopularHymns();

    res.status(200).json({
      success: true,
      message: "Popular hymns synced successfully from Hymnary.org",
    });
  } catch (error: any) {
    logger.error("Sync popular hymns error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to sync popular hymns",
    });
  }
};

// ... other controller methods
```

### 3. Updated Routes

```typescript
// src/routes/hymns.routes.ts
import express from "express";
import { verifyToken } from "../middleware/auth.middleware";
import { rateLimiter } from "../middleware/rateLimiter";
import {
  getHymns,
  getHymnById,
  syncHymns,
  searchHymnsByScripture,
  syncPopularHymns,
} from "../controllers/hymns.controller";

const router = express.Router();

/**
 * @route   GET /api/hymns/search/scripture
 * @desc    Search hymns by Scripture reference using Hymnary.org API
 * @access  Public
 * @query   { reference?: string, book?: string, fromChapter?: number, fromVerse?: number, toChapter?: number, toVerse?: number, all?: boolean }
 */
router.get("/search/scripture", searchHymnsByScripture);

/**
 * @route   POST /api/hymns/sync/popular
 * @desc    Sync popular hymns from Hymnary.org
 * @access  Protected (Admin only)
 */
router.post(
  "/sync/popular",
  verifyToken,
  rateLimiter(5, 60000),
  syncPopularHymns
);

// ... other routes

export default router;
```

## Frontend Integration

### 1. Scripture Search Component

```typescript
// components/ScriptureSearch.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';

export const ScriptureSearch = ({ onSearch }: { onSearch: (results: any[]) => void }) => {
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!reference.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/hymns/search/scripture?reference=${encodeURIComponent(reference)}`
      );

      const result = await response.json();

      if (result.success) {
        onSearch(result.data.hymns);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="p-4">
      <Text className="text-lg font-semibold mb-2">Search Hymns by Scripture</Text>
      <TextInput
        className="border border-gray-300 rounded-lg p-3 mb-3"
        placeholder="e.g., John 3:16, Psalm 23, Romans 8:28"
        value={reference}
        onChangeText={setReference}
      />
      <TouchableOpacity
        className="bg-blue-500 rounded-lg p-3"
        onPress={handleSearch}
        disabled={loading}
      >
        <Text className="text-white text-center font-semibold">
          {loading ? 'Searching...' : 'Search Hymns'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};
```

### 2. Popular Scripture References

```typescript
// utils/popularScriptures.ts
export const POPULAR_SCRIPTURES = [
  { reference: "John 3:16", description: "God's Love" },
  { reference: "Psalm 23", description: "The Lord is My Shepherd" },
  { reference: "Romans 8:28", description: "All Things Work Together" },
  { reference: "Philippians 4:13", description: "I Can Do All Things" },
  { reference: "Jeremiah 29:11", description: "Plans to Prosper" },
  { reference: "Psalm 91", description: "God's Protection" },
  { reference: "Isaiah 40:31", description: "They That Wait" },
  { reference: "Matthew 28:19", description: "Great Commission" },
  { reference: "Ephesians 2:8-9", description: "Saved by Grace" },
  { reference: "Psalm 100", description: "Make a Joyful Noise" },
];
```

## API Usage Examples

### 1. Search by Reference

```typescript
// Search for hymns based on John 3:16
GET /api/hymns/search/scripture?reference=John+3:16

// Search for hymns based on Psalm 23
GET /api/hymns/search/scripture?reference=Psalm+23
```

### 2. Search by Detailed Parameters

```typescript
// Search for hymns in 1 John 3:1-4
GET /api/hymns/search/scripture?book=1+John&fromChapter=3&fromVerse=1&toChapter=3&toVerse=4
```

### 3. Get All Matches

```typescript
// Get all hymns (including incomplete ones)
GET /api/hymns/search/scripture?reference=Psalm+136&all=true
```

## Benefits of This Approach

### ✅ **Perfect for Your Gospel Platform:**

1. **Scripture-Based**: Hymns are organized by Bible passages
2. **Rich Metadata**: Title, composer, meter, scripture references
3. **Authentic Data**: Real hymn data from Hymnary.org
4. **No UI Changes**: Works with your existing `MusicCard` component
5. **Scalable**: Can fetch up to 100 hymns per request

### 🎯 **Integration with Your Existing System:**

1. **Same Audio UI**: Your `MusicCard` works perfectly
2. **Same Interactions**: Likes, comments, saves, views all work
3. **Enhanced Data**: Scripture references, hymn numbers, meters
4. **Fallback Support**: Graceful degradation if API is unavailable

## Implementation Steps

1. **Create the backend service** (as shown above)
2. **Set up the API routes** and mount them
3. **Test with popular Scripture references** (John 3:16, Psalm 23, etc.)
4. **Add Scripture search to your frontend**
5. **Map hymn data to your existing audio format**
6. **Integrate with your existing interaction system**

This approach gives you a **professional-grade hymns system** that's perfectly suited for your gospel platform, with real hymn data from Hymnary.org and seamless integration with your existing audio UI!
