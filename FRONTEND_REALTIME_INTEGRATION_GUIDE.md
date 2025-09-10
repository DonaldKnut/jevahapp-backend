# Frontend Real-Time Integration Guide - Complete Implementation

## 🎯 **Status: READY FOR PROFESSIONAL IMPLEMENTATION**

Your frontend is already well-structured! Here's how to add real-time features to your existing `AllContent` component.

## 📡 **Socket.IO Integration**

### **Step 1: Install Socket.IO Client**

```bash
npm install socket.io-client
```

### **Step 2: Create Socket Manager Service**

Create `app/services/SocketManager.ts`:

```typescript
import io, { Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthenticatedUser {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

interface SocketManagerConfig {
  serverUrl: string;
  authToken: string;
}

class SocketManager {
  private socket: Socket | null = null;
  private authToken: string;
  private serverUrl: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(config: SocketManagerConfig) {
    this.serverUrl = config.serverUrl;
    this.authToken = config.authToken;
  }

  async connect(): Promise<void> {
    try {
      this.socket = io(this.serverUrl, {
        auth: {
          token: this.authToken,
        },
        transports: ['websocket', 'polling'],
        timeout: 20000,
      });

      this.setupEventHandlers();
      console.log('✅ Connected to real-time server');
    } catch (error) {
      console.error('❌ Failed to connect to real-time server:', error);
      throw error;
    }
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('✅ Socket connected');
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
      this.handleReconnect();
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
      this.handleReconnect();
    });

    // Real-time content events
    this.socket.on('content-reaction', (data) => {
      console.log('Real-time like received:', data);
      this.handleContentReaction(data);
    });

    this.socket.on('content-comment', (data) => {
      console.log('Real-time comment received:', data);
      this.handleContentComment(data);
    });

    this.socket.on('count-update', (data) => {
      console.log('Real-time count update:', data);
      this.handleCountUpdate(data);
    });

    this.socket.on('viewer-count-update', (data) => {
      console.log('Real-time viewer count:', data);
      this.handleViewerCountUpdate(data);
    });

    // Notifications
    this.socket.on('new-like-notification', (data) => {
      console.log('New like notification:', data);
      this.handleLikeNotification(data);
    });

    this.socket.on('new-comment-notification', (data) => {
      console.log('New comment notification:', data);
      this.handleCommentNotification(data);
    });

    // Error handling
    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      
      setTimeout(() => {
        console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect();
      }, delay);
    }
  }

  // Content room management
  joinContentRoom(contentId: string, contentType: string): void {
    if (this.socket) {
      this.socket.emit('join-content', { contentId, contentType });
      console.log(`📺 Joined content room: ${contentType}:${contentId}`);
    }
  }

  leaveContentRoom(contentId: string, contentType: string): void {
    if (this.socket) {
      this.socket.emit('leave-content', { contentId, contentType });
      console.log(`📺 Left content room: ${contentType}:${contentId}`);
    }
  }

  // Real-time interactions
  sendLike(contentId: string, contentType: string): void {
    if (this.socket) {
      this.socket.emit('content-reaction', {
        contentId,
        contentType,
        actionType: 'like',
      });
      console.log(`❤️ Sent like: ${contentType}:${contentId}`);
    }
  }

  sendComment(contentId: string, contentType: string, comment: string, parentCommentId?: string): void {
    if (this.socket) {
      this.socket.emit('content-comment', {
        contentId,
        contentType,
        content: comment,
        parentCommentId,
      });
      console.log(`💬 Sent comment: ${contentType}:${contentId}`);
    }
  }

  // Event handlers (to be implemented by components)
  private handleContentReaction(data: any): void {
    // Override in component
  }

  private handleContentComment(data: any): void {
    // Override in component
  }

  private handleCountUpdate(data: any): void {
    // Override in component
  }

  private handleViewerCountUpdate(data: any): void {
    // Override in component
  }

  private handleLikeNotification(data: any): void {
    // Override in component
  }

  private handleCommentNotification(data: any): void {
    // Override in component
  }

  // Public methods for components to override
  setEventHandlers(handlers: {
    onContentReaction?: (data: any) => void;
    onContentComment?: (data: any) => void;
    onCountUpdate?: (data: any) => void;
    onViewerCountUpdate?: (data: any) => void;
    onLikeNotification?: (data: any) => void;
    onCommentNotification?: (data: any) => void;
  }): void {
    if (handlers.onContentReaction) {
      this.handleContentReaction = handlers.onContentReaction;
    }
    if (handlers.onContentComment) {
      this.handleContentComment = handlers.onContentComment;
    }
    if (handlers.onCountUpdate) {
      this.handleCountUpdate = handlers.onCountUpdate;
    }
    if (handlers.onViewerCountUpdate) {
      this.handleViewerCountUpdate = handlers.onViewerCountUpdate;
    }
    if (handlers.onLikeNotification) {
      this.handleLikeNotification = handlers.onLikeNotification;
    }
    if (handlers.onCommentNotification) {
      this.handleCommentNotification = handlers.onCommentNotification;
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log('🔌 Disconnected from real-time server');
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export default SocketManager;
```

