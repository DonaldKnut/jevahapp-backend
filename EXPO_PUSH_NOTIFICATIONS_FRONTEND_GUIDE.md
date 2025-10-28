# 📱 Expo Push Notifications - Frontend Implementation Guide

## 🎯 **Overview**

This guide shows you how to implement Expo Push Notifications in your React Native app using Expo Go.

## 📦 **Required Dependencies**

Add these to your React Native project:

```bash
# Core Expo dependencies
npx expo install expo-notifications expo-device expo-constants

# For storing tokens
npm install @react-native-async-storage/async-storage

# For HTTP requests
npm install axios
```

## 🔧 **1. App Configuration**

### **app.json/app.config.js**

```json
{
  "expo": {
    "name": "Jevah App",
    "slug": "jevah-app",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "assetBundlePatterns": ["**/*"],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.jevah.app"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#FFFFFF"
      },
      "package": "com.jevah.app",
      "permissions": [
        "android.permission.RECEIVE_BOOT_COMPLETED",
        "android.permission.VIBRATE"
      ]
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#ffffff",
          "defaultChannel": "default"
        }
      ]
    ],
    "notification": {
      "icon": "./assets/notification-icon.png",
      "color": "#ffffff",
      "androidMode": "default",
      "androidCollapsedTitle": "#{unread_notifications} new interactions"
    }
  }
}
```

## 🚀 **2. Push Notification Service**

### **services/PushNotificationService.ts**

```typescript
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

export interface PushNotificationPreferences {
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

export interface NotificationData {
  notificationId: string;
  type: string;
  title: string;
  body: string;
  data?: any;
}

class PushNotificationService {
  private baseURL = "https://jevahapp-backend.onrender.com";
  private token: string | null = null;
  private expoPushToken: string | null = null;

  constructor() {
    this.setupNotificationHandlers();
  }

  /**
   * Initialize push notifications
   */
  async initialize(authToken: string): Promise<boolean> {
    try {
      this.token = authToken;

      // Request permissions
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.log("Push notification permission denied");
        return false;
      }

      // Get push token
      if (Device.isDevice) {
        const token = await Notifications.getExpoPushTokenAsync({
          projectId: Constants.expoConfig?.extra?.eas?.projectId,
        });
        this.expoPushToken = token.data;

        // Register token with backend
        await this.registerDeviceToken();
      } else {
        console.log("Must use physical device for Push Notifications");
        return false;
      }

      return true;
    } catch (error) {
      console.error("Failed to initialize push notifications:", error);
      return false;
    }
  }

  /**
   * Setup notification handlers
   */
  private setupNotificationHandlers(): void {
    // Handle notifications received while app is running
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    // Handle notification tap
    Notifications.addNotificationResponseReceivedListener(response => {
      this.handleNotificationTap(response.notification);
    });

    // Handle notification received while app is in foreground
    Notifications.addNotificationReceivedListener(notification => {
      this.handleNotificationReceived(notification);
    });
  }

  /**
   * Register device token with backend
   */
  private async registerDeviceToken(): Promise<boolean> {
    try {
      if (!this.expoPushToken || !this.token) return false;

      const response = await axios.post(
        `${this.baseURL}/api/push-notifications/register`,
        { deviceToken: this.expoPushToken },
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.success) {
        console.log("Device token registered successfully");
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to register device token:", error);
      return false;
    }
  }

  /**
   * Unregister device token
   */
  async unregisterDeviceToken(): Promise<boolean> {
    try {
      if (!this.expoPushToken || !this.token) return false;

      const response = await axios.post(
        `${this.baseURL}/api/push-notifications/unregister`,
        { deviceToken: this.expoPushToken },
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.success) {
        console.log("Device token unregistered successfully");
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to unregister device token:", error);
      return false;
    }
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(
    preferences: Partial<PushNotificationPreferences>
  ): Promise<boolean> {
    try {
      if (!this.token) return false;

      const response = await axios.put(
        `${this.baseURL}/api/push-notifications/preferences`,
        preferences,
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.success) {
        // Store preferences locally
        await AsyncStorage.setItem(
          "pushPreferences",
          JSON.stringify(preferences)
        );
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to update preferences:", error);
      return false;
    }
  }

  /**
   * Enable/disable push notifications
   */
  async setEnabled(enabled: boolean): Promise<boolean> {
    try {
      if (!this.token) return false;

      const response = await axios.put(
        `${this.baseURL}/api/push-notifications/enabled`,
        { enabled },
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.success) {
        await AsyncStorage.setItem(
          "pushNotificationsEnabled",
          enabled.toString()
        );
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to set push notification status:", error);
      return false;
    }
  }

  /**
   * Send test notification
   */
  async sendTestNotification(): Promise<boolean> {
    try {
      if (!this.token) return false;

      const response = await axios.post(
        `${this.baseURL}/api/push-notifications/test`,
        {
          title: "Test Notification",
          body: "This is a test push notification from Jevah App",
          data: { test: true },
        },
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data.success;
    } catch (error) {
      console.error("Failed to send test notification:", error);
      return false;
    }
  }

  /**
   * Handle notification tap
   */
  private handleNotificationTap(
    notification: Notifications.Notification
  ): void {
    const data = notification.request.content.data;

    // Navigate based on notification type
    if (data?.type === "follow") {
      // Navigate to followers screen
      console.log("Navigate to followers");
    } else if (data?.type === "like" || data?.type === "comment") {
      // Navigate to content
      console.log("Navigate to content:", data?.contentId);
    } else if (data?.type === "merch_purchase") {
      // Navigate to merch screen
      console.log("Navigate to merch");
    }
  }

  /**
   * Handle notification received
   */
  private handleNotificationReceived(
    notification: Notifications.Notification
  ): void {
    // Update badge count, show in-app notification, etc.
    console.log("Notification received:", notification);
  }

  /**
   * Get stored preferences
   */
  async getStoredPreferences(): Promise<PushNotificationPreferences | null> {
    try {
      const stored = await AsyncStorage.getItem("pushPreferences");
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error("Failed to get stored preferences:", error);
      return null;
    }
  }

  /**
   * Check if push notifications are enabled
   */
  async isEnabled(): Promise<boolean> {
    try {
      const stored = await AsyncStorage.getItem("pushNotificationsEnabled");
      return stored === "true";
    } catch (error) {
      console.error("Failed to check push notification status:", error);
      return false;
    }
  }

  /**
   * Clear all notifications
   */
  async clearAllNotifications(): Promise<void> {
    try {
      await Notifications.dismissAllNotificationsAsync();
    } catch (error) {
      console.error("Failed to clear notifications:", error);
    }
  }

  /**
   * Set badge count
   */
  async setBadgeCount(count: number): Promise<void> {
    try {
      await Notifications.setBadgeCountAsync(count);
    } catch (error) {
      console.error("Failed to set badge count:", error);
    }
  }
}

export default new PushNotificationService();
```

