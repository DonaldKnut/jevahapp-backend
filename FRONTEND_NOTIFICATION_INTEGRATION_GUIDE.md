# Frontend Notification Integration Guide (Mobile & Web)

This guide shows how to consume the notification endpoints and real-time events with a sleek UI that displays the actor's avatar, name, and what they did.

- Works with: React Native (Expo) and React Web
- Transport: REST + Socket.IO
- Shows avatar, actor name, action text, timestamp, unread state

---

## 1) API Endpoints

Base URL examples:

- Production: `https://jevahapp-backend.onrender.com`
- Local: `http://localhost:4000`

Headers (all endpoints):

- `Authorization: Bearer <JWT>`

Endpoints (as implemented in backend):

- GET `/api/notifications` — paginated notifications
  - Query: `page`, `limit`, `type?`
- GET `/api/notifications/stats` — high-level stats (optional usage)
- PATCH `/api/notifications/:notificationId/read` — mark one as read
- PATCH `/api/notifications/mark-all-read` — mark all as read
- GET `/api/notifications/preferences` — get preferences
- PUT `/api/notifications/preferences` — update preferences

Response example for GET `/api/notifications`:

```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "_id": "6730...",
        "user": "64a...",
        "type": "like|comment|bookmark|follow|message|download|share|reply|milestone|...",
        "title": "New Like",
        "message": "John liked your media",
        "metadata": {
          "actorName": "John",
          "actorAvatar": "https://.../avatar.jpg",
          "contentTitle": "Amazing Song",
          "contentType": "media",
          "thumbnailUrl": "https://.../thumb.jpg",
          "commentText": "Nice!"
        },
        "priority": "low|medium|high",
        "isRead": false,
        "createdAt": "2025-09-22T12:34:56.000Z"
      }
    ],
    "total": 42,
    "unreadCount": 5
  }
}
```

Note: Actor details are provided via `metadata.actorName` and `metadata.actorAvatar`. Prefer metadata first; if backend later adds `actor`, use it as a fallback.

---

## 2) Real-time Events (Socket.IO)

The backend emits these user-scoped events to `room: user:<userId>`:

- `new-notification` — payload is a single notification (same shape as above, simplified)
- `notification-count-update` — `{ unreadCount: number }`

Recommended client behavior:

- On `new-notification`, prepend the item to the list and increment badge
- On `notification-count-update`, update the badge count to the provided value

---

## 3) Client Service (React Native / Web)

Minimal, production-ready service with REST + socket.

