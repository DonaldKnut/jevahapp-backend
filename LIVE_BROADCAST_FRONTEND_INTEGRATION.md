# Live Broadcast Frontend Integration Guide

## Overview

This guide provides comprehensive instructions for integrating live broadcasting functionality into the Jevah frontend application.

## API Endpoints

### 1. Go Live (Immediate Streaming)

**Endpoint:** `POST /api/media/live/go-live`

**Description:** Start live streaming immediately with minimal required information.

**Request Body:**

```json
{
  "title": "My Live Stream",
  "description": "Optional description"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Live stream started successfully",
  "stream": {
    "streamKey": "your-stream-key",
    "rtmpUrl": "rtmp://your-rtmp-url",
    "playbackUrl": "https://your-playback-url",
    "hlsUrl": "https://your-hls-url",
    "dashUrl": "https://your-dash-url",
    "streamId": "stream-id"
  }
}
```

### 2. Start Live Stream (Scheduled)

**Endpoint:** `POST /api/media/live/start`

**Description:** Start a new live stream with full configuration.

**Request Body:**

```json
{
  "title": "Scheduled Gospel Service",
  "description": "Sunday morning service",
  "category": "worship",
  "topics": ["gospel", "sunday-service"]
}
```

**Response:**

```json
{
  "success": true,
  "message": "Live stream started successfully",
  "stream": {
    "streamKey": "your-stream-key",
    "rtmpUrl": "rtmp://your-rtmp-url",
    "playbackUrl": "https://your-playback-url",
    "hlsUrl": "https://your-hls-url",
    "dashUrl": "https://your-dash-url",
    "streamId": "stream-id"
  }
}
```

### 3. Schedule Live Stream

**Endpoint:** `POST /api/media/live/schedule`

**Description:** Schedule a live stream for future broadcast.

**Request Body:**

```json
{
  "title": "Scheduled Gospel Service",
  "description": "Sunday morning service",
  "category": "worship",
  "topics": ["gospel", "sunday-service"],
  "scheduledStart": "2025-08-11T10:00:00.000Z",
  "scheduledEnd": "2025-08-11T12:00:00.000Z"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Live stream scheduled successfully",
  "stream": {
    "streamKey": "your-stream-key",
    "rtmpUrl": "rtmp://your-rtmp-url",
    "playbackUrl": "https://your-playback-url",
    "hlsUrl": "https://your-hls-url",
    "dashUrl": "https://your-dash-url",
    "streamId": "stream-id"
  }
}
```

### 4. End Live Stream

**Endpoint:** `POST /api/media/live/:id/end`

**Description:** End an active live stream.

**Response:**

```json
{
  "success": true,
  "message": "Live stream ended successfully"
}
```

### 5. Get Live Streams

**Endpoint:** `GET /api/media/live`

**Description:** Retrieve all active live streams.

**Response:**

```json
{
  "success": true,
  "streams": [
    {
      "id": "stream-id",
      "title": "Live Stream Title",
      "description": "Description",
      "isLive": true,
      "viewerCount": 150,
      "startedAt": "2025-08-11T10:00:00.000Z"
    }
  ]
}
```

### 6. Get Stream Status

**Endpoint:** `GET /api/media/live/:streamId/status`

**Description:** Get live stream status and viewer count.

**Response:**

```json
{
  "success": true,
  "status": {
    "isLive": true,
    "viewerCount": 150,
    "startedAt": "2025-08-11T10:00:00.000Z",
    "duration": 3600
  }
}
```

### 7. Get Stream Statistics

**Endpoint:** `GET /api/media/live/:streamId/stats`

**Description:** Get detailed live stream statistics.

**Response:**

```json
{
  "success": true,
  "stats": {
    "totalViewers": 500,
    "peakViewers": 200,
    "averageWatchTime": 1800,
    "totalDuration": 7200
  }
}
```

## Frontend Integration

### Using Jevah JS SDK