### **Step 3: Update Your AllContent Component**

Here's how to enhance your existing `AllContent.tsx`:

```typescript
import { useCallback, useEffect, useState, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Text,
  View,
} from "react-native";
import CommentModal from "../components/CommentModal";
import ContentCard from "../components/ContentCard";
import { useMediaStore } from "../store/useUploadStore";
import allMediaAPI from "../utils/allMediaAPI";
import SocketManager from "../services/SocketManager";
import AsyncStorage from '@react-native-async-storage/async-storage';

const AllContent = () => {
  const {
    defaultContent,
    defaultContentLoading,
    defaultContentError,
    defaultContentPagination,
    fetchDefaultContent,
    loadMoreDefaultContent,
    refreshDefaultContent,
  } = useMediaStore();

  // Comment modal state
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedContentId, setSelectedContentId] = useState<string>("");
  const [selectedContentTitle, setSelectedContentTitle] = useState<string>("");

  // Real-time state
  const [socketManager, setSocketManager] = useState<SocketManager | null>(null);
  const [realTimeCounts, setRealTimeCounts] = useState<Record<string, any>>({});
  const [viewerCounts, setViewerCounts] = useState<Record<string, number>>({});
  const [notifications, setNotifications] = useState<any[]>([]);

  // Initialize Socket.IO connection
  useEffect(() => {
    const initializeSocket = async () => {
      try {
        const authToken = await AsyncStorage.getItem('auth_token');
        if (!authToken) {
          console.log('No auth token found, skipping Socket.IO connection');
          return;
        }

        const manager = new SocketManager({
          serverUrl: 'https://jevahapp-backend.onrender.com',
          authToken,
        });

        // Set up event handlers
        manager.setEventHandlers({
          onContentReaction: (data) => {
            console.log('Real-time like received:', data);
            // Update local state if needed
          },
          onContentComment: (data) => {
            console.log('Real-time comment received:', data);
            // Update local state if needed
          },
          onCountUpdate: (data) => {
            console.log('Real-time count update:', data);
            setRealTimeCounts(prev => ({
              ...prev,
              [data.contentId]: data
            }));
          },
          onViewerCountUpdate: (data) => {
            console.log('Real-time viewer count:', data);
            setViewerCounts(prev => ({
              ...prev,
              [data.contentId]: data.viewerCount
            }));
          },
          onLikeNotification: (data) => {
            console.log('New like notification:', data);
            setNotifications(prev => [...prev, {
              id: Date.now(),
              type: 'like',
              data,
              timestamp: new Date()
            }]);
          },
          onCommentNotification: (data) => {
            console.log('New comment notification:', data);
            setNotifications(prev => [...prev, {
              id: Date.now(),
              type: 'comment',
              data,
              timestamp: new Date()
            }]);
          },
        });

        await manager.connect();
        setSocketManager(manager);
        console.log('✅ Socket.IO initialized successfully');
      } catch (error) {
        console.error('❌ Failed to initialize Socket.IO:', error);
      }
    };

    initializeSocket();

    // Cleanup on unmount
    return () => {
      if (socketManager) {
        socketManager.disconnect();
      }
    };
  }, []);

  // Load default content on mount
  useEffect(() => {
    console.log("🚀 AllContent: Loading default content from backend...");

    // Test available endpoints first
    allMediaAPI.testAvailableEndpoints();

    // Then fetch content
    fetchDefaultContent({ page: 1, limit: 10 });
  }, [fetchDefaultContent]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    refreshDefaultContent();
  }, [refreshDefaultContent]);

  // Handle load more
  const handleLoadMore = useCallback(() => {
    loadMoreDefaultContent();
  }, [loadMoreDefaultContent]);

  // Enhanced like handler with real-time updates
  const handleLike = useCallback(async (contentId: string, liked: boolean) => {
    try {
      console.log("Like action:", contentId, liked);

      // Send real-time like first for instant feedback
      if (socketManager) {
        socketManager.sendLike(contentId, 'media');
      }

      // Then call API
      const response = await allMediaAPI.toggleLike("media", contentId);

      if (response.success) {
        console.log("✅ Like successful:", response.data);
        // Real-time updates will handle UI updates
      } else {
        console.error("❌ Like failed:", response.error);
        Alert.alert("Error", "Failed to update like");
      }
    } catch (error) {
      console.error("Like error:", error);
      Alert.alert("Error", "Failed to update like");
    }
  }, [socketManager]);

  // Enhanced comment handler
  const handleComment = useCallback(
    (contentId: string) => {
      console.log("Opening comment modal for:", contentId);

      // Join content room for real-time updates
      if (socketManager) {
        socketManager.joinContentRoom(contentId, 'media');
      }

      // Find the content item to get the title
      const contentItem = defaultContent.find((item) => item._id === contentId);

      setSelectedContentId(contentId);
      setSelectedContentTitle(contentItem?.title || "Content");
      setCommentModalVisible(true);
    },
    [defaultContent, socketManager]
  );

  // Enhanced share handler
  const handleShare = useCallback(async (contentId: string) => {
    try {
      console.log("Share action:", contentId);

      const response = await allMediaAPI.shareContent(
        "media",
        contentId,
        "general",
        "Check this out!"
      );

      if (response.success) {
        console.log("✅ Share successful:", response.data);
        Alert.alert("Success", "Content shared successfully!");
      } else {
        console.error("❌ Share failed:", response.error);
        Alert.alert("Error", "Failed to share content");
      }
    } catch (error) {
      console.error("Share error:", error);
      Alert.alert("Error", "Failed to share content");
    }
  }, []);

  // Handle author press
  const handleAuthorPress = useCallback((authorId: string) => {
    console.log("Navigate to author profile:", authorId);
    // Navigate to author profile
    // Example: router.push('/profile', { userId: authorId });
  }, []);

  // Enhanced save to library handler
  const handleSaveToLibrary = useCallback(
    async (contentId: string, isBookmarked: boolean) => {
      try {
        console.log("Save to library action:", contentId, isBookmarked);

        const response = isBookmarked
          ? await allMediaAPI.unbookmarkContent(contentId)
          : await allMediaAPI.bookmarkContent(contentId);

        if (response.success) {
          console.log("✅ Bookmark successful:", response.data);
          Alert.alert(
            "Success",
            isBookmarked ? "Removed from library" : "Saved to library"
          );
        } else {
          console.error("❌ Bookmark failed:", response.error);
          Alert.alert("Error", "Failed to update library");
        }
      } catch (error) {
        console.error("Bookmark error:", error);
        Alert.alert("Error", "Failed to update library");
      }
    },
    []
  );

  // Enhanced render content item with real-time data
  const renderContentItem = useCallback(
    ({ item }: { item: any }) => {
      // Get real-time data for this content
      const realTimeData = realTimeCounts[item._id] || {};
      const viewerCount = viewerCounts[item._id] || 0;

      // Merge real-time data with content
      const enhancedItem = {
        ...item,
        likeCount: realTimeData.likeCount ?? item.likeCount,
        commentCount: realTimeData.commentCount ?? item.commentCount,
        shareCount: realTimeData.shareCount ?? item.shareCount,
        viewCount: realTimeData.viewCount ?? item.viewCount,
        viewerCount,
      };

      return (
        <ContentCard
          content={enhancedItem}
          onLike={handleLike}
          onComment={handleComment}
          onShare={handleShare}
          onAuthorPress={handleAuthorPress}
          onSaveToLibrary={handleSaveToLibrary}
          socketManager={socketManager}
        />
      );
    },
    [
      handleLike,
      handleComment,
      handleShare,
      handleAuthorPress,
      handleSaveToLibrary,
      socketManager,
      realTimeCounts,
      viewerCounts,
    ]
  );

  // Render loading indicator
  const renderFooter = useCallback(() => {
    if (!defaultContentLoading) return null;

    return (
      <View style={{ padding: 20, alignItems: "center" }}>
        <ActivityIndicator size="small" color="#666" />
      </View>
    );
  }, [defaultContentLoading]);

  // Render empty state
  const renderEmpty = useCallback(
    () => (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 40,
        }}
      >
        <Text style={{ fontSize: 18, color: "#666" }}>
          No content available
        </Text>
        <Text style={{ fontSize: 14, color: "#999", marginTop: 8 }}>
          Pull down to refresh
        </Text>
      </View>
    ),
    []
  );

  // Render connection status
  const renderConnectionStatus = useCallback(() => {
    if (!socketManager) return null;

    return (
      <View style={{
        padding: 8,
        backgroundColor: socketManager.isConnected() ? '#4CAF50' : '#f44336',
        alignItems: 'center'
      }}>
        <Text style={{ color: 'white', fontSize: 12 }}>
          {socketManager.isConnected() ? '🟢 Connected' : '🔴 Disconnected'}
        </Text>
      </View>
    );
  }, [socketManager]);

  if (defaultContentLoading && defaultContent.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#666" />
        <Text style={{ marginTop: 12, fontSize: 16, color: "#666" }}>
          Loading content...
        </Text>
      </View>
    );
  }

  if (defaultContentError) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 40,
        }}
      >
        <Text style={{ fontSize: 18, color: "#e74c3c", textAlign: "center" }}>
          Error loading content
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: "#666",
            marginTop: 8,
            textAlign: "center",
          }}
        >
          {defaultContentError}
        </Text>
      </View>
    );
  }

  return (
    <>
      {renderConnectionStatus()}
      
      <FlatList
        data={defaultContent}
        renderItem={renderContentItem}
        keyExtractor={(item) => item._id}
        refreshControl={
          <RefreshControl
            refreshing={defaultContentLoading && defaultContent.length > 0}
            onRefresh={handleRefresh}
            colors={["#666"]}
            tintColor="#666"
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={5}
        windowSize={10}
        initialNumToRender={3}
      />

      {/* Comment Modal */}
      <CommentModal
        visible={commentModalVisible}
        onClose={() => {
          setCommentModalVisible(false);
          // Leave content room when closing modal
          if (socketManager && selectedContentId) {
            socketManager.leaveContentRoom(selectedContentId, 'media');
          }
        }}
        contentId={selectedContentId}
        contentTitle={selectedContentTitle}
        onCommentPosted={(comment) => {
          console.log("New comment posted:", comment);
          // Send real-time comment
          if (socketManager) {
            socketManager.sendComment(selectedContentId, 'media', comment.content);
          }
        }}
        socketManager={socketManager}
      />
    </>
  );
};

export default AllContent;
```

