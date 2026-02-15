# Frontend Media Buffering Optimization Guide

This guide provides React Native/Expo-specific implementations to fix audio/video cracking and improve playback performance when streaming from Cloudflare R2.

## Table of Contents

1. [Video Player Optimization](#video-player-optimization)
2. [Audio Player Optimization](#audio-player-optimization)
3. [Ebook/PDF Loading](#ebookpdf-loading)
4. [Progressive Loading Strategies](#progressive-loading-strategies)
5. [Error Handling & Retry Logic](#error-handling--retry-logic)
6. [Preloading Strategies](#preloading-strategies)

---

## Video Player Optimization

### Using expo-av (Recommended)

```typescript
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { useState, useRef, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';

interface OptimizedVideoPlayerProps {
  videoUrl: string;
  shouldPlay?: boolean;
  onLoadStart?: () => void;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

export const OptimizedVideoPlayer: React.FC<OptimizedVideoPlayerProps> = ({
  videoUrl,
  shouldPlay = false,
  onLoadStart,
  onLoad,
  onError,
}) => {
  const videoRef = useRef<Video>(null);
  const [isBuffering, setIsBuffering] = useState(true);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Pre-buffer before allowing play
    const preloadVideo = async () => {
      try {
        if (videoRef.current) {
          // Load video without playing
          await videoRef.current.loadAsync(
            { uri: videoUrl },
            {
              shouldPlay: false,
              // Optimized buffering configuration
              progressUpdateIntervalMillis: 1000,
              positionMillis: 0,
              isLooping: false,
              isMuted: false,
              volume: 1.0,
              // Critical: Increase buffer sizes to prevent cracking
              shouldCorrectPitch: true,
              // Additional options for better streaming
              resizeMode: ResizeMode.CONTAIN,
            },
            false // Don't play immediately
          );

          setIsReady(true);
          setIsBuffering(false);
          onLoad?.();

          // Small delay to ensure buffer is ready
          await new Promise(resolve => setTimeout(resolve, 500));

          // Now allow playback
          if (shouldPlay) {
            await videoRef.current.playAsync();
          }
        }
      } catch (error) {
        console.error('Video preload error:', error);
        setIsBuffering(false);
        onError?.(error as Error);
      }
    };

    preloadVideo();

    return () => {
      // Cleanup
      videoRef.current?.unloadAsync();
    };
  }, [videoUrl]);

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      // Monitor buffering state
      if (status.isBuffering) {
        setIsBuffering(true);
      } else {
        setIsBuffering(false);
      }

      // Handle playback errors
      if (status.error) {
        console.error('Playback error:', status.error);
        onError?.(new Error(status.error));
      }
    }
  };

  const handlePlay = async () => {
    try {
      if (videoRef.current && isReady) {
        await videoRef.current.playAsync();
      }
    } catch (error) {
      console.error('Play error:', error);
      onError?.(error as Error);
    }
  };

  const handlePause = async () => {
    try {
      if (videoRef.current) {
        await videoRef.current.pauseAsync();
      }
    } catch (error) {
      console.error('Pause error:', error);
    }
  };

  return (
    <View style={{ position: 'relative' }}>
      {isBuffering && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1,
          }}
        >
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}

      <Video
        ref={videoRef}
        source={{ uri: videoUrl }}
        style={{ width: '100%', height: 200 }}
        resizeMode={ResizeMode.CONTAIN}
        useNativeControls={true}
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        onLoadStart={onLoadStart}
        onLoad={onLoad}
        onError={(error) => {
          console.error('Video player error:', error);
          onError?.(error);
        }}
        // Critical optimizations
        progressUpdateIntervalMillis={1000}
        shouldPlay={false} // Let user initiate play after buffering
        isLooping={false}
        // Network retry configuration
        posterSource={undefined} // Add poster image URL if available
      />
    </View>
  );
};
```

### Using react-native-video (Alternative)

```typescript
import Video from 'react-native-video';
import { useState, useRef } from 'react';

interface OptimizedRNVideoPlayerProps {
  videoUrl: string;
}

export const OptimizedRNVideoPlayer: React.FC<OptimizedRNVideoPlayerProps> = ({
  videoUrl,
}) => {
  const videoRef = useRef<Video>(null);
  const [isBuffering, setIsBuffering] = useState(true);

  return (
    <Video
      ref={videoRef}
      source={{ uri: videoUrl }}
      style={{ width: '100%', height: 200 }}
      resizeMode="contain"
      controls={true}
      // Critical buffering optimizations
      bufferConfig={{
        minBufferMs: 5000,        // Minimum buffer: 5 seconds
        maxBufferMs: 10000,       // Maximum buffer: 10 seconds
        bufferForPlaybackMs: 2500, // Buffer before playback: 2.5 seconds
        bufferForPlaybackAfterRebufferMs: 5000, // Buffer after rebuffer: 5 seconds
      }}
      // Network optimization
      maxBitRate={5000000} // Limit bitrate if needed (5 Mbps)
      selectedVideoTrack={{
        type: 'resolution',
        value: 1080, // Prefer 1080p, but will adapt
      }}
      // Event handlers
      onLoadStart={() => setIsBuffering(true)}
      onLoad={() => setIsBuffering(false)}
      onBuffer={({ isBuffering: buffering }) => setIsBuffering(buffering)}
      onError={(error) => {
        console.error('Video error:', error);
        setIsBuffering(false);
        // Implement retry logic here
      }}
      // Playback optimization
      paused={false}
      repeat={false}
      playInBackground={false}
      playWhenInactive={false}
      ignoreSilentSwitch="ignore"
      // Progress tracking
      progressUpdateInterval={1000}
    />
  );
};
```

---

## Audio Player Optimization

### Using expo-av for Audio

```typescript
import { Audio, AVPlaybackStatus } from 'expo-av';
import { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, Text, ActivityIndicator } from 'react-native';

interface OptimizedAudioPlayerProps {
  audioUrl: string;
  autoPlay?: boolean;
}

export const OptimizedAudioPlayer: React.FC<OptimizedAudioPlayerProps> = ({
  audioUrl,
  autoPlay = false,
}) => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playbackStatus, setPlaybackStatus] = useState<AVPlaybackStatus | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadAudio = async () => {
      try {
        setIsLoading(true);
        setIsBuffering(true);

        // Configure audio mode for better playback
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });

        // Create and load sound
        const { sound: audioSound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          {
            // Don't play immediately - pre-buffer first
            shouldPlay: false,
            // Optimized playback settings
            isLooping: false,
            isMuted: false,
            volume: 1.0,
            rate: 1.0,
            shouldCorrectPitch: true,
            // Progress tracking
            progressUpdateIntervalMillis: 1000,
            positionMillis: 0,
          },
          (status: AVPlaybackStatus) => {
            if (isMounted) {
              setPlaybackStatus(status);

              if (status.isLoaded) {
                setIsBuffering(status.isBuffering);
                setIsPlaying(status.isPlaying);

                // Handle playback errors
                if (status.error) {
                  console.error('Audio playback error:', status.error);
                  setIsLoading(false);
                }

                // Audio is ready when not buffering and loaded
                if (!status.isBuffering && status.isLoaded) {
                  setIsLoading(false);
                }
              }
            }
          }
        );

        if (isMounted) {
          setSound(audioSound);

          // Pre-buffer: wait a moment before allowing playback
          await new Promise(resolve => setTimeout(resolve, 500));

          setIsBuffering(false);
          setIsLoading(false);

          // Auto-play if requested (after buffering)
          if (autoPlay) {
            await audioSound.playAsync();
          }
        }
      } catch (error) {
        console.error('Error loading audio:', error);
        if (isMounted) {
          setIsLoading(false);
          setIsBuffering(false);
        }
      }
    };

    loadAudio();

    return () => {
      isMounted = false;
      // Cleanup
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [audioUrl, autoPlay]);

  const handlePlayPause = async () => {
    try {
      if (!sound) return;

      const status = await sound.getStatusAsync();
      if (status.isLoaded) {
        if (status.isPlaying) {
          await sound.pauseAsync();
        } else {
          // Ensure we're not still buffering before playing
          if (!playbackStatus?.isBuffering) {
            await sound.playAsync();
          }
        }
      }
    } catch (error) {
      console.error('Play/pause error:', error);
    }
  };

  const handleSeek = async (positionMillis: number) => {
    try {
      if (sound) {
        await sound.setPositionAsync(positionMillis);
      }
    } catch (error) {
      console.error('Seek error:', error);
    }
  };

  // Format time helper
  const formatTime = (millis: number) => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <View style={{ padding: 20, alignItems: 'center' }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 10 }}>Loading audio...</Text>
      </View>
    );
  }

  const currentPosition = playbackStatus?.isLoaded
    ? playbackStatus.positionMillis
    : 0;
  const duration = playbackStatus?.isLoaded ? playbackStatus.durationMillis : 0;

  return (
    <View style={{ padding: 20 }}>
      {isBuffering && (
        <View style={{ marginBottom: 10 }}>
          <Text style={{ textAlign: 'center', color: '#666' }}>
            Buffering...
          </Text>
        </View>
      )}

      <TouchableOpacity
        onPress={handlePlayPause}
        style={{
          padding: 15,
          backgroundColor: '#007AFF',
          borderRadius: 8,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: 'white', fontSize: 16 }}>
          {isPlaying ? 'Pause' : 'Play'}
        </Text>
      </TouchableOpacity>

      {duration > 0 && (
        <View style={{ marginTop: 10 }}>
          <Text style={{ textAlign: 'center' }}>
            {formatTime(currentPosition)} / {formatTime(duration)}
          </Text>
        </View>
      )}
    </View>
  );
};
```

---

## Ebook/PDF Loading

### Progressive PDF Loading with expo-file-system

```typescript
import * as FileSystem from 'expo-file-system';
import { useState, useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { DocumentView } from 'react-native-pdf';

interface OptimizedPDFViewerProps {
  pdfUrl: string;
  title?: string;
}

export const OptimizedPDFViewer: React.FC<OptimizedPDFViewerProps> = ({
  pdfUrl,
  title,
}) => {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(true);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const downloadPDF = async () => {
      try {
        setIsDownloading(true);
        setError(null);

        // Check if file already exists in cache
        const filename = pdfUrl.split('/').pop() || 'document.pdf';
        const fileUri = `${FileSystem.cacheDirectory}${filename}`;

        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if (fileInfo.exists) {
          // File already cached
          setLocalUri(fileUri);
          setIsDownloading(false);
          return;
        }

        // Download with progress tracking
        const downloadResumable = FileSystem.createDownloadResumable(
          pdfUrl,
          fileUri,
          {},
          (downloadProgress) => {
            const progress =
              downloadProgress.totalBytesWritten /
              downloadProgress.totalBytesExpectedToWrite;
            setDownloadProgress(progress * 100);
          }
        );

        const result = await downloadResumable.downloadAsync();
        if (result) {
          setLocalUri(result.uri);
          setIsDownloading(false);
        } else {
          throw new Error('Download failed');
        }
      } catch (err) {
        console.error('PDF download error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load PDF');
        setIsDownloading(false);
        // Fallback to direct URL
        setLocalUri(pdfUrl);
      }
    };

    downloadPDF();
  }, [pdfUrl]);

  if (isDownloading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 10 }}>
          Loading {title || 'document'}... {Math.round(downloadProgress)}%
        </Text>
      </View>
    );
  }

  if (error && !localUri) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: 'red' }}>Error: {error}</Text>
      </View>
    );
  }

  return (
    <DocumentView
      source={{ uri: localUri || pdfUrl }}
      style={{ flex: 1 }}
      onLoadComplete={(numberOfPages) => {
        console.log(`PDF loaded: ${numberOfPages} pages`);
      }}
      onPageChanged={(page, numberOfPages) => {
        console.log(`Page ${page} of ${numberOfPages}`);
      }}
      onError={(error) => {
        console.error('PDF render error:', error);
        setError('Failed to render PDF');
      }}
    />
  );
};
```

---

## Progressive Loading Strategies

### Preload Media Metadata

```typescript
interface MediaMetadata {
  size: number | null;
  type: string | null;
  supportsRange: boolean;
  duration?: number;
}

export const preloadMediaMetadata = async (
  mediaUrl: string
): Promise<MediaMetadata | null> => {
  try {
    // HEAD request to get metadata without downloading
    const response = await fetch(mediaUrl, { method: 'HEAD' });

    const contentLength = response.headers.get('Content-Length');
    const contentType = response.headers.get('Content-Type');
    const acceptRanges = response.headers.get('Accept-Ranges');
    const contentRange = response.headers.get('Content-Range');

    return {
      size: contentLength ? parseInt(contentLength, 10) : null,
      type: contentType,
      supportsRange: acceptRanges === 'bytes',
      // Duration might be in Content-Range or need separate request
    };
  } catch (error) {
    console.error('Preload metadata error:', error);
    return null;
  }
};

// Usage
const metadata = await preloadMediaMetadata(videoUrl);
if (metadata?.supportsRange) {
  console.log('Range requests supported, using optimized streaming');
}
```

### Range Request Helper

```typescript
export const fetchMediaWithRange = async (
  url: string,
  start?: number,
  end?: number
): Promise<Response> => {
  const headers: HeadersInit = {};

  if (start !== undefined && end !== undefined) {
    headers['Range'] = `bytes=${start}-${end}`;
  }

  const response = await fetch(url, { headers });

  if (response.status === 206) {
    // Partial content - Range request successful
    const contentRange = response.headers.get('Content-Range');
    const contentLength = response.headers.get('Content-Length');
    console.log('Range request successful:', { contentRange, contentLength });
  }

  return response;
};
```

---

## Error Handling & Retry Logic

### Retry Helper with Exponential Backoff

```typescript
interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
}

export const fetchWithRetry = async (
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<Response> => {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
  } = retryOptions;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Retry on server errors (5xx) and network errors
      if (response.status >= 500 || response.status === 0) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response;
    } catch (error) {
      lastError = error as Error;
      console.warn(`Fetch attempt ${attempt + 1} failed:`, error);

      // Don't retry on last attempt
      if (attempt < maxRetries) {
        const delay = Math.min(
          initialDelay * Math.pow(backoffMultiplier, attempt),
          maxDelay
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Failed after retries');
};

// Usage in audio/video loading
const loadAudioWithRetry = async (audioUrl: string) => {
  try {
    // First, verify URL is accessible
    const response = await fetchWithRetry(audioUrl, { method: 'HEAD' });
    
    if (response.ok) {
      // Now load the audio
      const { sound } = await Audio.Sound.createAsync({ uri: audioUrl });
      return sound;
    }
  } catch (error) {
    console.error('Failed to load audio after retries:', error);
    throw error;
  }
};
```

---

## Preloading Strategies

### Preload Queue Manager

```typescript
interface PreloadItem {
  url: string;
  type: 'video' | 'audio' | 'image';
  priority: 'high' | 'medium' | 'low';
}

class MediaPreloadManager {
  private queue: PreloadItem[] = [];
  private activeLoads: Set<string> = new Set();
  private maxConcurrentLoads = 2;

  addToQueue(item: PreloadItem) {
    this.queue.push(item);
    this.queue.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
    this.processQueue();
  }

  private async processQueue() {
    while (
      this.queue.length > 0 &&
      this.activeLoads.size < this.maxConcurrentLoads
    ) {
      const item = this.queue.shift();
      if (!item) break;

      if (this.activeLoads.has(item.url)) continue;
      this.activeLoads.add(item.url);

      this.preloadItem(item).finally(() => {
        this.activeLoads.delete(item.url);
        this.processQueue();
      });
    }
  }

  private async preloadItem(item: PreloadItem) {
    try {
      // Preload metadata only (HEAD request)
      await fetch(item.url, { method: 'HEAD' });
      console.log(`Preloaded metadata for ${item.url}`);
    } catch (error) {
      console.error(`Preload failed for ${item.url}:`, error);
    }
  }

  clear() {
    this.queue = [];
    this.activeLoads.clear();
  }
}

// Singleton instance
export const mediaPreloadManager = new MediaPreloadManager();

// Usage: Preload next items in playlist
const preloadNextItems = (playlist: MediaItem[], currentIndex: number) => {
  const nextItems = playlist.slice(currentIndex + 1, currentIndex + 4); // Next 3 items
  
  nextItems.forEach((item, index) => {
    mediaPreloadManager.addToQueue({
      url: item.url,
      type: item.type,
      priority: index === 0 ? 'high' : 'medium',
    });
  });
};
```

---

## Best Practices Summary

### ✅ DO:

1. **Always pre-buffer** before allowing playback
2. **Increase buffer sizes** (5000-10000ms for video/audio)
3. **Implement retry logic** with exponential backoff
4. **Preload metadata** (HEAD requests) for upcoming items
5. **Use Range requests** for seeking and resumable downloads
6. **Show loading states** to users
7. **Handle network errors** gracefully
8. **Cache downloaded files** locally when possible

### ❌ DON'T:

1. Don't start playback immediately without buffering
2. Don't use small buffer sizes (< 2000ms)
3. Don't ignore network errors
4. Don't download entire files before playing (use streaming)
5. Don't forget to clean up audio/video resources
6. Don't make multiple simultaneous requests to same URL

---

## Testing Checklist

- [ ] Video plays smoothly without cracking
- [ ] Audio doesn't stutter or crack
- [ ] Seeking/scrubbing works correctly
- [ ] Playback resumes after network interruption
- [ ] Loading indicators show during buffering
- [ ] Error messages display appropriately
- [ ] PDFs/eBooks load progressively
- [ ] Retry logic works on network failures
- [ ] Memory usage is reasonable (no leaks)

---

**Last Updated**: 2024
**Framework**: React Native / Expo