## 🎣 **3. Custom Hook**

### **hooks/usePushNotifications.ts**

```typescript
import { useState, useEffect, useCallback } from "react";
import PushNotificationService, {
  PushNotificationPreferences,
} from "../services/PushNotificationService";

export const usePushNotifications = (authToken: string | null) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [preferences, setPreferences] = useState<PushNotificationPreferences>({
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
  const [loading, setLoading] = useState(false);

  const initialize = useCallback(async () => {
    if (!authToken) return false;

    setLoading(true);
    try {
      const success = await PushNotificationService.initialize(authToken);
      setIsInitialized(success);

      if (success) {
        const enabled = await PushNotificationService.isEnabled();
        setIsEnabled(enabled);

        const storedPreferences =
          await PushNotificationService.getStoredPreferences();
        if (storedPreferences) {
          setPreferences(storedPreferences);
        }
      }

      return success;
    } catch (error) {
      console.error("Failed to initialize push notifications:", error);
      return false;
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  const updatePreferences = useCallback(
    async (newPreferences: Partial<PushNotificationPreferences>) => {
      setLoading(true);
      try {
        const success =
          await PushNotificationService.updatePreferences(newPreferences);
        if (success) {
          setPreferences(prev => ({ ...prev, ...newPreferences }));
        }
        return success;
      } catch (error) {
        console.error("Failed to update preferences:", error);
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const setEnabled = useCallback(async (enabled: boolean) => {
    setLoading(true);
    try {
      const success = await PushNotificationService.setEnabled(enabled);
      if (success) {
        setIsEnabled(enabled);
      }
      return success;
    } catch (error) {
      console.error("Failed to set enabled status:", error);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const sendTestNotification = useCallback(async () => {
    setLoading(true);
    try {
      return await PushNotificationService.sendTestNotification();
    } catch (error) {
      console.error("Failed to send test notification:", error);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearAllNotifications = useCallback(async () => {
    try {
      await PushNotificationService.clearAllNotifications();
    } catch (error) {
      console.error("Failed to clear notifications:", error);
    }
  }, []);

  const setBadgeCount = useCallback(async (count: number) => {
    try {
      await PushNotificationService.setBadgeCount(count);
    } catch (error) {
      console.error("Failed to set badge count:", error);
    }
  }, []);

  useEffect(() => {
    if (authToken && !isInitialized) {
      initialize();
    }
  }, [authToken, isInitialized, initialize]);

  return {
    isInitialized,
    isEnabled,
    preferences,
    loading,
    initialize,
    updatePreferences,
    setEnabled,
    sendTestNotification,
    clearAllNotifications,
    setBadgeCount,
  };
};
```

