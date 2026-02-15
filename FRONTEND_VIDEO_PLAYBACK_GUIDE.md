# Frontend Video Playback Guide

## 🎯 Problem Statement

Some videos are playing correctly while others only show thumbnails and don't play. This guide explains how to properly implement video playback to ensure ALL videos play correctly, with smooth streaming and no cracking.

---

## ✅ Backend Response Structure

The backend returns video data in the following format:

```typescript
interface VideoMedia {
  _id: string;
  title: string;
  contentType: "videos" | "sermon" | "live" | "recording";
  fileUrl: string;           // ⭐ USE THIS for video playback
  thumbnailUrl: string;      // ⭐ USE THIS for poster/preview image
  duration: number;          // Duration in seconds
  // ... other fields
}
```

### ⚠️ Critical Field Usage

- **`fileUrl`** → Primary URL for video playback (use for most videos)
- **`playbackUrl`** → Fallback for live streams or recordings (use if `fileUrl` is missing)
- **`hlsUrl`** → HLS streaming URL for live streams (use if `fileUrl` and `playbackUrl` are missing)
- **`thumbnailUrl`** → Use for poster image (shown before video plays)
- **NEVER** use `thumbnailUrl` as the video source - it's an image!

### Video URL Selection Logic

```typescript
// ⭐ Correct way to select video URL with fallbacks
const getVideoUrl = (video: VideoMedia): string | null => {
  // Priority order: fileUrl > playbackUrl > hlsUrl
  return video.fileUrl || video.playbackUrl || video.hlsUrl || null;
};

// Use in your component
const videoUrl = getVideoUrl(video);
if (!videoUrl) {
  // Handle missing video URL
  return <PlaceholderView video={video} />;
}

<Video source={{ uri: videoUrl }} poster={video.thumbnailUrl} />
```

---

## 🔍 Common Issues and Solutions

### Issue 1: Using Thumbnail URL Instead of File URL

**❌ WRONG:**
```typescript
<Video
  source={{ uri: video.thumbnailUrl }}  // ❌ This is an image, not a video!
  poster={video.thumbnailUrl}
/>
```

**✅ CORRECT:**
```typescript
<Video
  source={{ uri: video.fileUrl }}       // ✅ Correct - actual video file
  poster={video.thumbnailUrl}            // ✅ Thumbnail for poster
/>
```

### Issue 2: Not Handling Paginated Videos

When using pagination, ensure all videos are properly initialized:

**❌ WRONG:**
```typescript
// Only videos on first page play
const [videos, setVideos] = useState([]);

useEffect(() => {
  fetchVideos(page).then(data => {
    setVideos(data.media);  // ❌ Replaces previous videos
  });
}, [page]);
```

**✅ CORRECT:**
```typescript
// All videos in list play correctly
const [allVideos, setAllVideos] = useState([]);
const [currentPage, setCurrentPage] = useState(1);

const loadVideos = async (page: number, append: boolean = false) => {
  const response = await fetch(`/api/media/all?page=${page}&limit=50`);
  const data = await response.json();
  
  if (append) {
    setAllVideos(prev => [...prev, ...data.data.media]);  // ✅ Append new videos
  } else {
    setAllVideos(data.data.media);  // ✅ Initial load
  }
};

useEffect(() => {
  loadVideos(currentPage, currentPage > 1);
}, [currentPage]);
```

### Issue 3: Missing Video URL Validation

Always validate that `fileUrl` exists before rendering video:

**✅ CORRECT:**
```typescript
const VideoPlayer = ({ video }) => {
  // Validate video URL exists
  if (!video?.fileUrl) {
    return (
      <View>
        <Image source={{ uri: video?.thumbnailUrl }} />
        <Text>Video unavailable</Text>
      </View>
    );
  }

  return (
    <Video
      source={{ uri: video.fileUrl }}
      poster={video.thumbnailUrl}
      // ... other props
    />
  );
};
```

---

## 🎬 Complete React Native Video Implementation

### Using expo-av (Recommended)

