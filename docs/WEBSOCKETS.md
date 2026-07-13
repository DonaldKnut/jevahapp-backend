# WebSocket API (Socket.IO)

**Path:** `/socket.io/`  
**Transports:** `websocket`, `polling`  
**Auth:** Pass JWT as `auth.token`, `Authorization: Bearer`, or `query.token`

```js
import { io } from "socket.io-client";
const socket = io(API_URL, { auth: { token: accessToken }, path: "/socket.io/" });
```

## Rooms

| Room pattern | Join event | Use case |
|--------------|------------|----------|
| `user:{userId}` | Auto on connect | Personal notifications |
| `media:{mediaId}` | `join-media` | Legacy media comments |
| `content:{type}:{id}` | `join-content` | Universal content (feed + copyright-free) |
| `content:audio:{songId}` | `join-content` with `contentType: "audio"` | Copyright-free realtime |
| `stream:{streamId}` | `join-stream` | Live stream viewers |
| `chat:{userA}:{userB}` | `join-chat` | Private DMs |

## Client → Server events

| Event | Payload | Description |
|-------|---------|-------------|
| `join-media` | `mediaId` | Join media room |
| `leave-media` | `mediaId` | Leave media room |
| `join-content` | `{ contentId, contentType }` | Join universal content room |
| `leave-content` | `{ contentId, contentType }` | Leave content room |
| `join-stream` | `{ streamId, action: "join" }` | Join live stream |
| `leave-stream` | `{ streamId, action: "leave" }` | Leave live stream |
| `new-comment` | `{ mediaId, content, parentCommentId? }` | Legacy media comment |
| `comment-reaction` | `{ commentId, reaction }` | Comment like |
| `media-reaction` | `{ mediaId, actionType }` | Legacy media like/share |
| `content-reaction` | `{ contentId, contentType, actionType }` | Universal like |
| `content-comment` | `{ contentId, contentType, content, parentCommentId? }` | Universal comment |
| `typing-start` / `typing-stop` | `mediaId` | Comment typing indicator |
| `stream-chat` | `{ streamId, message }` | Live stream chat |
| `send-message` | `{ recipientId, content, ... }` | Private DM |
| `join-chat` / `leave-chat` | `recipientId` | DM room |
| `chat-typing-start` / `chat-typing-stop` | `recipientId` | DM typing |

## Server → Client events

| Event | Description |
|-------|-------------|
| `new-comment` | New comment on media |
| `comment-reaction` | Comment reaction update |
| `media-reaction` | Media like/share update |
| `content-reaction` | Universal like update |
| `content-comment` | Universal new comment |
| `count-update` | `{ likeCount, commentCount, shareCount, viewCount }` |
| `copyright-free-song-interaction-updated` | Copyright-free counts |
| `viewer-count-update` | Content room viewer count |
| `viewer-joined` / `viewer-left` | Stream viewer changes |
| `stream-chat` | Stream chat message |
| `new-message` | Incoming DM |
| `new-like-notification` | Content owner like notification |
| `new-comment-notification` | Content owner comment notification |
| `error` | `{ message }` |

## Recommended frontend flow

**Feed video:**
1. `join-content` with `{ contentId: mediaId, contentType: "media" }`
2. Listen for `content-reaction`, `count-update`
3. HTTP: `POST /api/content/media/:id/like` (don't rely on socket alone for persistence)

**Copyright-free song:**
1. `join-content` with `{ contentId: songId, contentType: "audio" }`
2. Listen for `copyright-free-song-interaction-updated`
3. HTTP: `POST /api/audio/copyright-free/:songId/view` on qualified play