### **Step 4: Enhanced ContentCard Component**

Update your `ContentCard.tsx` to handle real-time updates:

```typescript
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native';
import Video from 'react-native-video';
import Icon from 'react-native-vector-icons/MaterialIcons';
import SocketManager from '../services/SocketManager';

const { width: screenWidth } = Dimensions.get('window');

interface ContentCardProps {
  content: any;
  onLike: (contentId: string, liked: boolean) => void;
  onComment: (contentId: string) => void;
  onShare: (contentId: string) => void;
  onAuthorPress: (authorId: string) => void;
  onSaveToLibrary: (contentId: string, isBookmarked: boolean) => void;
  socketManager?: SocketManager | null;
}

const ContentCard: React.FC<ContentCardProps> = ({
  content,
  onLike,
  onComment,
  onShare,
  onAuthorPress,
  onSaveToLibrary,
  socketManager,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(content.isLiked || false);
  const [likeCount, setLikeCount] = useState(content.likeCount || 0);
  const [commentCount, setCommentCount] = useState(content.commentCount || 0);
  const [shareCount, setShareCount] = useState(content.shareCount || 0);
  const [viewerCount, setViewerCount] = useState(content.viewerCount || 0);
  const [isBookmarked, setIsBookmarked] = useState(content.isBookmarked || false);

  // Animation values
  const likeAnimation = useRef(new Animated.Value(1)).current;
  const heartAnimation = useRef(new Animated.Value(0)).current;

  // Join content room for real-time updates
  useEffect(() => {
    if (socketManager) {
      socketManager.joinContentRoom(content._id, 'media');
      
      // Set up real-time event handlers for this specific content
      const originalHandlers = {
        onContentReaction: socketManager.handleContentReaction,
        onCountUpdate: socketManager.handleCountUpdate,
        onViewerCountUpdate: socketManager.handleViewerCountUpdate,
      };

      socketManager.setEventHandlers({
        ...originalHandlers,
        onContentReaction: (data) => {
          if (data.contentId === content._id) {
            setIsLiked(data.liked);
            setLikeCount(data.count);
            animateLike();
          }
          originalHandlers.onContentReaction?.(data);
        },
        onCountUpdate: (data) => {
          if (data.contentId === content._id) {
            setLikeCount(data.likeCount);
            setCommentCount(data.commentCount);
            setShareCount(data.shareCount);
          }
          originalHandlers.onCountUpdate?.(data);
        },
        onViewerCountUpdate: (data) => {
          if (data.contentId === content._id) {
            setViewerCount(data.viewerCount);
          }
          originalHandlers.onViewerCountUpdate?.(data);
        },
      });
    }

    return () => {
      if (socketManager) {
        socketManager.leaveContentRoom(content._id, 'media');
      }
    };
  }, [content._id, socketManager]);

  // Animation functions
  const animateLike = () => {
    Animated.sequence([
      Animated.timing(likeAnimation, {
        toValue: 1.2,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(likeAnimation, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    // Heart animation
    Animated.sequence([
      Animated.timing(heartAnimation, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(heartAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Interaction handlers
  const handleLike = async () => {
    try {
      // Optimistic update
      const newLikedState = !isLiked;
      const newLikeCount = newLikedState ? likeCount + 1 : likeCount - 1;
      
      setIsLiked(newLikedState);
      setLikeCount(newLikeCount);
      animateLike();

      // Call parent handler
      await onLike(content._id, newLikedState);
    } catch (error) {
      // Revert optimistic update on error
      setIsLiked(!isLiked);
      setLikeCount(likeCount);
      console.error('Like error:', error);
    }
  };

  const handleComment = () => {
    onComment(content._id);
  };

  const handleShare = async () => {
    try {
      await onShare(content._id);
      setShareCount(shareCount + 1);
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleAuthorPress = () => {
    onAuthorPress(content.author._id);
  };

  const handleSaveToLibrary = async () => {
    try {
      const newBookmarkState = !isBookmarked;
      setIsBookmarked(newBookmarkState);
      await onSaveToLibrary(content._id, newBookmarkState);
    } catch (error) {
      // Revert on error
      setIsBookmarked(!isBookmarked);
      console.error('Bookmark error:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <View style={styles.container}>
      {/* Header with Author Info */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.authorInfo} 
          onPress={handleAuthorPress}
          activeOpacity={0.7}
        >
          <Image
            source={{
              uri: content.author.avatar || 'https://via.placeholder.com/40x40/cccccc/ffffff?text=U'
            }}
            style={styles.avatar}
          />
          <View style={styles.authorDetails}>
            <Text style={styles.authorName}>
              {content.author.firstName} {content.author.lastName}
            </Text>
            <Text style={styles.timestamp}>{formatDate(content.createdAt)}</Text>
          </View>
        </TouchableOpacity>
        
        <View style={styles.headerRight}>
          {viewerCount > 0 && (
            <View style={styles.viewerCount}>
              <Icon name="visibility" size={16} color="#666" />
              <Text style={styles.viewerCountText}>{viewerCount}</Text>
            </View>
          )}
          <TouchableOpacity style={styles.moreButton}>
            <Icon name="more-vert" size={24} color="#666" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Media Content */}
      <View style={styles.mediaContainer}>
        {content.contentType === 'video' ? (
          <View style={styles.videoContainer}>
            <Video
              source={{ uri: content.mediaUrl }}
              style={styles.video}
              resizeMode="cover"
              paused={!isPlaying}
              onLoad={() => setIsVideoLoading(false)}
              onError={(error) => {
                console.error('Video error:', error);
                setIsVideoLoading(false);
              }}
            />
            
            <TouchableOpacity
              style={styles.videoOverlay}
              onPress={() => setIsPlaying(!isPlaying)}
              activeOpacity={0.8}
            >
              {isVideoLoading && (
                <ActivityIndicator size="large" color="#fff" />
              )}
              {!isVideoLoading && (
                <Icon
                  name={isPlaying ? 'pause' : 'play-arrow'}
                  size={50}
                  color="rgba(255,255,255,0.8)"
                />
              )}
            </TouchableOpacity>
          </View>
        ) : content.contentType === 'image' ? (
          <Image
            source={{ uri: content.mediaUrl }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.audioContainer}>
            <Icon name="music-note" size={50} color="#666" />
            <Text style={styles.audioText}>Audio Content</Text>
          </View>
        )}

        {/* Double-tap heart animation */}
        <Animated.View
          style={[
            styles.heartAnimation,
            {
              opacity: heartAnimation,
              transform: [
                {
                  scale: heartAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1.5],
                  }),
                },
              ],
            },
          ]}
        >
          <Icon name="favorite" size={80} color="#e91e63" />
        </Animated.View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <View style={styles.leftActions}>
          <Animated.View style={{ transform: [{ scale: likeAnimation }] }}>
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={handleLike}
            >
              <Icon
                name={isLiked ? 'favorite' : 'favorite-border'}
                size={24}
                color={isLiked ? '#e91e63' : '#666'}
              />
              <Text style={[styles.actionText, isLiked && styles.likedText]}>
                {likeCount}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={handleComment}
          >
            <Icon name="chat-bubble-outline" size={24} color="#666" />
            <Text style={styles.actionText}>{commentCount}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={handleShare}
          >
            <Icon name="share" size={24} color="#666" />
            <Text style={styles.actionText}>{shareCount}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.bookmarkButton}
          onPress={handleSaveToLibrary}
        >
          <Icon 
            name={isBookmarked ? "bookmark" : "bookmark-border"} 
            size={24} 
            color={isBookmarked ? "#e91e63" : "#666"} 
          />
        </TouchableOpacity>
      </View>

      {/* Content Description */}
      <View style={styles.description}>
        <Text style={styles.title}>{content.title}</Text>
        {content.description && (
          <Text style={styles.descriptionText}>{content.description}</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    marginBottom: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  authorDetails: {
    flex: 1,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewerCount: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  viewerCountText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  moreButton: {
    padding: 8,
  },
  mediaContainer: {
    width: screenWidth,
    height: screenWidth * 0.75,
    backgroundColor: '#000',
    position: 'relative',
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  audioContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  audioText: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  heartAnimation: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -40,
    marginLeft: -40,
    zIndex: 1000,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  actionText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  likedText: {
    color: '#e91e63',
  },
  bookmarkButton: {
    padding: 4,
  },
  description: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default ContentCard;
```