```typescript
import { Video, ResizeMode } from 'expo-av';
import { useState, useRef, useEffect } from 'react';
import { View, Image, ActivityIndicator, StyleSheet } from 'react-native';

interface VideoItem {
  _id: string;
  fileUrl: string;
  thumbnailUrl?: string;
  title?: string;
  duration?: number;
}

const VideoPlayer: React.FC<{ video: VideoItem }> = ({ video }) => {
  const videoRef = useRef<Video>(null);
  const [status, setStatus] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get video URL with fallback logic
  const videoUrl = video?.fileUrl || video?.playbackUrl || video?.hlsUrl;
  
  // Validate video URL exists
  if (!videoUrl) {
    return (
      <View style={styles.container}>
        {video?.thumbnailUrl && (
          <Image 
            source={{ uri: video.thumbnailUrl }} 
            style={styles.thumbnail}
            resizeMode="cover"
          />
        )}
        <Text style={styles.errorText}>Video unavailable</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Video
        ref={videoRef}
        style={styles.video}
        source={{ uri: videoUrl }}  // ✅ Use videoUrl (with fallbacks)
        posterSource={{ uri: video.thumbnailUrl }}  // ✅ Use thumbnailUrl for poster
        posterStyle={styles.poster}
        usePoster={true}
        resizeMode={ResizeMode.CONTAIN}
        isLooping={false}
        shouldPlay={false}
        isMuted={false}
        volume={1.0}
        // ⭐ Critical streaming optimizations
        progressUpdateIntervalMillis={1000}
        positionMillis={0}
        // Buffer configuration for smooth playback
        useNativeControls={true}
        // Error handling
        onLoadStart={() => {
          setIsLoading(true);
          setError(null);
        }}
        onLoad={(status) => {
          setIsLoading(false);
          setStatus(status);
        }}
        onError={(error) => {
          console.error('Video playback error:', error);
          setIsLoading(false);
          setError('Failed to load video');
        }}
        onPlaybackStatusUpdate={(status) => {
          setStatus(() => status);
        }}
      />
      
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
      
      {error && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    borderRadius: 8,
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  errorText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    padding: 16,
  },
});

export default VideoPlayer;
```

### Using react-native-video (Alternative)

```typescript
import Video from 'react-native-video';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

const VideoPlayer: React.FC<{ video: VideoItem }> = ({ video }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!video?.fileUrl) {
    return <PlaceholderView video={video} />;
  }

  return (
    <View style={styles.container}>
      <Video
        source={{ uri: videoUrl }}  // ✅ Use videoUrl (with fallbacks)
        poster={video.thumbnailUrl}       // ✅ Use thumbnailUrl for poster
        posterResizeMode="cover"
        resizeMode="contain"
        paused={false}
        muted={false}
        volume={1.0}
        // ⭐ Critical streaming optimizations
        bufferConfig={{
          minBufferMs: 5000,
          maxBufferMs: 10000,
          bufferForPlaybackMs: 2500,
          bufferForPlaybackAfterRebufferMs: 5000,
        }}
        // Progress tracking
        progressUpdateInterval={1000}
        // Error handling
        onLoadStart={() => setIsLoading(true)}
        onLoad={() => setIsLoading(false)}
        onError={(error) => {
          console.error('Video error:', error);
          setIsLoading(false);
          setError('Failed to load video');
        }}
        // Native controls
        controls={true}
        // Network handling
        playInBackground={false}
        playWhenInactive={false}
        ignoreSilentSwitch="ignore"
        // Cache configuration (if using caching library)
        cache={true}
      />
      
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
    </View>
  );
};
```

---

## 📋 Paginated Video List Implementation

### Complete Example with Pagination

