# FRONTEND_NOTIFICATIONS_AUTH_FIXES.md

## Purpose

Fix 401s on notification REST calls and Socket.IO handshake timeouts. This doc is copy‑paste ready for the frontend.

## Are the errors frontend or backend?

- 401 on notifications: frontend (missing/overwritten Authorization header, refresh payload mismatch).
- 400 on refresh (Token is required): frontend (body must be `{ token }`).
- Socket timeout: usually frontend (no token or wrong health check), backend now accepts tokens via auth, headers authorization, or query. Backend is OK.

---

## 1) Token utilities – one source of truth

Make sure you store and read the auth token consistently.

```ts
// utils/tokenUtils.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export const TokenUtils = {
  key: "userToken",

  async getAuthToken(): Promise<string | null> {
    return AsyncStorage.getItem(this.key);
  },

  async setAuthToken(token: string): Promise<void> {
    await AsyncStorage.setItem(this.key, token);
  },

  isValidJWTFormat(token: string): boolean {
    return typeof token === "string" && token.split(".").length === 3;
  },

  getTokenPreview(token: string | null) {
    if (!token) return "null";
    return `${token.slice(0, 6)}...${token.slice(-6)}`;
  },

  async getTokenInfo() {
    const t = await this.getAuthToken();
    return { present: !!t, preview: this.getTokenPreview(t) };
  },
};
```

After login, always call:

```ts
await TokenUtils.setAuthToken(loginResponse.data.token);
```

---

## 2) API client – send Bearer, auto‑refresh once, correct merge order

```ts
// utils/api.ts
import { TokenUtils } from "../utils/tokenUtils";

export class APIClient {
  constructor(private baseURL: string) {}

  private async defaultHeaders(token?: string): Promise<HeadersInit> {
    const authToken = token || (await TokenUtils.getAuthToken());
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (authToken) (headers as any).Authorization = `Bearer ${authToken}`;
    return headers;
  }

  async refreshToken(): Promise<string> {
    const current = await TokenUtils.getAuthToken();
    if (!current) throw new Error("No token to refresh");

    const res = await fetch(`${this.baseURL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // IMPORTANT: backend expects { token }
      body: JSON.stringify({ token: current }),
    });

    const json = await res.json();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(json)}`);

    const newToken = json?.data?.token;
    if (!newToken)
      throw new Error("Refresh succeeded but no token in response");

    await TokenUtils.setAuthToken(newToken);
    return newToken;
  }

  // Generic request with auto refresh
  async request(path: string, init?: RequestInit): Promise<Response> {
    const first = await fetch(`${this.baseURL}${path}`, {
      ...init,
      headers: { ...(await this.defaultHeaders()), ...(init?.headers as any) },
    });

    if (first.status !== 401) return first;

    // 401 → try refresh once
    const newToken = await this.refreshToken();
    const retry = await fetch(`${this.baseURL}${path}`, {
      ...init,
      // Merge order so refreshed Authorization wins
      headers: {
        ...(await this.defaultHeaders(newToken)),
        ...(init?.headers as any),
      },
    });

    return retry;
  }
}

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://jevahapp-backend.onrender.com";
export const apiClient = new APIClient(API_BASE_URL);
```

---

## 3) Notifications service – use API client wrapper

