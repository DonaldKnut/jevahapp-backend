# 🔔 Frontend Notification Consumption Guide

## 🎯 **Overview**

This guide explains how to consume the Jevah App notification system from the frontend, including API endpoints, data structures, and React Native implementation examples. The notification system tracks user interactions and provides real-time updates about important activities.

## 🏗️ **Notification System Architecture**

### **Business Logic Overview**

The notification system automatically creates notifications when users perform actions that affect others:

1. **Content Interactions**: Likes, comments, shares, downloads, bookmarks
2. **Social Actions**: Following users, mentions
3. **Achievements**: Milestones, viral content
4. **System Events**: Security alerts, live streams
5. **Commerce**: Merchandise purchases

### **Notification Types**

```typescript
type NotificationType =
  | "follow" // User followed you
  | "like" // Someone liked your content
  | "comment" // Someone commented on your content
  | "share" // Someone shared your content
  | "mention" // Someone mentioned you
  | "download" // Someone downloaded your content
  | "bookmark" // Someone saved your content
  | "milestone" // Achievement unlocked
  | "public_activity" // Public activity from followed users
  | "system" // System notifications
  | "security" // Security alerts
  | "live_stream" // Live stream notifications
  | "merch_purchase"; // Merchandise purchase
```

## 📡 **API Endpoints**

### **Base URL**: `/api/notifications`

### **1. Get User Notifications**

```http
GET /api/notifications
Authorization: Bearer <token>
```

**Query Parameters:**

- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `type` (string): Filter by notification type
- `unreadOnly` (boolean): Show only unread notifications

**Response:**

```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "user": "507f1f77bcf86cd799439012",
        "title": "New Like",
        "message": "Joseph Eluwa liked your media",
        "isRead": false,
        "type": "like",
        "metadata": {
          "actorName": "Joseph Eluwa",
          "actorAvatar": "https://example.com/avatar.jpg",
          "contentTitle": "The art of seeing Miracles",
          "contentType": "media",
          "thumbnailUrl": "https://example.com/thumb.jpg",
          "likeCount": 42
        },
        "priority": "low",
        "relatedId": "507f1f77bcf86cd799439013",
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "total": 25,
    "unreadCount": 8
  }
}
```

### **2. Mark Notification as Read**

```http
PATCH /api/notifications/:notificationId/read
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "message": "Notification marked as read"
}
```

### **3. Mark All Notifications as Read**

```http
PATCH /api/notifications/mark-all-read
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "message": "Marked 8 notifications as read",
  "count": 8
}
```

### **4. Get Notification Preferences**

```http
GET /api/notifications/preferences
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "pushEnabled": true,
    "emailEnabled": false,
    "types": {
      "follow": true,
      "like": true,
      "comment": true,
      "share": false,
      "download": true,
      "bookmark": false,
      "milestone": true,
      "public_activity": true,
      "system": true,
      "security": true,
      "live_stream": true,
      "merch_purchase": true
    }
  }
}
```

### **5. Update Notification Preferences**

```http
PUT /api/notifications/preferences
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "pushEnabled": true,
  "emailEnabled": false,
  "types": {
    "follow": true,
    "like": true,
    "comment": true,
    "share": false,
    "download": true,
    "bookmark": false,
    "milestone": true,
    "public_activity": true,
    "system": true,
    "security": true,
    "live_stream": true,
    "merch_purchase": true
  }
}
```

### **6. Get Notification Statistics**

```http
GET /api/notifications/stats
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "total": 25,
    "unread": 8,
    "byType": {
      "like": 10,
      "comment": 5,
      "follow": 3,
      "share": 2,
      "download": 3,
      "bookmark": 1,
      "milestone": 1
    }
  }
}
```

## 🎨 **Frontend Implementation**

### **1. Notification Service Class**

