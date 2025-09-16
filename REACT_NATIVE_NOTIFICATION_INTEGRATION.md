# React Native Notification Integration Guide

## Overview

This guide provides React Native-specific implementation for integrating the notification system with your existing UI. It shows how to replace hardcoded data with real API calls while maintaining your exact UI structure.

## Table of Contents

1. [Setup & Dependencies](#setup--dependencies)
2. [API Service Layer](#api-service-layer)
3. [Notification Types & Interfaces](#notification-types--interfaces)
4. [Updated NotificationsScreen Component](#updated-notificationsscreen-component)
5. [Push Notification Setup](#push-notification-setup)
6. [Notification Preferences Screen](#notification-preferences-screen)
7. [Real-time Updates](#real-time-updates)
8. [Error Handling & Loading States](#error-handling--loading-states)
9. [Testing & Debugging](#testing--debugging)

## Setup & Dependencies

### Required Packages

```bash
npm install expo-notifications expo-device expo-constants
```

### Environment Configuration

```typescript
// config/api.ts
export const API_BASE_URL = __DEV__
  ? "http://localhost:3000/api"
  : "https://your-production-api.com/api";

export const API_ENDPOINTS = {
  notifications: "/notifications",
  pushNotifications: "/push-notifications",
  register: "/push-notifications/register",
  preferences: "/push-notifications/preferences",
  enabled: "/push-notifications/enabled",
  test: "/push-notifications/test",
} as const;
```

## API Service Layer

### Notification API Service

```typescript
// services/notificationService.ts
import { API_BASE_URL, API_ENDPOINTS } from "../config/api";

export interface NotificationItem {
  _id: string;
  user: {
    _id: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
    email: string;
  };
  title: string;
  message: string;
  isRead: boolean;
  type:
    | "follow"
    | "like"
    | "comment"
    | "download"
    | "bookmark"
    | "merch_purchase"
    | "milestone"
    | "system";
  relatedId?: string;
  metadata?: {
    actorName?: string;
    actorAvatar?: string;
    contentTitle?: string;
    contentType?: string;
    thumbnailUrl?: string;
    commentText?: string;
    likeCount?: number;
    commentCount?: number;
    downloadCount?: number;
    bookmarkCount?: number;
    merchName?: string;
    merchPrice?: number;
    merchImage?: string;
    milestone?: string;
    count?: number;
  };
  createdAt: string;
}

export interface NotificationResponse {
  success: boolean;
  notifications: NotificationItem[];
}

export interface NotificationStats {
  success: boolean;
  data: {
    totalUsers: number;
    usersWithPushEnabled: number;
    totalDeviceTokens: number;
    usersWithTokens: number;
  };
}

class NotificationService {
  private baseURL = API_BASE_URL;
  private token: string | null = null;

  setAuthToken(token: string) {
    this.token = token;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Get user notifications
  async getNotifications(): Promise<NotificationItem[]> {
    const response = await this.makeRequest<NotificationResponse>(
      API_ENDPOINTS.notifications
    );
    return response.notifications;
  }

  // Mark notification as read
  async markAsRead(notificationId: string): Promise<void> {
    await this.makeRequest(`${API_ENDPOINTS.notifications}/${notificationId}`, {
      method: "PATCH",
    });
  }

  // Mark all notifications as read
  async markAllAsRead(): Promise<void> {
    await this.makeRequest(`${API_ENDPOINTS.notifications}/mark-all-read`, {
      method: "PATCH",
    });
  }

  // Register device token for push notifications
  async registerDeviceToken(deviceToken: string): Promise<void> {
    await this.makeRequest(API_ENDPOINTS.register, {
      method: "POST",
      body: JSON.stringify({ deviceToken }),
    });
  }

  // Update notification preferences
  async updatePreferences(preferences: Record<string, boolean>): Promise<void> {
    await this.makeRequest(API_ENDPOINTS.preferences, {
      method: "PUT",
      body: JSON.stringify(preferences),
    });
  }

  // Enable/disable push notifications
  async setEnabled(enabled: boolean): Promise<void> {
    await this.makeRequest(API_ENDPOINTS.enabled, {
      method: "PUT",
      body: JSON.stringify({ enabled }),
    });
  }

  // Send test notification
  async sendTestNotification(title?: string, body?: string): Promise<void> {
    await this.makeRequest(API_ENDPOINTS.test, {
      method: "POST",
      body: JSON.stringify({ title, body }),
    });
  }

  // Get push notification stats (admin)
  async getStats(): Promise<NotificationStats["data"]> {
    const response = await this.makeRequest<NotificationStats>(
      `${API_ENDPOINTS.pushNotifications}/stats`
    );
    return response.data;
  }
}

export const notificationService = new NotificationService();
```

## Notification Types & Interfaces

### UI-Compatible Notification Interface

```typescript
// types/notification.ts
export interface UINotificationItem {
  id: string;
  name: string;
  time: string;
  message: string;
  postTitle: string;
  postDescription: string;
  avatar?: string;
  postImage?: string;
  isRead: boolean;
  type: string;
  relatedId?: string;
  metadata?: any;
}

export interface NotificationSection {
  category: string;
  items: UINotificationItem[];
}

export interface NotificationPreferences {
  newFollowers: boolean;
  mediaLikes: boolean;
  mediaComments: boolean;
  mediaShares: boolean;
  merchPurchases: boolean;
  songDownloads: boolean;
  subscriptionUpdates: boolean;
  securityAlerts: boolean;
  liveStreams: boolean;
  newMessages: boolean;
}
```

### Notification Transformer

```typescript
// utils/notificationTransformer.ts
import { NotificationItem } from "../services/notificationService";
import { UINotificationItem, NotificationSection } from "../types/notification";

export const transformNotificationToUI = (
  notification: NotificationItem
): UINotificationItem => {
  const timeAgo = getTimeAgo(new Date(notification.createdAt));

  return {
    id: notification._id,
    name:
      notification.metadata?.actorName ||
      `${notification.user.firstName || ""} ${notification.user.lastName || ""}`.trim() ||
      notification.user.email,
    time: timeAgo,
    message: notification.message,
    postTitle: notification.metadata?.contentTitle || notification.title,
    postDescription: getPostDescription(notification),
    avatar: notification.metadata?.actorAvatar || notification.user.avatar,
    postImage: notification.metadata?.thumbnailUrl,
    isRead: notification.isRead,
    type: notification.type,
    relatedId: notification.relatedId,
    metadata: notification.metadata,
  };
};

export const groupNotificationsByTime = (
  notifications: UINotificationItem[]
): NotificationSection[] => {
  const now = new Date();
  const newNotifications: UINotificationItem[] = [];
  const last7Days: UINotificationItem[] = [];
  const last30Days: UINotificationItem[] = [];

  notifications.forEach(notification => {
    const notificationDate = new Date(notification.createdAt || now);
    const hoursDiff =
      (now.getTime() - notificationDate.getTime()) / (1000 * 60 * 60);
    const daysDiff = hoursDiff / 24;

    if (hoursDiff <= 24) {
      newNotifications.push(notification);
    } else if (daysDiff <= 7) {
      last7Days.push(notification);
    } else if (daysDiff <= 30) {
      last30Days.push(notification);
    }
  });

  const sections: NotificationSection[] = [];

  if (newNotifications.length > 0) {
    sections.push({ category: "New", items: newNotifications });
  }
  if (last7Days.length > 0) {
    sections.push({ category: "Last 7 days", items: last7Days });
  }
  if (last30Days.length > 0) {
    sections.push({ category: "Last 30 days", items: last30Days });
  }

  return sections;
};

const getTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInHours < 1) {
    const minutes = Math.floor(diffInMs / (1000 * 60));
    return `${minutes}MINS AGO`;
  } else if (diffInHours < 24) {
    return `${diffInHours}HRS AGO`;
  } else if (diffInDays < 7) {
    return `${diffInDays} DAYS AGO`;
  } else {
    return `${Math.floor(diffInDays / 7)} WEEKS AGO`;
  }
};

const getPostDescription = (notification: NotificationItem): string => {
  // Default descriptions based on notification type
  const defaultDescriptions: Record<string, string> = {
    follow: "Started following you",
    like: "Liked your content",
    comment: "Commented on your content",
    download: "Downloaded your content",
    bookmark: "Saved your content to their library",
    merch_purchase: "Purchased your merchandise",
    milestone: "Achievement unlocked!",
    system: "System notification",
  };

  return (
    notification.metadata?.contentDescription ||
    defaultDescriptions[notification.type] ||
    "New activity on your content"
  );
};
```

## Updated NotificationsScreen Component

```typescript
// screens/NotificationsScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AuthHeader from '../components/AuthHeader';
import { SafeImage } from '../components/SafeImage';
import { notificationService } from '../services/notificationService';
import { transformNotificationToUI, groupNotificationsByTime } from '../utils/notificationTransformer';
import { NotificationSection, UINotificationItem } from '../types/notification';

export default function NotificationsScreen() {
  const [notificationsData, setNotificationsData] = useState<NotificationSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load notifications from API
  const loadNotifications = useCallback(async () => {
    try {
      setError(null);
      const notifications = await notificationService.getNotifications();

      // Transform API data to UI format
      const uiNotifications = notifications.map(transformNotificationToUI);

      // Group by time periods
      const groupedNotifications = groupNotificationsByTime(uiNotifications);

      setNotificationsData(groupedNotifications);
    } catch (err) {
      console.error('Failed to load notifications:', err);
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Handle notification tap
  const handleNotificationPress = async (notification: UINotificationItem) => {
    try {
      // Mark as read if not already read
      if (!notification.isRead) {
        await notificationService.markAsRead(notification.id);

        // Update local state
        setNotificationsData(prev =>
          prev.map(section => ({
            ...section,
            items: section.items.map(item =>
              item.id === notification.id
                ? { ...item, isRead: true }
                : item
            )
          }))
        );
      }

      // Navigate to related content if applicable
      if (notification.relatedId) {
        // Navigate to the related content
        // navigation.navigate('ContentDetail', { id: notification.relatedId });
        console.log('Navigate to content:', notification.relatedId);
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
      Alert.alert('Error', 'Failed to update notification');
    }
  };

  // Handle reply button press
  const handleReply = (notification: UINotificationItem) => {
    // Implement reply functionality
    console.log('Reply to notification:', notification.id);
    // navigation.navigate('Reply', { notification });
  };

  // Handle refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadNotifications();
  }, [loadNotifications]);

  // Load notifications on component mount
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Render loading state
  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="px-4">
          <AuthHeader title="Notifications" />
        </View>
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#256E63" />
          <Text className="mt-4 text-[#667085]">Loading notifications...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Render error state
  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="px-4">
          <AuthHeader title="Notifications" />
        </View>
        <View className="flex-1 justify-center items-center px-7">
          <Text className="text-[#667085] text-center mb-4">{error}</Text>
          <TouchableOpacity
            onPress={loadNotifications}
            className="bg-[#256E63] px-6 py-3 rounded-lg"
          >
            <Text className="text-white font-semibold">Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="px-4">
        <AuthHeader title="Notifications" />
      </View>

      {/* Scrollable Body */}
      <ScrollView
        className="px-7 bg-[#F3F3F4]"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#256E63']}
            tintColor="#256E63"
          />
        }
      >
        {notificationsData.length === 0 ? (
          <View className="flex-1 justify-center items-center py-20">
            <Text className="text-[#667085] text-center">
              No notifications yet
            </Text>
            <Text className="text-[#667085] text-center mt-2">
              You'll see notifications here when people interact with your content
            </Text>
          </View>
        ) : (
          notificationsData.map((section, idx) => (
            <View key={idx} className="mt-5">
              <Text className="text-[#1D2939] font-rubik-semibold mb-2">
                {section.category}
              </Text>
              {section.items.map((item, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => handleNotificationPress(item)}
                  className={`bg-white rounded-[10px] shadow-sm p-3 h-[215px] mb-4 ${
                    !item.isRead ? 'border-l-4 border-[#256E63]' : ''
                  }`}
                >
                  <Text className="text-[#475467] mb-1 font-medium">
                    Activity:
                  </Text>

                  <View className="flex-row items-center mb-2">
                    <SafeImage
                      uri={item.avatar}
                      className="w-6 h-6 rounded-full mr-2"
                      fallbackText={item.name?.[0]?.toUpperCase() || 'U'}
                      showFallback={true}
                    />
                    <Text className="font-rubik-semibold text-[#667085] text-[12px]">
                      {item.name}
                    </Text>
                    <View className="flex-row items-center ml-3">
                      <Text className="text-[#FFD9B3] text-[18px] text-xs font-rubik">
                        •
                      </Text>
                      <Text className="text-xs text-[#667085] font-rubik ml-1">
                        {item.time}
                      </Text>
                    </View>
                  </View>

                  <Text className="mb-2 ml-8 text-[#1D2939] font-rubik">
                    {item.message}
                  </Text>

                  <TouchableOpacity onPress={() => handleReply(item)}>
                    <Text className="text-[#256E63] font-bold text-xs ml-8">
                      REPLY
                    </Text>
                  </TouchableOpacity>

                  <View className="mt-3 flex-row items-start space-x-3 bg-[#F3F3F4] rounded-md p-3">
                    {item.postImage ? (
                      <Image
                        source={{ uri: item.postImage }}
                        className="w-14 h-14 rounded-md"
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="w-14 h-14 rounded-md bg-[#E5E7EB] justify-center items-center">
                        <Text className="text-[#667085] text-xs">No Image</Text>
                      </View>
                    )}
                    <View className="flex-1 ml-3">
                      <Text className="font-rubik-semibold text-[#1D2939]">
                        {item.postTitle}
                      </Text>
                      <Text
                        className="text-[#667085] font-rubik text-sm"
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        {item.postDescription}
                      </Text>
                    </View>
                  </View>
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

## Push Notification Setup

### Expo Push Notification Configuration

```typescript
// services/pushNotificationService.ts
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { notificationService } from "./notificationService";

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export class PushNotificationService {
  // Register for push notifications
  static async registerForPushNotifications(): Promise<string | null> {
    let token: string | null = null;

    if (Device.isDevice) {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.log("Failed to get push token for push notification!");
        return null;
      }

      try {
        token = (await Notifications.getExpoPushTokenAsync()).data;
        console.log("Push token:", token);
      } catch (error) {
        console.error("Error getting push token:", error);
        return null;
      }
    } else {
      console.log("Must use physical device for Push Notifications");
    }

    return token;
  }

  // Send token to backend
  static async sendTokenToBackend(token: string): Promise<boolean> {
    try {
      await notificationService.registerDeviceToken(token);
      return true;
    } catch (error) {
      console.error("Failed to send token to backend:", error);
      return false;
    }
  }

  // Setup notification listeners
  static setupNotificationListeners() {
    // Handle notification received while app is foregrounded
    const notificationListener = Notifications.addNotificationReceivedListener(
      notification => {
        console.log("Notification received:", notification);
        // You can show a custom in-app notification here
      }
    );

    // Handle notification tap
    const responseListener =
      Notifications.addNotificationResponseReceivedListener(response => {
        console.log("Notification tapped:", response);
        const data = response.notification.request.content.data;

        // Navigate to relevant screen based on notification data
        if (data?.type && data?.relatedId) {
          // navigation.navigate('ContentDetail', { id: data.relatedId });
        }
      });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener);
      Notifications.removeNotificationSubscription(responseListener);
    };
  }

  // Initialize push notifications
  static async initialize(): Promise<void> {
    const token = await this.registerForPushNotifications();

    if (token) {
      await this.sendTokenToBackend(token);
    }

    this.setupNotificationListeners();
  }
}
```

### App.tsx Integration

```typescript
// App.tsx
import React, { useEffect } from "react";
import { PushNotificationService } from "./services/pushNotificationService";

export default function App() {
  useEffect(() => {
    // Initialize push notifications when app starts
    PushNotificationService.initialize();
  }, []);

  // ... rest of your app
}
```

## Notification Preferences Screen

```typescript
// screens/NotificationPreferencesScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Switch,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AuthHeader from '../components/AuthHeader';
import { notificationService } from '../services/notificationService';
import { NotificationPreferences } from '../types/notification';

const preferenceLabels: Record<keyof NotificationPreferences, string> = {
  newFollowers: 'New Followers',
  mediaLikes: 'Media Likes',
  mediaComments: 'Media Comments',
  mediaShares: 'Media Shares',
  merchPurchases: 'Merchandise Purchases',
  songDownloads: 'Song Downloads',
  subscriptionUpdates: 'Subscription Updates',
  securityAlerts: 'Security Alerts',
  liveStreams: 'Live Streams',
  newMessages: 'New Messages',
};

export default function NotificationPreferencesScreen() {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    newFollowers: true,
    mediaLikes: true,
    mediaComments: true,
    mediaShares: true,
    merchPurchases: true,
    songDownloads: true,
    subscriptionUpdates: true,
    securityAlerts: true,
    liveStreams: true,
    newMessages: true,
  });
  const [pushEnabled, setPushEnabled] = useState(true);
  const [loading, setLoading] = useState(false);

  const updatePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    try {
      setLoading(true);
      const newPreferences = { ...preferences, [key]: value };
      await notificationService.updatePreferences(newPreferences);
      setPreferences(newPreferences);
    } catch (error) {
      console.error('Failed to update preference:', error);
      Alert.alert('Error', 'Failed to update notification preference');
    } finally {
      setLoading(false);
    }
  };

  const togglePushNotifications = async (enabled: boolean) => {
    try {
      setLoading(true);
      await notificationService.setEnabled(enabled);
      setPushEnabled(enabled);
    } catch (error) {
      console.error('Failed to toggle push notifications:', error);
      Alert.alert('Error', 'Failed to update push notification settings');
    } finally {
      setLoading(false);
    }
  };

  const sendTestNotification = async () => {
    try {
      setLoading(true);
      await notificationService.sendTestNotification(
        'Test Notification',
        'This is a test notification from Jevah App'
      );
      Alert.alert('Success', 'Test notification sent!');
    } catch (error) {
      console.error('Failed to send test notification:', error);
      Alert.alert('Error', 'Failed to send test notification');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-4">
        <AuthHeader title="Notification Settings" />
      </View>

      <ScrollView className="px-7 bg-[#F3F3F4]">
        {/* Push Notifications Toggle */}
        <View className="bg-white rounded-[10px] p-4 mb-4 mt-5">
          <View className="flex-row justify-between items-center">
            <View className="flex-1">
              <Text className="font-rubik-semibold text-[#1D2939] text-lg">
                Push Notifications
              </Text>
              <Text className="text-[#667085] text-sm mt-1">
                Receive notifications on your device
              </Text>
            </View>
            <Switch
              value={pushEnabled}
              onValueChange={togglePushNotifications}
              disabled={loading}
              trackColor={{ false: '#E5E7EB', true: '#256E63' }}
              thumbColor={pushEnabled ? '#FFFFFF' : '#FFFFFF'}
            />
          </View>
        </View>

        {/* Notification Types */}
        <View className="bg-white rounded-[10px] p-4 mb-4">
          <Text className="font-rubik-semibold text-[#1D2939] text-lg mb-4">
            Notification Types
          </Text>

          {Object.entries(preferenceLabels).map(([key, label]) => (
            <View key={key} className="flex-row justify-between items-center py-3 border-b border-[#F3F3F4] last:border-b-0">
              <Text className="text-[#1D2939] font-rubik flex-1">
                {label}
              </Text>
              <Switch
                value={preferences[key as keyof NotificationPreferences]}
                onValueChange={(value) => updatePreference(key as keyof NotificationPreferences, value)}
                disabled={loading || !pushEnabled}
                trackColor={{ false: '#E5E7EB', true: '#256E63' }}
                thumbColor={preferences[key as keyof NotificationPreferences] ? '#FFFFFF' : '#FFFFFF'}
              />
            </View>
          ))}
        </View>

        {/* Test Notification */}
        <TouchableOpacity
          onPress={sendTestNotification}
          disabled={loading || !pushEnabled}
          className={`bg-[#256E63] rounded-[10px] p-4 mb-4 ${
            loading || !pushEnabled ? 'opacity-50' : ''
          }`}
        >
          <Text className="text-white font-rubik-semibold text-center">
            Send Test Notification
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
```

## Real-time Updates

### Socket.io Integration (Optional)

```typescript
// services/socketService.ts
import { io } from "socket.io-client";
import { API_BASE_URL } from "../config/api";

class SocketService {
  private socket: any = null;
  private token: string | null = null;

  connect(token: string) {
    this.token = token;
    this.socket = io(API_BASE_URL, {
      auth: { token },
    });

    this.socket.on("connect", () => {
      console.log("Connected to notification socket");
    });

    this.socket.on("new_notification", (notification: any) => {
      console.log("New notification received:", notification);
      // Emit event to update UI
      // EventEmitter.emit('newNotification', notification);
    });

    this.socket.on("disconnect", () => {
      console.log("Disconnected from notification socket");
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService();
```

## Error Handling & Loading States

### Error Boundary Component

```typescript
// components/NotificationErrorBoundary.tsx
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface Props {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class NotificationErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Notification error:', error, errorInfo);
  }

  retry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return <FallbackComponent error={this.state.error!} retry={this.retry} />;
    }

    return this.props.children;
  }
}

const DefaultErrorFallback: React.FC<{ error: Error; retry: () => void }> = ({ error, retry }) => (
  <View className="flex-1 justify-center items-center p-7">
    <Text className="text-[#667085] text-center mb-4">
      Something went wrong with notifications
    </Text>
    <Text className="text-[#667085] text-center mb-6 text-sm">
      {error.message}
    </Text>
    <TouchableOpacity
      onPress={retry}
      className="bg-[#256E63] px-6 py-3 rounded-lg"
    >
      <Text className="text-white font-semibold">Retry</Text>
    </TouchableOpacity>
  </View>
);
```

## Testing & Debugging

### Test Notification Function

```typescript
// utils/testNotifications.ts
import { notificationService } from "../services/notificationService";

export const testNotificationFlow = async () => {
  try {
    console.log("Testing notification flow...");

    // Test getting notifications
    const notifications = await notificationService.getNotifications();
    console.log("Notifications loaded:", notifications.length);

    // Test marking as read
    if (notifications.length > 0) {
      await notificationService.markAsRead(notifications[0]._id);
      console.log("Notification marked as read");
    }

    // Test preferences
    await notificationService.updatePreferences({
      newFollowers: true,
      mediaLikes: false,
    });
    console.log("Preferences updated");

    // Test push notification
    await notificationService.sendTestNotification(
      "Test",
      "This is a test notification"
    );
    console.log("Test notification sent");

    console.log("All tests passed!");
  } catch (error) {
    console.error("Test failed:", error);
  }
};
```

### Debug Component

```typescript
// components/NotificationDebug.tsx
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { testNotificationFlow } from '../utils/testNotifications';

export const NotificationDebug: React.FC = () => {
  if (!__DEV__) return null;

  return (
    <View className="bg-yellow-100 p-4 m-4 rounded-lg">
      <Text className="font-bold mb-2">Debug Tools</Text>
      <TouchableOpacity
        onPress={testNotificationFlow}
        className="bg-blue-500 px-4 py-2 rounded mb-2"
      >
        <Text className="text-white">Test Notifications</Text>
      </TouchableOpacity>
    </View>
  );
};
```

## Usage Summary

1. **Setup**: Install dependencies and configure API endpoints
2. **Service Layer**: Use `notificationService` for all API calls
3. **UI Integration**: Replace hardcoded data with API calls in `NotificationsScreen`
4. **Push Notifications**: Initialize push notifications in `App.tsx`
5. **Preferences**: Implement notification preferences screen
6. **Error Handling**: Wrap components with error boundaries
7. **Testing**: Use debug tools to test the flow

This implementation maintains your exact UI structure while replacing hardcoded data with real API integration, proper error handling, and loading states.