```ts
// services/NotificationAPIService.ts
import { Platform } from "react-native";
import { API_BASE_URL, apiClient } from "../utils/api";
import { TokenUtils } from "../utils/tokenUtils";

export interface Notification {
  /* … same as your types … */
}
export interface NotificationResponse {
  notifications: Notification[];
  total: number;
  unreadCount: number;
}
export interface NotificationPreferences {
  pushEnabled: boolean;
  emailEnabled: boolean;
  types: { [key: string]: boolean };
}
export interface NotificationStats {
  total: number;
  unread: number;
  byType: { [key: string]: number };
}

class NotificationAPIService {
  private baseURL = API_BASE_URL;
  private static instance: NotificationAPIService;

  static getInstance(): NotificationAPIService {
    if (!NotificationAPIService.instance)
      NotificationAPIService.instance = new NotificationAPIService();
    return NotificationAPIService.instance;
  }

  private async getAuthHeaders(tokenOverride?: string): Promise<HeadersInit> {
    const token = tokenOverride || (await TokenUtils.getAuthToken());
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      "expo-platform": Platform.OS as any,
    };
    if (token) (headers as any).Authorization = `Bearer ${token}`;
    return headers;
  }

  async getNotifications(
    page = 1,
    limit = 20,
    type?: string,
    unreadOnly?: boolean
  ): Promise<NotificationResponse> {
    console.log("🔎 Notifications token:", await TokenUtils.getTokenInfo());
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      ...(type && { type }),
      ...(unreadOnly && { unreadOnly: "true" }),
    });
    const res = await apiClient.request(`/api/notifications?${params}`, {
      headers: await this.getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const json = await res.json();
    return json.data;
  }

  async markAsRead(notificationId: string): Promise<void> {
    const res = await apiClient.request(
      `/api/notifications/${notificationId}/read`,
      { method: "PATCH", headers: await this.getAuthHeaders() }
    );
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  }

  async markAllAsRead(): Promise<number> {
    const res = await apiClient.request(`/api/notifications/mark-all-read`, {
      method: "PATCH",
      headers: await this.getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const json = await res.json();
    return json.count;
  }

  async getPreferences(): Promise<NotificationPreferences> {
    const res = await apiClient.request(`/api/notifications/preferences`, {
      headers: await this.getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const json = await res.json();
    return json.data;
  }

  async updatePreferences(
    preferences: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    const res = await apiClient.request(`/api/notifications/preferences`, {
      method: "PUT",
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(preferences),
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const json = await res.json();
    return json.data;
  }

  async getStats(): Promise<NotificationStats> {
    const res = await apiClient.request(`/api/notifications/stats`, {
      headers: await this.getAuthHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const json = await res.json();
    return json.data;
  }
}

export const notificationAPIService = new NotificationAPIService();
```

---

## 4) Socket.IO – validate, health check, and connect with token

```ts
// services/SocketManager.ts (key parts)
import io, { Socket } from "socket.io-client";
import { TokenUtils } from "../utils/tokenUtils";

// Replace health check with a protected endpoint that exists
const ok = await fetch(`${this.serverUrl}/api/auth/me`, {
  method: "GET",
  headers: {
    Authorization: `Bearer ${this.authToken}`,
    "Content-Type": "application/json",
  },
});
if (!ok?.ok) {
  /* skip connection, log */
}

// Connect, server accepts auth.token or Authorization header
this.socket = io(this.serverUrl, {
  auth: { token: this.authToken },
  transports: ["websocket", "polling"],
  timeout: 20000,
  forceNew: true,
  autoConnect: false,
  reconnection: false,
});
```

Notes:

- Do not rely on non‑standard `timeout` in fetch; if needed, use AbortController.
- Ensure `API_BASE_URL` is reachable from device/emulator (avoid `localhost` on physical devices).

---

## 5) Quick tests

```ts
console.log("API_BASE_URL =", API_BASE_URL);
console.log("Token before call:", await TokenUtils.getTokenInfo());
const r = await notificationAPIService.getNotifications();
console.log("Loaded:", r.notifications?.length);
```

```bash
# curl test
curl -H "Authorization: Bearer <TOKEN>" https://jevahapp-backend.onrender.com/api/notifications | jq
```

---

## 6) Checklist (tick all)

- [ ] Token stored with `TokenUtils.setAuthToken` after login
- [ ] All notification requests include `Authorization: Bearer <token>`
- [ ] 401 triggers refresh with body `{ token }`
- [ ] New token saved and used on retry
- [ ] Socket health check uses `/api/auth/me` with Bearer header
- [ ] Socket connects with `auth: { token }`
- [ ] API base URL is reachable from device/emulator

With these changes, 401s and socket timeouts should be resolved. If anything still fails, log `TokenUtils.getTokenInfo()` and request headers preview before the request to confirm Authorization is present.