```typescript
// services/notificationService.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "./api";

export interface Notification {
  _id: string;
  user: string;
  title: string;
  message: string;
  isRead: boolean;
  type: string;
  metadata: {
    actorName?: string;
    actorAvatar?: string;
    contentTitle?: string;
    contentType?: string;
    thumbnailUrl?: string;
    [key: string]: any;
  };
  priority: "low" | "medium" | "high";
  relatedId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationResponse {
  notifications: Notification[];
  total: number;
  unreadCount: number;
}

export interface NotificationPreferences {
  pushEnabled: boolean;
  emailEnabled: boolean;
  types: {
    [key: string]: boolean;
  };
}

class NotificationService {
  private baseURL: string;

  constructor() {
    this.baseURL = API_BASE_URL || "http://localhost:3000";
  }

  private async getAuthHeaders(): Promise<HeadersInit> {
    try {
      const token = await AsyncStorage.getItem("userToken");
      if (!token) {
        throw new Error("No authentication token found");
      }
      return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };
    } catch (error) {
      console.error("Error getting auth headers:", error);
      return {
        "Content-Type": "application/json",
      };
    }
  }

  async getNotifications(
    page: number = 1,
    limit: number = 20,
    type?: string,
    unreadOnly?: boolean
  ): Promise<NotificationResponse> {
    try {
      const headers = await this.getAuthHeaders();
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(type && { type }),
        ...(unreadOnly && { unreadOnly: "true" }),
      });

      const response = await fetch(
        `${this.baseURL}/api/notifications?${params}`,
        { headers }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error("Error fetching notifications:", error);
      throw error;
    }
  }

  async markAsRead(notificationId: string): Promise<void> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${this.baseURL}/api/notifications/${notificationId}/read`,
        {
          method: "PATCH",
          headers,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
      throw error;
    }
  }

  async markAllAsRead(): Promise<number> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${this.baseURL}/api/notifications/mark-all-read`,
        {
          method: "PATCH",
          headers,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.count;
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      throw error;
    }
  }

  async getPreferences(): Promise<NotificationPreferences> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${this.baseURL}/api/notifications/preferences`,
        { headers }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error("Error fetching notification preferences:", error);
      throw error;
    }
  }

  async updatePreferences(
    preferences: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${this.baseURL}/api/notifications/preferences`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify(preferences),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error("Error updating notification preferences:", error);
      throw error;
    }
  }

  async getStats(): Promise<{
    total: number;
    unread: number;
    byType: { [key: string]: number };
  }> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseURL}/api/notifications/stats`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error("Error fetching notification stats:", error);
      throw error;
    }
  }
}

export const notificationService = new NotificationService();
```

### **2. Updated NotificationsScreen Component**

```typescript
// screens/NotificationsScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AuthHeader from '../components/AuthHeader';
import { SafeImage } from '../components/SafeImage';
import { notificationService, Notification } from '../services/notificationService';