```typescript
import { useState, useEffect, useCallback } from 'react';
import { FlatList, View, ActivityIndicator } from 'react-native';
import VideoPlayer from './VideoPlayer';

interface VideoListProps {
  endpoint: string;
  contentType?: string;
}

const VideoList: React.FC<VideoListProps> = ({ endpoint, contentType }) => {
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load videos function
  const loadVideos = useCallback(async (pageNum: number, append: boolean = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '50',
        ...(contentType && contentType !== 'ALL' && { contentType }),
      });

      const response = await fetch(`${endpoint}?${params}`, {
        headers: {
          'Authorization': `Bearer ${yourAuthToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // ⭐ Critical: Validate that fileUrl exists for each video
      const validVideos = (data.data?.media || data.media || []).filter(
        (video: any) => video.fileUrl && video.contentType === 'videos'
      );

      if (append) {
        setVideos(prev => [...prev, ...validVideos]);
      } else {
        setVideos(validVideos);
      }

      // Check if there are more pages
      const pagination = data.data?.pagination || data.pagination;
      setHasMore(
        pagination?.hasNextPage !== false &&
        pagination?.hasMore !== false &&
        pageNum < (pagination?.totalPages || 999)
      );

      setError(null);
    } catch (err: any) {
      console.error('Error loading videos:', err);
      setError(err.message || 'Failed to load videos');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [endpoint, contentType]);

  // Initial load
  useEffect(() => {
    loadVideos(1, false);
  }, [loadVideos]);

  // Load more when reaching end
  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadVideos(nextPage, true);
    }
  }, [loadingMore, hasMore, loading, page, loadVideos]);

  // Render video item
  const renderVideoItem = useCallback(({ item }: { item: any }) => {
    // ⭐ Get video URL with fallbacks and validate
    const videoUrl = item.fileUrl || item.playbackUrl || item.hlsUrl;
    
    if (!videoUrl) {
      return (
        <View style={styles.placeholderContainer}>
          <Image source={{ uri: item.thumbnailUrl }} style={styles.placeholder} />
          <Text>Video unavailable</Text>
        </View>
      );
    }

    return (
      <View style={styles.videoContainer}>
        <VideoPlayer video={item} />
        {item.title && (
          <Text style={styles.videoTitle}>{item.title}</Text>
        )}
      </View>
    );
  }, []);

  if (loading && videos.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error && videos.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Button title="Retry" onPress={() => loadVideos(1, false)} />
      </View>
    );
  }

  return (
    <FlatList
      data={videos}
      renderItem={renderVideoItem}
      keyExtractor={(item) => item._id}
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        loadingMore ? (
          <View style={styles.footerLoader}>
            <ActivityIndicator size="small" />
          </View>
        ) : null
      }
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text>No videos available</Text>
        </View>
      }
      // Performance optimizations
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      windowSize={10}
      initialNumToRender={5}
      // Video-specific optimizations
      getItemLayout={(data, index) => ({
        length: VIDEO_HEIGHT,
        offset: VIDEO_HEIGHT * index,
        index,
      })}
    />
  );
};

const VIDEO_HEIGHT = 200;

