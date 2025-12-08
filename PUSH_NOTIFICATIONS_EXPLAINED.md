# How Push Notifications Work in Jevah Backend

## 📱 Overview

Your backend uses **Expo Push Notifications** with **FCM (Firebase Cloud Messaging) v1 API** to send push notifications to mobile devices (iOS and Android).

## 🏗️ Architecture

```
┌─────────────────┐
│  Mobile App     │
│  (React Native) │
└────────┬────────┘
         │
         │ 1. User opens app → Requests push permission
         │ 2. App gets device token from Expo
         │ 3. App sends token to backend
         ▼
┌─────────────────────────────────────┐
│  Backend API                        │
│  POST /api/push-notifications/      │
│  register                           │
└────────┬────────────────────────────┘
         │
         │ 4. Backend stores token in User model
         ▼
┌─────────────────────────────────────┐
│  MongoDB                            │
│  User.pushNotifications = {        │
│    enabled: true,                   │
│    deviceTokens: ["Exponent..."]    │
│  }                                  │
└────────┬────────────────────────────┘
         │
         │ 5. Event occurs (like, comment, etc.)
         ▼
┌─────────────────────────────────────┐
│  Notification Service                │
│  (notification.service.ts)          │
└────────┬────────────────────────────┘
         │
         │ 6. Creates in-app notification
         │ 7. Calls PushNotificationService
         ▼
┌─────────────────────────────────────┐
│  Push Notification Service          │
│  (pushNotification.service.ts)      │
│  - Checks user preferences          │
│  - Validates tokens                 │
│  - Creates Expo messages            │
└────────┬────────────────────────────┘
         │
         │ 8. Sends to Expo Push Service
         ▼
┌─────────────────────────────────────┐
│  Expo Push Notification Service      │
│  (expo-server-sdk)                  │
│  - Chunks messages (100 per batch)  │
│  - Sends to FCM/APNs                │
└────────┬────────────────────────────┘
         │
         │ 9. FCM/APNs delivers to device
         ▼
┌─────────────────┐
│  User's Device  │
│  Shows notification│
└─────────────────┘
```

## 🔑 Key Components

### 1. **Push Notification Service** (`src/service/pushNotification.service.ts`)

This is the core service that handles all push notification operations.

#### Main Features:

**a) Device Token Management**
```typescript
// Register a device token when user logs in
await PushNotificationService.registerDeviceToken(userId, deviceToken);

// Unregister when user logs out
await PushNotificationService.unregisterDeviceToken(userId, deviceToken);
```

**b) Sending Notifications**
```typescript
// Send to single user
await PushNotificationService.sendToUser(
  userId,
  {
    title: "New Like",
    body: "John liked your video",
    data: { contentId: "123", contentType: "video" },
    priority: "high"
  },
  "mediaLikes" // Notification type
);

// Send to multiple users
await PushNotificationService.sendToUsers([userId1, userId2], notification);

// Send to all users (broadcast)
await PushNotificationService.sendToAll(notification);
```

**c) User Preferences**
```typescript
// Update what notifications user wants
await PushNotificationService.updatePreferences(userId, {
  mediaLikes: true,
  mediaComments: true,
  newFollowers: false, // User disabled this
});
```

### 2. **Notification Service** (`src/service/notification.service.ts`)

Higher-level service that creates both in-app and push notifications.

```typescript
// Creates in-app notification AND sends push
await NotificationService.createNotification({
  userId: "user123",
  type: "like",
  title: "New Like",
  message: "John liked your video",
  metadata: { contentId: "123" },
  priority: "high"
});
```

### 3. **User Model Storage**

Each user has push notification settings stored in MongoDB:

```typescript
user.pushNotifications = {
  enabled: true, // User can disable all notifications
  deviceTokens: [
    "ExponentPushToken[abc123...]", // iOS device
    "ExponentPushToken[xyz789...]"  // Android device
  ],
  preferences: {
    newFollowers: true,
    mediaLikes: true,
    mediaComments: true,
    mediaShares: true,
    // ... etc
  }
}
```

## 🔄 Complete Flow Example

### Scenario: Someone likes a user's video

**Step 1: Like Action Occurs**
```typescript
// In mediaInteraction.controller.ts or similar
POST /api/media/:id/like
```

**Step 2: Notification Service Called**
```typescript
// In contentInteraction.service.ts
await NotificationService.notifyContentLike(
  contentOwnerId,  // Who owns the video
  contentId,        // Which video was liked
  "video"           // Content type
);
```

**Step 3: Notification Service Creates Notification**
```typescript
// Creates in-app notification in database
const notification = new Notification({
  user: contentOwnerId,
  type: "like",
  title: "New Like",
  message: "John liked your video",
  metadata: { contentId, likerId, contentType }
});

await notification.save();
```

**Step 4: Push Notification Sent**
```typescript
// Sends push notification
await PushNotificationService.sendToUser(
  contentOwnerId,
  {
    title: "New Like",
    body: "John liked your video",
    data: {
      notificationId: notification._id,
      type: "like",
      contentId: contentId,
      contentType: "video"
    },
    priority: "high"
  },
  "mediaLikes" // Checks if user enabled this type
);
```

**Step 5: Push Service Checks User Settings**
```typescript
// In pushNotification.service.ts
const user = await User.findById(userId);

// Check if notifications enabled
if (!user.pushNotifications?.enabled) {
  return false; // User disabled all notifications
}

// Check if this type is enabled
if (user.pushNotifications.preferences?.mediaLikes === false) {
  return false; // User disabled like notifications
}

// Get valid device tokens
const validTokens = user.pushNotifications.deviceTokens.filter(
  token => Expo.isExpoPushToken(token)
);
```