interface NotificationSection {
  category: string;
  items: Notification[];
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await notificationService.getNotifications(1, 50);
      setNotifications(response.notifications);
      setUnreadCount(response.unreadCount);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  }, [loadNotifications]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications(prev =>
        prev.map(notif =>
          notif._id === notificationId ? { ...notif, isRead: true } : notif
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const count = await notificationService.markAllAsRead();
      setNotifications(prev =>
        prev.map(notif => ({ ...notif, isRead: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const groupNotificationsByTime = (notifications: Notification[]): NotificationSection[] => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const newNotifications = notifications.filter(
      notif => new Date(notif.createdAt) > oneDayAgo
    );
    const weekNotifications = notifications.filter(
      notif => new Date(notif.createdAt) > oneWeekAgo && new Date(notif.createdAt) <= oneDayAgo
    );
    const monthNotifications = notifications.filter(
      notif => new Date(notif.createdAt) > oneMonthAgo && new Date(notif.createdAt) <= oneWeekAgo
    );

    const sections: NotificationSection[] = [];

    if (newNotifications.length > 0) {
      sections.push({ category: 'New', items: newNotifications });
    }
    if (weekNotifications.length > 0) {
      sections.push({ category: 'Last 7 days', items: weekNotifications });
    }
    if (monthNotifications.length > 0) {
      sections.push({ category: 'Last 30 days', items: monthNotifications });
    }

    return sections;
  };

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${diffInHours}HRS AGO`;
    } else if (diffInDays < 7) {
      return `${diffInDays} DAYS AGO`;
    } else {
      return `${Math.floor(diffInDays / 7)} WEEKS AGO`;
    }
  };

  const getNotificationIcon = (type: string): string => {
    const icons = {
      like: '❤️',
      comment: '💬',
      follow: '👥',
      share: '📤',
      download: '⬇️',
      bookmark: '🔖',
      milestone: '🎉',
      public_activity: '📢',
      system: '⚙️',
      security: '🔒',
      live_stream: '📺',
      merch_purchase: '🛒',
    };
    return icons[type] || '🔔';
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="px-4">
          <AuthHeader title="Notifications" />
        </View>
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#256E63" />
          <Text className="mt-4 text-gray-600">Loading notifications...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const groupedNotifications = groupNotificationsByTime(notifications);

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="px-4">
        <AuthHeader title="Notifications" />
        {unreadCount > 0 && (
          <TouchableOpacity
            onPress={markAllAsRead}
            className="bg-[#256E63] px-4 py-2 rounded-lg self-end mt-2"
          >
            <Text className="text-white font-semibold text-sm">
              Mark all as read ({unreadCount})
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Scrollable Body */}
      <ScrollView
        className="px-7 bg-[#F3F3F4]"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {groupedNotifications.length === 0 ? (
          <View className="flex-1 justify-center items-center py-20">
            <Text className="text-6xl mb-4">🔔</Text>
            <Text className="text-xl font-semibold text-gray-800 mb-2">
              No notifications yet
            </Text>
            <Text className="text-gray-600 text-center">
              When people interact with your content, you'll see notifications here.
            </Text>
          </View>
        ) : (
          groupedNotifications.map((section, idx) => (
            <View key={idx} className="mt-5">
              <Text className="text-[#1D2939] font-rubik-semibold mb-2">
                {section.category}
              </Text>
              {section.items.map((item, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => !item.isRead && markAsRead(item._id)}
                  className={`bg-white rounded-[10px] shadow-sm p-3 h-[215px] mb-4 ${
                    !item.isRead ? 'border-l-4 border-[#256E63]' : ''
                  }`}
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-[#475467] mb-1 font-medium">
                      {getNotificationIcon(item.type)} {item.title}
                    </Text>
                    {!item.isRead && (
                      <View className="w-2 h-2 bg-[#256E63] rounded-full" />
                    )}
                  </View>

                  <View className="flex-row items-center mb-2">
                    <SafeImage
                      uri={item.metadata?.actorAvatar}
                      className="w-6 h-6 rounded-full mr-2"
                      fallbackText={item.metadata?.actorName?.[0]?.toUpperCase() || 'U'}
                      showFallback={true}
                    />
                    <Text className="font-rubik-semibold text-[#667085] text-[12px]">
                      {item.metadata?.actorName || 'Someone'}
                    </Text>
                    <View className="flex-row items-center ml-3">
                      <Text className="text-[#FFD9B3] text-[18px] text-xs font-rubik">
                        •
                      </Text>
                      <Text className="text-xs text-[#667085] font-rubik ml-1">
                        {formatTimeAgo(item.createdAt)}
                      </Text>
                    </View>
                  </View>

                  <Text className="mb-2 ml-8 text-[#1D2939] font-rubik">
                    {item.message}
                  </Text>

                  <TouchableOpacity>
                    <Text className="text-[#256E63] font-bold text-xs ml-8">
                      REPLY
                    </Text>
                  </TouchableOpacity>

                  {item.metadata?.thumbnailUrl && (
                    <View className="mt-3 flex-row items-start space-x-3 bg-[#F3F3F4] rounded-md p-3">
                      <Image
                        source={{ uri: item.metadata.thumbnailUrl }}
                        className="w-14 h-14 rounded-md"
                      />
                      <View className="flex-1 ml-3">
                        <Text className="font-rubik-semibold text-[#1D2939]">
                          {item.metadata.contentTitle || 'Content'}
                        </Text>
                        <Text
                          className="text-[#667085] font-rubik text-sm"
                          numberOfLines={2}
                          ellipsizeMode="tail"
                        >
                          {item.metadata.contentType || 'media'}
                        </Text>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
```

### **3. Notification Badge Component**

```typescript
// components/NotificationBadge.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { notificationService } from '../services/notificationService';

interface NotificationBadgeProps {
  onPress?: () => void;
  size?: 'small' | 'medium' | 'large';
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  onPress,
  size = 'medium',
}) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUnreadCount();
  }, []);

  const loadUnreadCount = async () => {
    try {
      const stats = await notificationService.getStats();
      setUnreadCount(stats.unread);
    } catch (error) {
      console.error('Error loading notification count:', error);
    } finally {
      setLoading(false);
    }
  };

  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-6 h-6',
    large: 'w-8 h-8',
  };

  const textSizeClasses = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base',
  };

  if (loading) {
    return null;
  }

  if (unreadCount === 0) {
    return null;
  }

  return (
    <TouchableOpacity onPress={onPress} className="relative">
      <View className={`${sizeClasses[size]} bg-red-500 rounded-full justify-center items-center`}>
        <Text className={`${textSizeClasses[size]} text-white font-bold`}>
          {unreadCount > 99 ? '99+' : unreadCount}
        </Text>
      </View>
    </TouchableOpacity>
  );
};
```

### **4. Real-time Updates with Socket.IO**

```typescript
// hooks/useNotifications.ts
import { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import {
  notificationService,
  Notification,
} from "../services/notificationService";

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io(API_BASE_URL, {
      auth: {
        token: AsyncStorage.getItem("userToken"),
      },
    });

    newSocket.on("new_notification", (notification: Notification) => {
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
    });

    newSocket.on("notification_read", (notificationId: string) => {
      setNotifications(prev =>
        prev.map(notif =>
          notif._id === notificationId ? { ...notif, isRead: true } : notif
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const markAsRead = async (notificationId: string) => {
    try {
      await notificationService.markAsRead(notificationId);
      socket?.emit("mark_notification_read", notificationId);
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  return {
    notifications,
    unreadCount,
    markAsRead,
  };
};
```

## 🎯 **Key Features**

### **1. Automatic Notification Creation**

- **Likes**: When someone likes your content
- **Comments**: When someone comments on your content
- **Follows**: When someone follows you
- **Shares**: When someone shares your content
- **Downloads**: When someone downloads your content
- **Bookmarks**: When someone saves your content
- **Mentions**: When someone mentions you
- **Milestones**: When you achieve milestones
- **Public Activity**: When followed users perform public actions

### **2. Smart Grouping**

- **New**: Last 24 hours
- **Last 7 days**: 2-7 days ago
- **Last 30 days**: 8-30 days ago

### **3. Rich Metadata**

- Actor information (name, avatar)
- Content details (title, thumbnail, type)
- Interaction counts
- Related content IDs

### **4. Priority Levels**

- **High**: Milestones, security alerts, purchases
- **Medium**: Follows, downloads
- **Low**: Likes, comments, bookmarks

## 🔧 **Implementation Checklist**

- [ ] Set up notification service class
- [ ] Update NotificationsScreen to use real data
- [ ] Implement notification badge component
- [ ] Add real-time updates with Socket.IO
- [ ] Handle notification preferences
- [ ] Add pull-to-refresh functionality
- [ ] Implement mark as read functionality
- [ ] Add notification statistics
- [ ] Test all notification types
- [ ] Add error handling and loading states

## 📱 **Testing**

### **Test Notification Creation**

```typescript
// Test like notification
await contentInteractionAPI.toggleLike("contentId", "media");

// Test follow notification
await userService.followUser("userId");

// Test comment notification
await contentInteractionAPI.addComment("contentId", "Great content!", "media");
```

### **Test Notification Retrieval**

```typescript
// Get all notifications
const notifications = await notificationService.getNotifications();

// Get unread notifications only
const unread = await notificationService.getNotifications(
  1,
  20,
  undefined,
  true
);

// Get specific type
const likes = await notificationService.getNotifications(1, 20, "like");
```

## 🚨 **Error Handling**

The service includes comprehensive error handling for:

- Network failures
- Authentication errors
- Invalid responses
- Rate limiting
- Server errors

## 📊 **Analytics Integration**

Track notification engagement:

- Open rates
- Read rates
- Time to read
- Notification type preferences
- User interaction patterns

This comprehensive guide provides everything needed to integrate the notification system into your React Native frontend! 🚀