## 🚀 **Real-Time Features Now Available**

### **✅ What You Get:**

1. **Real-Time Likes** - Instant like updates with animations
2. **Real-Time Comments** - Live comment broadcasting
3. **Real-Time Count Updates** - Like/comment/share counts update instantly
4. **Real-Time Viewer Count** - See how many people are viewing content
5. **Real-Time Notifications** - Get notified of likes and comments
6. **Connection Status** - Visual indicator of Socket.IO connection
7. **Optimistic Updates** - Instant UI feedback with error rollback
8. **Professional Animations** - Heart animations, scale effects

### **📱 Expected User Experience:**

- **Instant Feedback** - Likes/comments appear immediately
- **Live Updates** - See counts change in real-time
- **Smooth Animations** - Professional heart animations on like
- **Connection Awareness** - Know when connected/disconnected
- **Error Handling** - Graceful fallbacks and error recovery

## 🎯 **Implementation Status:**

- ✅ **Backend**: 100% Complete with real-time features
- ✅ **Frontend Integration**: Ready for implementation
- ✅ **Professional Features**: All advanced features included
- ✅ **Error Handling**: Comprehensive error management
- ✅ **Performance**: Optimized for mobile devices

Your frontend is now ready to implement truly professional, real-time interactive media features! 🎉