**Step 6: Create Expo Messages**
```typescript
const messages = validTokens.map(token => ({
  to: token,
  title: "New Like",
  body: "John liked your video",
  data: { contentId: "123", type: "like" },
  sound: "default",
  priority: "high"
}));
```

**Step 7: Send to Expo (Chunked)**
```typescript
// Expo limits to 100 messages per request
const chunks = this.expo.chunkPushNotifications(messages);

for (const chunk of chunks) {
  const tickets = await this.expo.sendPushNotificationsAsync(chunk);
  // Tickets contain success/error status
}
```

**Step 8: Expo → FCM/APNs → Device**
- Expo sends to Firebase Cloud Messaging (Android)
- Expo sends to Apple Push Notification Service (iOS)
- FCM/APNs delivers to user's device
- User sees notification on their phone

## 📋 Notification Types Supported

Your system supports these notification types:

```typescript
- newFollowers      // Someone followed you
- mediaLikes        // Someone liked your content
- mediaComments    // Someone commented on your content
- mediaShares      // Someone shared your content
- merchPurchases   // Purchase notifications
- songDownloads    // Download notifications
- subscriptionUpdates // Subscription changes
- securityAlerts   // Security-related notifications
- liveStreams      // Live stream notifications
- newMessages      // New chat messages
```

## 🎛️ User Control

Users can control notifications in two ways:

### 1. **Global Toggle**
```typescript
// Disable ALL push notifications
await PushNotificationService.setEnabled(userId, false);
```

### 2. **Per-Type Preferences**
```typescript
// Disable only like notifications, keep others
await PushNotificationService.updatePreferences(userId, {
  mediaLikes: false,  // No like notifications
  mediaComments: true // But still get comments
});
```

## 🔧 Configuration

### Environment Variables Required:

```bash
EXPO_ACCESS_TOKEN=your_expo_access_token
```

### How to Get Expo Access Token:

1. Go to https://expo.dev
2. Create account or login
3. Go to Account Settings → Access Tokens
4. Create a new token
5. Add to `.env` file

## 📊 Features

### 1. **Multi-Device Support**
- Users can have multiple devices (phone, tablet)
- All devices receive notifications
- Each device has its own token

### 2. **Token Validation**
- Automatically validates Expo token format
- Filters out invalid tokens
- Cleanup function removes invalid tokens

### 3. **Chunking**
- Expo limits to 100 messages per request
- Service automatically chunks large batches
- Handles errors gracefully

### 4. **Error Handling**
- Logs success/failure counts
- Continues sending even if some fail
- Returns detailed statistics

### 5. **Statistics**
```typescript
const stats = await PushNotificationService.getStats();
// Returns:
// - Total users
// - Users with push enabled
// - Total device tokens
// - Users with tokens
```

## 🚀 Usage Examples

### Example 1: Send Notification When User Follows Someone

```typescript
// In follow.controller.ts
await NotificationService.notifyUserFollow(followerId, followingId);

// This automatically:
// 1. Creates in-app notification
// 2. Sends push notification
// 3. Respects user preferences
```

### Example 2: Send Broadcast to All Users

```typescript
// Announcement to all users
await PushNotificationService.sendToAll({
  title: "New Feature Available!",
  body: "Check out our new gospel playlist feature",
  data: { type: "announcement", feature: "playlists" },
  priority: "normal"
});
```

### Example 3: Send to Specific Role

```typescript
// Notify all admins
await PushNotificationService.sendToRole("admin", {
  title: "System Alert",
  body: "High server load detected",
  priority: "high"
});
```

## 🔍 How It Integrates with Your App

### Frontend (React Native) Flow:

1. **Request Permission**
```typescript
import * as Notifications from 'expo-notifications';

const { status } = await Notifications.requestPermissionsAsync();
```

2. **Get Device Token**
```typescript
const token = (await Notifications.getExpoPushTokenAsync()).data;
// Returns: "ExponentPushToken[abc123...]"
```

3. **Register with Backend**
```typescript
await fetch(`${API_URL}/api/push-notifications/register`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ deviceToken: token })
});
```

4. **Handle Notifications**
```typescript
// Listen for notifications
Notifications.addNotificationReceivedListener(notification => {
  // Handle notification when app is open
  const data = notification.request.content.data;
  // Navigate to content, etc.
});
```

## 🛡️ Safety Features

1. **Token Validation**: Only valid Expo tokens accepted
2. **User Preferences**: Respects user's notification settings
3. **Error Handling**: Graceful failure, doesn't crash
4. **Logging**: Comprehensive logging for debugging
5. **Cleanup**: Removes invalid tokens automatically

## 📈 Performance

- **Chunking**: Handles large batches efficiently
- **Async**: Non-blocking, doesn't slow down main operations
- **Batching**: Groups notifications for efficiency
- **Caching**: User data cached for faster lookups

## 🎯 Best Practices

1. **Always check user preferences** before sending
2. **Use appropriate priority** (high for important, normal for general)
3. **Include deep link data** in notification data
4. **Log everything** for debugging
5. **Handle errors gracefully** - don't break user flow

---

**Summary**: Your push notification system is comprehensive and production-ready. It handles device registration, user preferences, multi-device support, error handling, and integrates seamlessly with your notification service for both in-app and push notifications.



