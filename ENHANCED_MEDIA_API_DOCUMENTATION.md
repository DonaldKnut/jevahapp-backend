# Enhanced Media API Documentation

## Overview

Enhanced media endpoints with author information, engagement metrics, and view tracking algorithm.

## Base URL

```
Production: https://jevahapp-backend.onrender.com
Development: http://localhost:3000
```

## Endpoints

### 1. Get All Media with Enhanced Data

**GET /api/media/all-content**

**Response:**

```json
{
  "success": true,
  "media": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "title": "Sunday Worship Service",
      "description": "Live worship service from our church",
      "contentType": "videos",
      "category": "worship",
      "fileUrl": "https://your-cloudflare-r2-domain.com/media-videos/video.mp4",
      "thumbnailUrl": "https://your-cloudflare-r2-domain.com/media-thumbnails/thumbnail.jpg",
      "topics": ["gospel", "worship", "praise"],
      "duration": 3600,
      "authorInfo": {
        "fullName": "John Doe",
        "avatar": "https://...",
        "section": "adults"
      },
      "totalLikes": 25,
      "totalShares": 8,
      "totalViews": 150,
      "createdAt": "2024-01-15T10:00:00.000Z"
    }
  ],
  "total": 150
}
```

### 2. Track View with Duration

**POST /api/media/track-view**

**Body:**

```json
{
  "mediaId": "507f1f77bcf86cd799439011",
  "duration": 45,
  "isComplete": false
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "countedAsView": true,
    "viewThreshold": 30,
    "duration": 45
  }
}
```

### 3. Get Media with Engagement

**GET /api/media/:mediaId/engagement**

**Response:**

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "title": "Sunday Worship Service",
    "description": "Live worship service from our church",
    "contentType": "videos",
    "category": "worship",
    "fileUrl": "https://your-cloudflare-r2-domain.com/media-videos/video.mp4",
    "thumbnailUrl": "https://your-cloudflare-r2-domain.com/media-thumbnails/thumbnail.jpg",
    "topics": ["gospel", "worship", "praise"],
    "duration": 3600,
    "authorInfo": {
      "fullName": "John Doe",
      "avatar": "https://...",
      "section": "adults"
    },
    "engagementMetrics": {
      "totalLikes": 25,
      "totalShares": 8,
      "totalViews": 150,
      "totalComments": 12
    },
    "userEngagement": {
      "hasLiked": true,
      "hasShared": false,
      "hasViewed": true
    }
  }
}
```

## View Counting Algorithm

- **Default Threshold**: 30 seconds minimum watch time
- **Configurable**: Each media can have custom threshold
- **Anti-Spam**: Prevents rapid-fire view inflation

## React Native Implementation

```javascript
// Media Service
class MediaService {
  async getAllMedia() {
    const token = await AsyncStorage.getItem("userToken");
    const response = await fetch("/api/media/all-content", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.json();
  }

  async trackView(mediaId, duration, isComplete = false) {
    const token = await AsyncStorage.getItem("userToken");
    const response = await fetch("/api/media/track-view", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ mediaId, duration, isComplete }),
    });
    return response.json();
  }
}

// Usage in component
const MediaListScreen = () => {
  const [media, setMedia] = useState([]);
  const mediaService = new MediaService();

  useEffect(() => {
    loadMedia();
  }, []);

  const loadMedia = async () => {
    try {
      const data = await mediaService.getAllMedia();
      setMedia(data.media);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const renderMediaItem = ({ item }) => (
    <View style={styles.mediaItem}>
      <Image
        source={{ uri: item.thumbnailUrl }}
        style={styles.thumbnail}
        resizeMode="cover"
      />
      <View style={styles.content}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.author}>
          {item.authorInfo?.fullName || "Unknown Author"}
        </Text>
        <View style={styles.metrics}>
          <Text style={styles.metric}>👁️ {item.totalViews || 0}</Text>
          <Text style={styles.metric}>❤️ {item.totalLikes || 0}</Text>
          <Text style={styles.metric}>📤 {item.totalShares || 0}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <FlatList
      data={media}
      renderItem={renderMediaItem}
      keyExtractor={item => item._id}
    />
  );
};
```

## Video Player with View Tracking

```javascript
const VideoPlayer = ({ mediaId, videoUrl }) => {
  const [viewStartTime, setViewStartTime] = useState(null);
  const [totalWatchTime, setTotalWatchTime] = useState(0);
  const mediaService = new MediaService();

  const handlePlaybackStatusUpdate = status => {
    if (status.isPlaying && !viewStartTime) {
      setViewStartTime(Date.now());
    } else if (!status.isPlaying && viewStartTime) {
      const watchTime = Math.floor((Date.now() - viewStartTime) / 1000);
      setTotalWatchTime(prev => prev + watchTime);
      setViewStartTime(null);
    }
  };

  const handlePlaybackFinish = async () => {
    if (viewStartTime) {
      const finalWatchTime = Math.floor((Date.now() - viewStartTime) / 1000);
      const totalDuration = totalWatchTime + finalWatchTime;

      try {
        await mediaService.trackView(mediaId, totalDuration, true);
      } catch (error) {
        console.error("Failed to track view:", error);
      }
    }
  };

  return (
    <Video
      source={{ uri: videoUrl }}
      onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
      onPlaybackFinish={handlePlaybackFinish}
    />
  );
};
```

## Error Handling

```javascript
const handleApiError = error => {
  if (error.response?.status === 401) {
    // Token expired - redirect to login
    AsyncStorage.removeItem("userToken");
    navigation.navigate("Login");
  } else {
    Alert.alert("Error", "Something went wrong. Please try again.");
  }
};
```

## Key Features

✅ **Author Information**: Full name, avatar, section  
✅ **Engagement Metrics**: Likes, shares, views, comments  
✅ **View Tracking**: Duration-based algorithm  
✅ **User Engagement**: Personal interaction status  
✅ **Media Thumbnails**: High-quality thumbnail images included  
✅ **Performance**: Aggregated queries  
✅ **Real-time**: Live engagement tracking

---

_Version: 2.0 - Enhanced Media API_