```ts
// services/notificationService.ts
import { io, Socket } from "socket.io-client";

export type Priority = "low" | "medium" | "high";
export interface AppNotification {
  _id: string;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, any>;
  priority: Priority;
  isRead: boolean;
  createdAt: string;
}

export class NotificationClient {
  private baseURL: string;
  private token: string;
  private socket: Socket | null = null;

  constructor(baseURL: string, token: string) {
    this.baseURL = baseURL;
    this.token = token;
  }

  connect() {
    if (this.socket) return;
    this.socket = io(this.baseURL, {
      auth: { token: this.token },
      transports: ["websocket", "polling"],
    });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  onNewNotification(cb: (n: AppNotification) => void) {
    this.socket?.on("new-notification", cb);
  }

  onCountUpdate(cb: (unreadCount: number) => void) {
    this.socket?.on("notification-count-update", (d: { unreadCount: number }) =>
      cb(d.unreadCount)
    );
  }

  async list(page = 1, limit = 20, type?: string) {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (type) params.append("type", type);

    const res = await fetch(`${this.baseURL}/api/notifications?${params}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    return res.json();
  }

  async markRead(notificationId: string) {
    const res = await fetch(
      `${this.baseURL}/api/notifications/${notificationId}/read`,
      { method: "PATCH", headers: { Authorization: `Bearer ${this.token}` } }
    );
    return res.json();
  }

  async markAllRead() {
    const res = await fetch(`${this.baseURL}/api/notifications/mark-all-read`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${this.token}` },
    });
    return res.json();
  }

  async getPreferences() {
    const res = await fetch(`${this.baseURL}/api/notifications/preferences`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    return res.json();
  }

  async updatePreferences(prefs: any) {
    const res = await fetch(`${this.baseURL}/api/notifications/preferences`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(prefs),
    });
    return res.json();
  }
}
```

---

## 4) UI/UX — Sleek Notification List

Design goals:

- Each row shows: actor avatar, actor name, action message, timestamp, unread indicator
- Subtle accent for unread (background + left border)
- Tap row → navigate to the content or conversation
- Swipe/press long → mark read

React Native example:

```tsx
// components/NotificationItem.tsx
import React from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";

interface Props {
  notification: any;
  onPress: () => void;
  onMarkRead: () => void;
}

function getActor(n: any) {
  const name = n?.metadata?.actorName || "Someone";
  const avatar = n?.metadata?.actorAvatar;
  return { name, avatar };
}

function formatAction(n: any) {
  switch (n.type) {
    case "like":
      return "liked your content";
    case "comment":
      return "commented on your content";
    case "reply":
      return "replied to your comment";
    case "bookmark":
      return "saved your content";
    case "follow":
      return "started following you";
    case "message":
      return "sent you a message";
    case "download":
      return "downloaded your content";
    case "share":
      return "shared your content";
    default:
      return n.title || "New notification";
  }
}

export const NotificationItem: React.FC<Props> = ({
  notification,
  onPress,
  onMarkRead,
}) => {
  const { name, avatar } = getActor(notification);
  const actionText = formatAction(notification);
  const isUnread = !notification.isRead;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.container, isUnread && styles.unread]}
    >
      <Image
        source={
          avatar ? { uri: avatar } : require("../assets/avatar-placeholder.png")
        }
        style={styles.avatar}
      />
      <View style={styles.textWrap}>
        <Text style={styles.title} numberOfLines={1}>
          {name} <Text style={styles.action}>{actionText}</Text>
        </Text>
        {notification.metadata?.contentTitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {notification.metadata.contentTitle}
          </Text>
        ) : null}
        <Text style={styles.time}>
          {new Date(notification.createdAt).toLocaleString()}
        </Text>
      </View>
      {isUnread && (
        <TouchableOpacity onPress={onMarkRead} style={styles.readBtn}>
          <Text style={styles.readBtnText}>Mark</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: "#fff",
    borderBottomColor: "#EFF1F6",
    borderBottomWidth: 1,
  },
  unread: {
    backgroundColor: "#F8FAFF",
    borderLeftColor: "#3B82F6",
    borderLeftWidth: 4,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  textWrap: { flex: 1 },
  title: { fontSize: 15, color: "#111827" },
  action: { color: "#6B7280" },
  subtitle: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  time: { marginTop: 4, fontSize: 12, color: "#9CA3AF" },
  readBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "#E5F0FF",
  },
  readBtnText: { color: "#2563EB", fontWeight: "600" },
});
```

Badge component:

```tsx
// components/NotificationBadge.tsx
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";

export const NotificationBadge = ({
  count,
  onPress,
}: {
  count: number;
  onPress: () => void;
}) => (
  <TouchableOpacity onPress={onPress} style={styles.wrap}>
    <Icon name="notifications" size={24} color="#111827" />
    {count > 0 && (
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{count > 99 ? "99+" : count}</Text>
      </View>
    )}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  wrap: { position: "relative", padding: 8 },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "#EF4444",
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
});
```

---

## 5) Hook/Store Example

```ts
// hooks/useNotifications.ts
import { useEffect, useState, useCallback } from "react";
import {
  NotificationClient,
  AppNotification,
} from "../services/notificationService";

export function useNotifications(baseURL: string, token: string) {
  const [client] = useState(() => new NotificationClient(baseURL, token));
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const res = await client.list(page, 20);
        if (res.success) {
          setItems(res.data.notifications);
          setUnread(res.data.unreadCount);
        }
      } finally {
        setLoading(false);
      }
    },
    [client]
  );

  const markRead = useCallback(
    async (id: string) => {
      await client.markRead(id);
      setItems(prev =>
        prev.map(n => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnread(prev => Math.max(0, prev - 1));
    },
    [client]
  );

  const markAllRead = useCallback(async () => {
    await client.markAllRead();
    setItems(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnread(0);
  }, [client]);

  useEffect(() => {
    client.connect();
    client.onNewNotification(n => setItems(prev => [n, ...prev]));
    client.onCountUpdate(c => setUnread(c));
    load(1);
    return () => client.disconnect();
  }, [client, load]);

  return { items, unread, loading, load, markRead, markAllRead };
}
```

---

## 6) UX Copy & Mapping

- like: "liked your content"
- comment: "commented on your content"
- reply: "replied to your comment"
- bookmark: "saved your content"
- follow: "started following you"
- message: "sent you a message"
- download: "downloaded your content"
- share: "shared your content"

Always prefer `metadata.actorName` and `metadata.actorAvatar`.

---

## 7) Navigation Deep-links (Recommended)

Map notification types to in-app destinations:

- like/comment/reply/bookmark/share/download → content screen (use `metadata.thumbnailUrl`, `metadata.contentTitle`)
- follow → profile screen (actor)
- message → chat screen (actor)

Pass IDs via navigation params if provided (e.g., `relatedId`, `target`, `conversationId`).

---

## 8) Error Handling & Edge Cases

- Missing avatar → fallback placeholder
- Very long messages → `numberOfLines`/truncate
- Offline state → queue Mark-as-read locally and retry later
- Token expiry → refresh token and reconnect socket

---

## 9) Theming & Accessibility

- High-contrast unread state
- Hit targets ≥ 44px
- Use `accessibilityLabel` on actionable elements
- Dark mode: invert background and text colors accordingly

---

## 10) Quick Start Checklist

- [ ] Obtain JWT token after login
- [ ] Instantiate `NotificationClient(baseURL, token)` and connect
- [ ] Render `NotificationBadge` with `unread`
- [ ] Render list using `NotificationItem` with avatar/name/action
- [ ] Wire `markRead` and `markAllRead`
- [ ] Handle `new-notification` and `notification-count-update`

This delivers a fast, elegant notification experience with avatars, names, and clear action text.