```typescript
import { JevahClient } from "@jevah/jevah-js-sdk";

const client = new JevahClient({
  baseURL: "https://your-api-url.com",
  token: "your-auth-token",
});

// Go Live (Immediate)
const goLive = async () => {
  try {
    const response = await client.goLive({
      title: "My Live Stream",
      description: "Optional description",
    });

    console.log("Stream started:", response.stream);
    // Use response.stream.streamKey for broadcasting
    // Use response.stream.playbackUrl for viewing
  } catch (error) {
    console.error("Failed to go live:", error);
  }
};

// Start Live Stream (Scheduled)
const startLiveStream = async () => {
  try {
    const response = await client.startLiveStream({
      title: "Scheduled Service",
      description: "Sunday service",
      category: "worship",
      topics: ["gospel", "service"],
    });

    console.log("Stream started:", response.stream);
  } catch (error) {
    console.error("Failed to start stream:", error);
  }
};

// Schedule Live Stream
const scheduleLiveStream = async () => {
  try {
    const response = await client.scheduleLiveStream({
      title: "Future Service",
      description: "Next Sunday service",
      category: "worship",
      topics: ["gospel", "service"],
      scheduledStart: "2025-08-18T10:00:00.000Z",
      scheduledEnd: "2025-08-18T12:00:00.000Z",
    });

    console.log("Stream scheduled:", response.stream);
  } catch (error) {
    console.error("Failed to schedule stream:", error);
  }
};

// End Live Stream
const endLiveStream = async (streamId: string) => {
  try {
    await client.endLiveStream(streamId);
    console.log("Stream ended successfully");
  } catch (error) {
    console.error("Failed to end stream:", error);
  }
};

// Get Live Streams
const getLiveStreams = async () => {
  try {
    const response = await client.getLiveStreams();
    console.log("Active streams:", response.streams);
  } catch (error) {
    console.error("Failed to get streams:", error);
  }
};

// Get Stream Status
const getStreamStatus = async (streamId: string) => {
  try {
    const response = await client.getStreamStatus(streamId);
    console.log("Stream status:", response.status);
  } catch (error) {
    console.error("Failed to get status:", error);
  }
};

// Get Stream Statistics
const getStreamStats = async (streamId: string) => {
  try {
    const response = await client.getStreamStats(streamId);
    console.log("Stream stats:", response.stats);
  } catch (error) {
    console.error("Failed to get stats:", error);
  }
};
```

### Direct API Calls

```typescript
// Go Live (Immediate)
const goLive = async () => {
  const response = await fetch("/api/media/live/go-live", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      title: "My Live Stream",
      description: "Optional description",
    }),
  });

  const data = await response.json();
  return data;
};

// Start Live Stream (Scheduled)
const startLiveStream = async () => {
  const response = await fetch("/api/media/live/start", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      title: "Scheduled Service",
      description: "Sunday service",
      category: "worship",
      topics: ["gospel", "service"],
    }),
  });

  const data = await response.json();
  return data;
};
```

## Broadcasting Setup

### Using OBS Studio

1. Open OBS Studio
2. Go to Settings > Stream
3. Set Service to "Custom"
4. Enter the `rtmpUrl` from the API response
5. Enter the `streamKey` from the API response
6. Click "Start Streaming"

### Using Streamlabs

1. Open Streamlabs
2. Go to Settings > Stream
3. Set Service to "Custom RTMP"
4. Enter the `rtmpUrl` from the API response
5. Enter the `streamKey` from the API response
6. Click "Go Live"

## Viewing Live Streams

### Web Player Integration

```html
<video id="videoPlayer" controls>
  <source src="PLAYBACK_URL_FROM_API" type="application/x-mpegURL" />
  Your browser does not support the video tag.
</video>
```

### Using HLS.js

```javascript
import Hls from "hls.js";

const video = document.getElementById("videoPlayer");
const playbackUrl = "PLAYBACK_URL_FROM_API";

if (Hls.isSupported()) {
  const hls = new Hls();
  hls.loadSource(playbackUrl);
  hls.attachMedia(video);
} else if (video.canPlayType("application/vnd.apple.mpegurl")) {
  video.src = playbackUrl;
}
```

## Error Handling

### Common Error Responses

```json
{
  "success": false,
  "message": "Unauthorized: User not authenticated"
}
```

```json
{
  "success": false,
  "message": "Title is required for live stream"
}
```

```json
{
  "success": false,
  "message": "Failed to start live stream"
}
```

### Error Handling Example

```typescript
const handleGoLive = async () => {
  try {
    const response = await client.goLive({
      title: "My Stream",
    });

    if (response.success) {
      // Handle success
      console.log("Stream started:", response.stream);
    } else {
      // Handle API error
      console.error("API Error:", response.message);
    }
  } catch (error) {
    // Handle network/other errors
    console.error("Network Error:", error);
  }
};
```

## Best Practices

1. **Always validate user authentication** before attempting to start a stream
2. **Handle errors gracefully** and provide user-friendly error messages
3. **Store stream credentials securely** and don't expose them in client-side code
4. **Implement proper cleanup** when streams end or fail
5. **Monitor stream health** using the status and stats endpoints
6. **Provide fallback options** for different streaming scenarios

## Testing

### Test the Go Live Endpoint

```bash
curl -X POST https://your-api-url.com/api/media/live/go-live \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "title": "Test Live Stream",
    "description": "Testing the go live functionality"
  }'
```

### Test Stream Status

```bash
curl -X GET https://your-api-url.com/api/media/live/STREAM_ID/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Troubleshooting

### Common Issues

1. **Authentication Errors**: Ensure the user is properly authenticated
2. **Missing Title**: The title field is required for all live streams
3. **Network Issues**: Check API connectivity and CORS settings
4. **Stream Key Issues**: Verify the stream key is correctly configured in broadcasting software

### Debug Steps

1. Check browser console for JavaScript errors
2. Verify API responses in Network tab
3. Test endpoints with Postman or curl
4. Check server logs for backend errors
