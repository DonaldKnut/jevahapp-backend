// Frontend Hymns API Service
// Copy this to your frontend project: services/hymnsAPI.ts

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// Types for hymns
export interface HymnData {
  _id: string;
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
  scripture: string[];
  tags: string[];
  source: "hymnary" | "openhymnal" | "manual";
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  bookmarkCount: number;
  hymnaryData?: {
    textLink?: string;
    placeOfOrigin?: string;
    originalLanguage?: string;
    numberOfHymnals?: number;
    roles?: Array<{
      name: string;
      role: string;
    }>;
  };
  createdAt: string;
  updatedAt: string;
}

export interface HymnSearchOptions {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  sortBy?:
    | "title"
    | "author"
    | "year"
    | "viewCount"
    | "likeCount"
    | "createdAt";
  sortOrder?: "asc" | "desc";
  source?: string;
  tags?: string[];
}

export interface ScriptureSearchOptions {
  reference?: string;
  book?: string;
  fromChapter?: number;
  fromVerse?: number;
  toChapter?: number;
  toVerse?: number;
  all?: boolean;
}

export interface HymnsResponse {
  hymns: HymnData[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface HymnStats {
  totalHymns: number;
  hymnsByCategory: Record<string, number>;
  hymnsBySource: Record<string, number>;
  topHymns: Array<{
    title: string;
    viewCount: number;
    likeCount: number;
  }>;
}

class HymnsAPI {
  private baseURL: string;

  constructor() {
    // Replace with your actual API base URL
    this.baseURL = process.env.API_BASE_URL || "http://localhost:5000";
  }

  private async getAuthHeaders(): Promise<HeadersInit> {
    try {
      // Try multiple token keys since your app uses different ones
      let token = await AsyncStorage.getItem("userToken");
      if (!token) {
        token = await AsyncStorage.getItem("token");
      }
      if (!token) {
        try {
          const { default: SecureStore } = await import("expo-secure-store");
          token = await SecureStore.getItemAsync("jwt");
        } catch (secureStoreError) {
          console.log("SecureStore not available or no JWT token");
        }
      }

      if (token) {
        return {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "expo-platform": Platform.OS,
        };
      }

      return {
        "Content-Type": "application/json",
        "expo-platform": Platform.OS,
      };
    } catch (error) {
      console.error("Error getting auth headers:", error);
      return {
        "Content-Type": "application/json",
        "expo-platform": Platform.OS,
      };
    }
  }

  /**
   * Get hymns with pagination and filtering
   */
  async getHymns(options: HymnSearchOptions = {}): Promise<HymnsResponse> {
    try {
      const params = new URLSearchParams();

      if (options.page) params.append("page", options.page.toString());
      if (options.limit) params.append("limit", options.limit.toString());
      if (options.category) params.append("category", options.category);
      if (options.search) params.append("search", options.search);
      if (options.sortBy) params.append("sortBy", options.sortBy);
      if (options.sortOrder) params.append("sortOrder", options.sortOrder);
      if (options.source) params.append("source", options.source);
      if (options.tags) params.append("tags", options.tags.join(","));

      const response = await fetch(
        `${this.baseURL}/api/hymns?${params.toString()}`,
        {
          headers: await this.getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        return result.data;
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
  async getHymnById(id: string): Promise<HymnData> {
    try {
      const response = await fetch(`${this.baseURL}/api/hymns/${id}`, {
        headers: await this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        return result.data;
      }

      throw new Error(result.message || "Failed to get hymn");
    } catch (error) {
      console.error("Error getting hymn:", error);
      throw error;
    }
  }

  /**
   * Search hymns by Scripture reference
   */
  async searchHymnsByScripture(options: ScriptureSearchOptions): Promise<{
    hymns: HymnData[];
    searchOptions: ScriptureSearchOptions;
    count: number;
  }> {
    try {
      const params = new URLSearchParams();

      if (options.reference) params.append("reference", options.reference);
      if (options.book) params.append("book", options.book);
      if (options.fromChapter)
        params.append("fromChapter", options.fromChapter.toString());
      if (options.fromVerse)
        params.append("fromVerse", options.fromVerse.toString());
      if (options.toChapter)
        params.append("toChapter", options.toChapter.toString());
      if (options.toVerse) params.append("toVerse", options.toVerse.toString());
      if (options.all) params.append("all", "true");

      const response = await fetch(
        `${this.baseURL}/api/hymns/search/scripture?${params.toString()}`,
        {
          headers: await this.getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        return result.data;
      }

      throw new Error(result.message || "Failed to search hymns by scripture");
    } catch (error) {
      console.error("Error searching hymns by scripture:", error);
      throw error;
    }
  }

  /**
   * Search hymns by tags
   */
  async searchHymnsByTags(
    tags: string[],
    options: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: string;
    } = {}
  ): Promise<HymnsResponse> {
    try {
      const params = new URLSearchParams();

      params.append("tags", tags.join(","));
      if (options.page) params.append("page", options.page.toString());
      if (options.limit) params.append("limit", options.limit.toString());
      if (options.sortBy) params.append("sortBy", options.sortBy);
      if (options.sortOrder) params.append("sortOrder", options.sortOrder);

      const response = await fetch(
        `${this.baseURL}/api/hymns/search/tags?${params.toString()}`,
        {
          headers: await this.getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        return result.data;
      }

      throw new Error(result.message || "Failed to search hymns by tags");
    } catch (error) {
      console.error("Error searching hymns by tags:", error);
      throw error;
    }
  }

  /**
   * Get hymns by category
   */
  async getHymnsByCategory(
    category: string,
    options: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: string;
    } = {}
  ): Promise<HymnsResponse> {
    try {
      const params = new URLSearchParams();

      if (options.page) params.append("page", options.page.toString());
      if (options.limit) params.append("limit", options.limit.toString());
      if (options.sortBy) params.append("sortBy", options.sortBy);
      if (options.sortOrder) params.append("sortOrder", options.sortOrder);

      const response = await fetch(
        `${this.baseURL}/api/hymns/category/${category}?${params.toString()}`,
        {
          headers: await this.getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        return result.data;
      }

      throw new Error(result.message || "Failed to get hymns by category");
    } catch (error) {
      console.error("Error getting hymns by category:", error);
      throw error;
    }
  }

  /**
   * Get hymn statistics
   */
  async getHymnStats(): Promise<HymnStats> {
    try {
      const response = await fetch(`${this.baseURL}/api/hymns/stats`, {
        headers: await this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        return result.data;
      }

      throw new Error(result.message || "Failed to get hymn statistics");
    } catch (error) {
      console.error("Error getting hymn statistics:", error);
      throw error;
    }
  }

  /**
   * Update hymn interaction counts
   */
  async updateHymnInteractions(
    id: string,
    updates: {
      likeCount?: number;
      commentCount?: number;
      shareCount?: number;
      bookmarkCount?: number;
    }
  ): Promise<void> {
    try {
      const response = await fetch(
        `${this.baseURL}/api/hymns/${id}/interactions`,
        {
          method: "PATCH",
          headers: await this.getAuthHeaders(),
          body: JSON.stringify(updates),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "Failed to update hymn interactions");
      }
    } catch (error) {
      console.error("Error updating hymn interactions:", error);
      throw error;
    }
  }

  /**
   * Sync popular hymns (Admin only)
   */
  async syncPopularHymns(): Promise<{
    synced: number;
    errors: number;
  }> {
    try {
      const response = await fetch(`${this.baseURL}/api/hymns/sync/popular`, {
        method: "POST",
        headers: await this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        return result.data;
      }

      throw new Error(result.message || "Failed to sync popular hymns");
    } catch (error) {
      console.error("Error syncing popular hymns:", error);
      throw error;
    }
  }
}

// Export singleton instance
export const hymnsAPI = new HymnsAPI();
export default hymnsAPI;