## 🎨 **4. Notification Settings Component**

### **components/NotificationSettings.tsx**

```typescript
import React from 'react';
import {
  View,
  Text,
  Switch,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { usePushNotifications } from '../hooks/usePushNotifications';

interface NotificationSettingsProps {
  authToken: string;
}

export const NotificationSettings: React.FC<NotificationSettingsProps> = ({ authToken }) => {
  const {
    isEnabled,
    preferences,
    loading,
    updatePreferences,
    setEnabled,
    sendTestNotification,
  } = usePushNotifications(authToken);

  const handleToggleEnabled = async () => {
    const success = await setEnabled(!isEnabled);
    if (!success) {
      Alert.alert('Error', 'Failed to update notification settings');
    }
  };

  const handlePreferenceChange = async (key: keyof typeof preferences, value: boolean) => {
    const success = await updatePreferences({ [key]: value });
    if (!success) {
      Alert.alert('Error', 'Failed to update notification preferences');
    }
  };

  const handleTestNotification = async () => {
    const success = await sendTestNotification();
    if (success) {
      Alert.alert('Success', 'Test notification sent!');
    } else {
      Alert.alert('Error', 'Failed to send test notification');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Push Notifications</Text>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Enable Push Notifications</Text>
          <Switch
            value={isEnabled}
            onValueChange={handleToggleEnabled}
            disabled={loading}
          />
        </View>

        {isEnabled && (
          <>
            <TouchableOpacity
              style={styles.testButton}
              onPress={handleTestNotification}
              disabled={loading}
            >
              <Text style={styles.testButtonText}>Send Test Notification</Text>
            </TouchableOpacity>

            <Text style={styles.preferencesTitle}>Notification Preferences</Text>

            {Object.entries(preferences).map(([key, value]) => (
              <View key={key} style={styles.settingRow}>
                <Text style={styles.settingLabel}>
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </Text>
                <Switch
                  value={value}
                  onValueChange={(newValue) => handlePreferenceChange(key as keyof typeof preferences, newValue)}
                  disabled={loading}
                />
              </View>
            ))}
          </>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  preferencesTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 16,
    color: '#333',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  testButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
    alignItems: 'center',
  },
  testButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

## 🚀 **5. App Integration**

### **App.tsx**

```typescript
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import PushNotificationService from './services/PushNotificationService';

export default function App() {
  useEffect(() => {
    // Setup notification channels for Android
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }
  }, []);

  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      {/* Your app components */}
    </NavigationContainer>
  );
}
```

## 🔧 **6. Environment Setup**

### **Environment Variables**

Add to your `.env` file:

```env
EXPO_ACCESS_TOKEN=your_expo_access_token_here
```

### **Getting Expo Access Token**

1. Go to [Expo Dashboard](https://expo.dev/)
2. Create a new project or select existing
3. Go to Project Settings → Access Tokens
4. Create a new token with push notification permissions

## 📱 **7. Testing**

### **Test Push Notifications**

```typescript
// In your app, add a test button
const TestPushNotifications = () => {
  const { sendTestNotification } = usePushNotifications(authToken);

  return (
    <TouchableOpacity onPress={sendTestNotification}>
      <Text>Send Test Notification</Text>
    </TouchableOpacity>
  );
};
```

## 🎯 **8. Production Checklist**

- [ ] Add Expo Access Token to environment variables
- [ ] Configure notification channels for Android
- [ ] Test on physical device (not simulator)
- [ ] Handle notification permissions gracefully
- [ ] Implement proper navigation on notification tap
- [ ] Add error handling for network failures
- [ ] Test with app in background/closed states

## 🚨 **Important Notes**

1. **Physical Device Required**: Push notifications only work on physical devices, not simulators
2. **Expo Go Limitations**: Some advanced features may require building a standalone app
3. **Permissions**: Always request permissions before registering tokens
4. **Error Handling**: Implement proper error handling for network failures
5. **Token Management**: Handle token refresh and cleanup properly

This implementation provides a complete push notification system that integrates seamlessly with your existing backend! 🎉























