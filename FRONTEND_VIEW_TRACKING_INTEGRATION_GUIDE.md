# Frontend View Tracking Integration Guide

## Overview

This guide shows how to integrate professional-grade view tracking into your React Native app, specifically for the eye icon UI that displays view counts (like Twitter's insights). The system tracks views for videos, audios, and ebooks with deduplication and qualification thresholds.

## Backend Endpoints

### 1. Record View Event

```http
POST /api/content/:contentType/:contentId/view
```

**Headers:**

```json
{
  "Authorization": "Bearer <token>", // Optional - for authenticated users
  "Content-Type": "application/json"
}
```

**Body:**

```json
{
  "durationMs": 5000, // Optional: milliseconds watched
  "progressPct": 25, // Optional: percentage completed (0-100)
  "isComplete": false // Optional: true when content finished
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "viewCount": 1247,
    "hasViewed": true
  }
}
```

### 2. Get Batch Metadata (includes view counts)

```http
POST /api/content/batch-metadata
```

**Body:**

```json
{
  "contentIds": ["64f1a2b3c4d5e6f7a8b9c0d1", "64f1a2b3c4d5e6f7a8b9c0d2"],
  "contentType": "media"
}
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "64f1a2b3c4d5e6f7a8b9c0d1",
      "likeCount": 45,
      "commentCount": 12,
      "shareCount": 8,
      "bookmarkCount": 23,
      "viewCount": 1247,
      "hasLiked": true,
      "hasCommented": false,
      "hasShared": false,
      "hasBookmarked": true,
      "hasViewed": true
    }
  ]
}
```

## Real-time Updates

### Socket.IO Events

**Event:** `view-updated`
**Room:** `content:<contentId>`

```javascript
// Listen for view count updates
socket.on("view-updated", data => {
  console.log("View count updated:", data);
  // data: { contentId, viewCount, timestamp }

  // Update your UI state
  updateViewCount(data.contentId, data.viewCount);
});
```

## Frontend Implementation

### 1. TypeScript Types

```typescript
// types/viewTracking.ts
export interface ViewTrackingData {
  viewCount: number;
  hasViewed: boolean;
}

export interface ContentMetadata {
  id: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  bookmarkCount: number;
  viewCount: number;
  hasLiked: boolean;
  hasCommented: boolean;
  hasShared: boolean;
  hasBookmarked: boolean;
  hasViewed: boolean;
}

export interface ViewEventPayload {
  durationMs?: number;
  progressPct?: number;
  isComplete?: boolean;
}
```

### 2. View Tracking Service

```typescript
// services/viewTrackingService.ts
import { API_BASE_URL } from "../utils/api";
import { authUtils } from "../utils/authUtils";

export class ViewTrackingService {
  private static readonly QUALIFY_DURATION_MS = 3000; // 3 seconds
  private static readonly QUALIFY_PROGRESS = 25; // 25%

  private static trackedViews = new Set<string>(); // Session deduplication

  /**
   * Record a view event for content
   */
  static async recordView(
    contentId: string,
    contentType: "media" | "devotional" | "ebook" | "podcast",
    payload: ViewEventPayload = {}
  ): Promise<ViewTrackingData | null> {
    try {
      // Session deduplication - only track once per session
      const sessionKey = `${contentType}:${contentId}`;
      if (this.trackedViews.has(sessionKey)) {
        return null;
      }

      // Check if view qualifies
      const qualifies =
        payload.isComplete ||
        (payload.durationMs || 0) >= this.QUALIFY_DURATION_MS ||
        (payload.progressPct || 0) >= this.QUALIFY_PROGRESS;

      if (!qualifies) {
        return null;
      }

      const token = await authUtils.getStoredToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(
        `${API_BASE_URL}/api/content/${contentType}/${contentId}/view`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        this.trackedViews.add(sessionKey);
        return result.data;
      }

      return null;
    } catch (error) {
      console.error("Failed to record view:", error);
      return null;
    }
  }

  /**
   * Get batch metadata including view counts
   */
  static async getBatchMetadata(
    contentIds: string[],
    contentType: string = "media"
  ): Promise<ContentMetadata[]> {
    try {
      const token = await authUtils.getStoredToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(
        `${API_BASE_URL}/api/content/batch-metadata`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ contentIds, contentType }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.success ? result.data : [];
    } catch (error) {
      console.error("Failed to get batch metadata:", error);
      return [];
    }
  }
}
```

### 3. Video Component Integration

```typescript
// components/VideoCard.tsx
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Video, ResizeMode } from 'expo-av';
import { ViewTrackingService } from '../services/viewTrackingService';

interface VideoCardProps {
  video: {
    _id: string;
    title: string;
    fileUrl: string;
    // ... other props
  };
  onViewCountUpdate?: (contentId: string, viewCount: number) => void;
}

export const VideoCard: React.FC<VideoCardProps> = ({
  video,
  onViewCountUpdate
}) => {
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasTrackedView, setHasTrackedView] = useState(false);

  const contentId = video._id;

  // Track view when video qualifies
  const trackView = useCallback(async () => {
    if (hasTrackedView || !isPlaying) return;

    const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
    const durationMs = currentTime * 1000;

    const result = await ViewTrackingService.recordView(
      contentId,
      'media',
      {
        durationMs,
        progressPct,
        isComplete: false,
      }
    );

    if (result) {
      setHasTrackedView(true);
      onViewCountUpdate?.(contentId, result.viewCount);
    }
  }, [contentId, currentTime, duration, isPlaying, hasTrackedView, onViewCountUpdate]);

  // Track view when video reaches 3 seconds or 25% progress
  useEffect(() => {
    if (isPlaying && !hasTrackedView) {
      const shouldTrack =
        currentTime >= 3 || // 3 seconds
        (duration > 0 && (currentTime / duration) >= 0.25); // 25% progress

      if (shouldTrack) {
        trackView();
      }
    }
  }, [currentTime, duration, isPlaying, hasTrackedView, trackView]);

  // Track completion
  const handlePlaybackStatusUpdate = useCallback((status: any) => {
    if (status.isLoaded) {
      setCurrentTime(status.positionMillis / 1000);
      setDuration(status.durationMillis / 1000);
      setIsPlaying(status.isPlaying);

      // Track completion
      if (status.didJustFinish && !hasTrackedView) {
        ViewTrackingService.recordView(contentId, 'media', {
          durationMs: status.durationMillis,
          progressPct: 100,
          isComplete: true,
        }).then(result => {
          if (result) {
            onViewCountUpdate?.(contentId, result.viewCount);
          }
        });
      }
    }
  }, [contentId, hasTrackedView, onViewCountUpdate]);

  return (
    <Video
      ref={videoRef}
      source={{ uri: video.fileUrl }}
      style={{ width: '100%', height: 400 }}
      resizeMode={ResizeMode.COVER}
      shouldPlay={isPlaying}
      onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
    />
  );
};
```

### 4. Audio Component Integration

```typescript
// components/AudioPlayer.tsx
import React, { useRef, useEffect, useState, useCallback } from "react";
import { Audio } from "expo-av";
import { ViewTrackingService } from "../services/viewTrackingService";

interface AudioPlayerProps {
  audio: {
    _id: string;
    title: string;
    fileUrl: string;
    // ... other props
  };
  onViewCountUpdate?: (contentId: string, viewCount: number) => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audio,
  onViewCountUpdate,
}) => {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasTrackedView, setHasTrackedView] = useState(false);

  const contentId = audio._id;

  // Track view when audio qualifies
  const trackView = useCallback(async () => {
    if (hasTrackedView || !isPlaying) return;

    const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
    const durationMs = currentTime * 1000;

    const result = await ViewTrackingService.recordView(
      contentId,
      "media", // or 'podcast' if it's a podcast
      {
        durationMs,
        progressPct,
        isComplete: false,
      }
    );

    if (result) {
      setHasTrackedView(true);
      onViewCountUpdate?.(contentId, result.viewCount);
    }
  }, [
    contentId,
    currentTime,
    duration,
    isPlaying,
    hasTrackedView,
    onViewCountUpdate,
  ]);

  // Track view when audio reaches 3 seconds or 25% progress
  useEffect(() => {
    if (isPlaying && !hasTrackedView) {
      const shouldTrack =
        currentTime >= 3 || // 3 seconds
        (duration > 0 && currentTime / duration >= 0.25); // 25% progress

      if (shouldTrack) {
        trackView();
      }
    }
  }, [currentTime, duration, isPlaying, hasTrackedView, trackView]);

  // Track completion
  const handlePlaybackStatusUpdate = useCallback(
    (status: any) => {
      if (status.isLoaded) {
        setCurrentTime(status.positionMillis / 1000);
        setDuration(status.durationMillis / 1000);
        setIsPlaying(status.isPlaying);

        // Track completion
        if (status.didJustFinish && !hasTrackedView) {
          ViewTrackingService.recordView(contentId, "media", {
            durationMs: status.durationMillis,
            progressPct: 100,
            isComplete: true,
          }).then(result => {
            if (result) {
              onViewCountUpdate?.(contentId, result.viewCount);
            }
          });
        }
      }
    },
    [contentId, hasTrackedView, onViewCountUpdate]
  );

  // ... rest of audio player implementation
};
```

### 5. Ebook Reader Integration

```typescript
// components/EbookReader.tsx
import React, { useEffect, useState, useCallback } from "react";
import { ViewTrackingService } from "../services/viewTrackingService";

interface EbookReaderProps {
  ebook: {
    _id: string;
    title: string;
    // ... other props
  };
  onViewCountUpdate?: (contentId: string, viewCount: number) => void;
}

export const EbookReader: React.FC<EbookReaderProps> = ({
  ebook,
  onViewCountUpdate,
}) => {
  const [hasTrackedView, setHasTrackedView] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [pageCount, setPageCount] = useState(0);

  const contentId = ebook._id;

  // Track view when ebook is opened for 5+ seconds or after first page turn
  const trackView = useCallback(async () => {
    if (hasTrackedView) return;

    const durationMs = startTime ? Date.now() - startTime : 0;

    const result = await ViewTrackingService.recordView(contentId, "ebook", {
      durationMs,
      progressPct: 0, // Could calculate based on pages read
      isComplete: false,
    });

    if (result) {
      setHasTrackedView(true);
      onViewCountUpdate?.(contentId, result.viewCount);
    }
  }, [contentId, startTime, hasTrackedView, onViewCountUpdate]);

  // Start timing when component mounts
  useEffect(() => {
    setStartTime(Date.now());

    // Track view after 5 seconds
    const timer = setTimeout(() => {
      if (!hasTrackedView) {
        trackView();
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [trackView, hasTrackedView]);

  // Track view on first page turn
  const handlePageTurn = useCallback(() => {
    setPageCount(prev => {
      const newCount = prev + 1;
      if (newCount === 1 && !hasTrackedView) {
        trackView();
      }
      return newCount;
    });
  }, [hasTrackedView, trackView]);

  // ... rest of ebook reader implementation
};
```

### 6. Eye Icon UI Component

```typescript
// components/ViewCountIcon.tsx
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface ViewCountIconProps {
  viewCount: number;
  onPress?: () => void;
  size?: number;
  color?: string;
  showCount?: boolean;
}

export const ViewCountIcon: React.FC<ViewCountIconProps> = ({
  viewCount,
  onPress,
  size = 24,
  color = '#98A2B3',
  showCount = true,
}) => {
  const formatViewCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center"
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <MaterialIcons name="visibility" size={size} color={color} />
      {showCount && (
        <Text className="text-[10px] text-gray-500 ml-1 font-rubik">
          {formatViewCount(viewCount)}
        </Text>
      )}
    </TouchableOpacity>
  );
};
```

### 7. Integration with Your Existing VideoCard

```typescript
// Update your existing VideoCard component
import { ViewCountIcon } from '../components/ViewCountIcon';
import { ViewTrackingService } from '../services/viewTrackingService';

export const VideoCard: React.FC<VideoCardProps> = ({
  video,
  // ... other props
}) => {
  const [viewCount, setViewCount] = useState(video.views || 0);
  const [hasViewed, setHasViewed] = useState(false);

  // Update view count from real-time events
  useEffect(() => {
    const handleViewUpdate = (data: any) => {
      if (data.contentId === video._id) {
        setViewCount(data.viewCount);
      }
    };

    socket.on('view-updated', handleViewUpdate);
    return () => socket.off('view-updated', handleViewUpdate);
  }, [video._id]);

  // Track view when video qualifies
  const handlePlaybackStatusUpdate = useCallback((status: any) => {
    // ... existing playback logic

    // Add view tracking
    if (status.isLoaded && status.isPlaying) {
      const currentTime = status.positionMillis / 1000;
      const duration = status.durationMillis / 1000;

      if (!hasViewed && (currentTime >= 3 || (duration > 0 && currentTime / duration >= 0.25))) {
        ViewTrackingService.recordView(video._id, 'media', {
          durationMs: status.positionMillis,
          progressPct: (currentTime / duration) * 100,
        }).then(result => {
          if (result) {
            setViewCount(result.viewCount);
            setHasViewed(true);
          }
        });
      }
    }
  }, [video._id, hasViewed]);

  return (
    <View>
      {/* ... existing video player */}

      {/* Footer with eye icon */}
      <View className="flex-row items-center justify-between mt-1 px-3">
        <View className="flex flex-row items-center">
          {/* ... existing avatar and name */}

          <View className="flex-row mt-2 items-center pl-2">
            {/* Eye icon for view count */}
            <ViewCountIcon
              viewCount={viewCount}
              onPress={() => {
                // Optional: Show detailed analytics
                console.log('View count:', viewCount);
              }}
            />

            {/* ... existing like, comment, share icons */}
          </View>
        </View>
      </View>
    </View>
  );
};
```

### 8. Batch Metadata Integration

```typescript
// hooks/useContentMetadata.ts
import { useState, useEffect } from "react";
import { ViewTrackingService } from "../services/viewTrackingService";

export const useContentMetadata = (
  contentIds: string[],
  contentType: string = "media"
) => {
  const [metadata, setMetadata] = useState<Record<string, ContentMetadata>>({});
  const [loading, setLoading] = useState(false);

  const fetchMetadata = async () => {
    if (contentIds.length === 0) return;

    setLoading(true);
    try {
      const data = await ViewTrackingService.getBatchMetadata(
        contentIds,
        contentType
      );
      const metadataMap = data.reduce(
        (acc, item) => {
          acc[item.id] = item;
          return acc;
        },
        {} as Record<string, ContentMetadata>
      );

      setMetadata(metadataMap);
    } catch (error) {
      console.error("Failed to fetch metadata:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, [contentIds.join(","), contentType]);

  return { metadata, loading, refetch: fetchMetadata };
};
```

## Usage Examples

### 1. Feed Screen with Batch Metadata

```typescript
// screens/FeedScreen.tsx
import { useContentMetadata } from '../hooks/useContentMetadata';

export const FeedScreen = () => {
  const [videos, setVideos] = useState([]);
  const contentIds = videos.map(v => v._id);
  const { metadata } = useContentMetadata(contentIds, 'media');

  return (
    <ScrollView>
      {videos.map(video => (
        <VideoCard
          key={video._id}
          video={video}
          viewCount={metadata[video._id]?.viewCount || 0}
          hasViewed={metadata[video._id]?.hasViewed || false}
        />
      ))}
    </ScrollView>
  );
};
```

### 2. Real-time Updates

```typescript
// App.tsx or main component
import { useEffect } from "react";
import { socket } from "./services/socket";

export const App = () => {
  useEffect(() => {
    // Listen for view count updates
    socket.on("view-updated", data => {
      // Update your global state or context
      updateViewCount(data.contentId, data.viewCount);
    });

    return () => {
      socket.off("view-updated");
    };
  }, []);

  // ... rest of app
};
```

## Best Practices

1. **Session Deduplication**: Only track one view per content per session
2. **Qualification Thresholds**: Track views only when content is meaningfully consumed
3. **Error Handling**: Always handle network errors gracefully
4. **Performance**: Use batch metadata for multiple items
5. **Real-time Updates**: Listen to socket events for live view count updates
6. **Offline Support**: Queue view events when offline and sync when online

## Testing

```typescript
// Test view tracking
const testViewTracking = async () => {
  const result = await ViewTrackingService.recordView(
    "64f1a2b3c4d5e6f7a8b9c0d1",
    "media",
    { durationMs: 5000, progressPct: 30 }
  );

  console.log("View tracking result:", result);
};
```

This implementation provides professional-grade view tracking that matches the quality of platforms like Instagram and TikTok, with proper deduplication, qualification thresholds, and real-time updates.