const styles = StyleSheet.create({
  videoContainer: {
    marginBottom: 16,
  },
  videoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#ff0000',
    marginBottom: 20,
    textAlign: 'center',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  placeholderContainer: {
    height: VIDEO_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  placeholder: {
    width: '100%',
    height: '100%',
  },
});

export default VideoList;
```

---

## 🚀 Optimizing Video Streaming Performance

### 1. Pre-buffer Strategy

```typescript
const useVideoPrebuffer = (videoUrl: string) => {
  const [isReady, setIsReady] = useState(false);
  const videoRef = useRef<Video>(null);

  useEffect(() => {
    if (!videoUrl || !videoRef.current) return;

    const prebuffer = async () => {
      try {
        // Load video without playing
        await videoRef.current?.loadAsync(
          { uri: videoUrl },
          {
            shouldPlay: false,
            progressUpdateIntervalMillis: 1000,
          },
          false
        );
        
        // Small delay to ensure buffer is ready
        await new Promise(resolve => setTimeout(resolve, 500));
        setIsReady(true);
      } catch (error) {
        console.error('Prebuffer error:', error);
      }
    };

    prebuffer();
  }, [videoUrl]);

  return { isReady, videoRef };
};
```

### 2. Network-Aware Loading

```typescript
import NetInfo from '@react-native-community/netinfo';

const useNetworkAwareVideo = (videoUrl: string) => {
  const [connectionType, setConnectionType] = useState<string>('unknown');
  const [shouldPlay, setShouldPlay] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setConnectionType(state.type);
      
      // Only auto-play on WiFi or if user explicitly allows
      if (state.type === 'wifi') {
        setShouldPlay(true);
      } else if (state.type === 'cellular') {
        // Optionally show user prompt before playing on cellular
        setShouldPlay(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return { connectionType, shouldPlay };
};
```

### 3. Video Caching Strategy

```typescript
// For react-native-video with caching
import VideoCache from 'react-native-video-cache';

// Pre-cache video when user scrolls near it
const preCacheVideo = async (videoUrl: string) => {
  try {
    const cachedUrl = await VideoCache.get(videoUrl);
    return cachedUrl;
  } catch (error) {
    console.error('Cache error:', error);
    return videoUrl; // Fallback to original URL
  }
};

// In your video component
const VideoPlayer = ({ video }) => {
  const [cachedUrl, setCachedUrl] = useState(video.fileUrl);

  useEffect(() => {
    preCacheVideo(video.fileUrl).then(setCachedUrl);
  }, [video.fileUrl]);

  return (
    <Video
      source={{ uri: cachedUrl }}
      // ... other props
    />
  );
};
```

---

## ✅ Checklist: Ensuring All Videos Play

- [ ] ✅ Use `fileUrl` for video `source` prop (not `thumbnailUrl`)
- [ ] ✅ Use `thumbnailUrl` for `poster` prop only
- [ ] ✅ Validate `fileUrl` exists before rendering Video component
- [ ] ✅ Handle pagination correctly (append videos, don't replace)
- [ ] ✅ Initialize video players for all videos in list (including paginated)
- [ ] ✅ Implement proper error handling for failed video loads
- [ ] ✅ Configure buffer settings for smooth playback
- [ ] ✅ Test with slow network connections
- [ ] ✅ Ensure Range request support (handled automatically by expo-av/react-native-video)
- [ ] ✅ Use proper video player configuration for streaming

---

## 🔧 Debugging Tips

### 1. Log Video URLs

```typescript
const VideoPlayer = ({ video }) => {
  useEffect(() => {
    console.log('Video Debug:', {
      id: video._id,
      fileUrl: video.fileUrl,
      thumbnailUrl: video.thumbnailUrl,
      hasFileUrl: !!video.fileUrl,
      contentType: video.contentType,
    });
  }, [video]);

  // ... rest of component
};
```

### 2. Test Video URL Directly

```typescript
// Test if video URL is accessible
const testVideoUrl = async (url: string) => {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    console.log('Video URL Test:', {
      url,
      status: response.status,
      contentType: response.headers.get('Content-Type'),
      contentLength: response.headers.get('Content-Length'),
      acceptRanges: response.headers.get('Accept-Ranges'),
    });
    return response.ok;
  } catch (error) {
    console.error('Video URL test failed:', error);
    return false;
  }
};
```

### 3. Monitor Playback Status

```typescript
const VideoPlayer = ({ video }) => {
  const handlePlaybackStatusUpdate = (status: any) => {
    if (status.error) {
      console.error('Video playback error:', {
        videoId: video._id,
        error: status.error,
        fileUrl: video.fileUrl,
      });
    }
    
    console.log('Playback status:', {
      isPlaying: status.isPlaying,
      isBuffering: status.isBuffering,
      positionMillis: status.positionMillis,
      durationMillis: status.durationMillis,
    });
  };

  return (
    <Video
      source={{ uri: video.fileUrl }}
      onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
      // ... other props
    />
  );
};
```

---

## 📝 API Endpoints Reference

### Get All Videos (Paginated)

```
GET /api/media/all?page=1&limit=50&contentType=videos
```

**Response:**
```json
{
  "success": true,
  "data": {
    "media": [
      {
        "_id": "video-id",
        "title": "Video Title",
        "fileUrl": "https://...",      // ⭐ Use for playback
        "thumbnailUrl": "https://...", // ⭐ Use for poster
        "contentType": "videos",
        "duration": 120
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 100,
      "totalPages": 2,
      "hasNextPage": true
    }
  }
}
```

### Get User Videos

```
GET /api/user-content/user/videos?page=1&limit=20
```

**Response:**
```json
{
  "success": true,
  "items": [
    {
      "id": "video-id",
      "type": "video",
      "title": "Video Title",
      "fileUrl": "https://...",      // ⭐ Use for playback
      "thumbnailUrl": "https://...", // ⭐ Use for poster
      "durationSec": 120
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 50
}
```

---

## 🎯 Summary

1. **Always use `fileUrl` for video playback** - never use `thumbnailUrl`
2. **Use `thumbnailUrl` only for poster/preview images**
3. **Validate `fileUrl` exists before rendering Video component**
4. **Handle pagination by appending videos, not replacing**
5. **Configure buffer settings for smooth streaming**
6. **Implement proper error handling and loading states**
7. **Test with various network conditions**

Following this guide will ensure ALL videos play correctly, regardless of pagination or position in the list!

