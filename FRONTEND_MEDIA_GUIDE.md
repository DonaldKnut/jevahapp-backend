# Frontend Media Integration Guide

## 🎯 **Core Endpoints**

### **1. Fetch ALL Media (No Auth)**

```javascript
GET https://jevahapp-backend.onrender.com/api/media/public/all-content
```

### **2. Fetch by Category (No Auth)**

```javascript
GET https://jevahapp-backend.onrender.com/api/media/public?category=worship
```

### **3. Authenticated Media (With Social Features)**

```javascript
GET https://jevahapp-backend.onrender.com/api/media/all-content
Headers: { Authorization: "Bearer YOUR_TOKEN" }
```

## ❤️ **Social Features Endpoints**

### **Like/Unlike (Favorite)**

```javascript
POST / api / media / { mediaId } / favorite;
Headers: {
  Authorization: "Bearer YOUR_TOKEN";
}
Body: {
  actionType: "favorite";
}
```

### **Save/Unsave (Bookmark)**

```javascript
POST / api / media / { mediaId } / save;
Headers: {
  Authorization: "Bearer YOUR_TOKEN";
}
```

### **Share**

```javascript
POST /api/media/{mediaId}/share
Headers: { Authorization: "Bearer YOUR_TOKEN" }
Body: { platform?: "facebook" | "twitter" | "whatsapp" }
```

### **Track View**

```javascript
POST /api/media/{mediaId}/track-view
Headers: { Authorization: "Bearer YOUR_TOKEN" }
Body: { duration: number, isComplete?: boolean }
```

### **Get User Action Status**

```javascript
GET / api / media / { mediaId } / action - status;
Headers: {
  Authorization: "Bearer YOUR_TOKEN";
}
```

## 🎨 **Media Item Structure**

```javascript
{
  "_id": "string",
  "title": "2 Hours time with God with Dunsin Oyekan",
  "contentType": "live", // videos|music|books|live|podcast
  "category": "worship", // worship|inspiration|youth|teachings
  "uploadedBy": {
    "firstName": "Minister Pius",
    "lastName": "Tagbas",
    "avatar": "url",
    "isVerified": true // Blue checkmark
  },
  "viewCount": 550,
  "likeCount": 600,
  "commentCount": 45,
  "shareCount": 900,
  "saveCount": 480,
  "isLive": true, // Red LIVE badge
  "userHasLiked": false, // When authenticated
  "userHasSaved": false
}
```

## 🚀 **React Native Implementation**

### **Fetch Media**

```javascript
const fetchAllMedia = async () => {
  const response = await fetch("/api/media/public/all-content");
  const data = await response.json();
  return data.media;
};
```

### **Toggle Like (Favorite)**

````javascript
const toggleLike = async (mediaId, token) => {
  const response = await fetch(`/api/media/${mediaId}/favorite`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ actionType: 'favorite' })
  });
  const data = await response.json();
  return data.action?.isFavorited || false;
};

### **Toggle Save (Bookmark)**
```javascript
const toggleSave = async (mediaId, token) => {
  const response = await fetch(`/api/media/${mediaId}/save`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json();
  return data.bookmark?.isBookmarked || false;
};
````

### **Share Media**

```javascript
const shareMedia = async (mediaId, token, platform = "whatsapp") => {
  const response = await fetch(`/api/media/${mediaId}/share`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ platform }),
  });
  const data = await response.json();
  return data.shareUrl;
};
```

### **Track View**

```javascript
const trackView = async (mediaId, token, duration, isComplete = false) => {
  const response = await fetch(`/api/media/${mediaId}/track-view`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ duration, isComplete }),
  });
  const data = await response.json();
  return data.countedAsView;
};
```

### **Get User Action Status**

```javascript
const getUserActionStatus = async (mediaId, token) => {
  const response = await fetch(`/api/media/${mediaId}/action-status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  return data.status; // { isFavorited: boolean, isShared: boolean }
};
```

### **Media Card Component**

```javascript
const MediaCard = ({ media, token }) => {
  const [isLiked, setIsLiked] = useState(media.userHasLiked);
  const [likeCount, setLikeCount] = useState(media.likeCount);

  const handleLike = async () => {
    const liked = await toggleLike(media._id, token);
    setIsLiked(liked);
    setLikeCount(prev => (liked ? prev + 1 : prev - 1));
  };

  return (
    <View style={styles.card}>
      {/* Live Indicator */}
      {media.isLive && (
        <View style={styles.liveBadge}>
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      )}

      {/* Media Content */}
      <Image source={{ uri: media.thumbnailUrl }} style={styles.thumbnail} />

      {/* User Info */}
      <View style={styles.userInfo}>
        <Image
          source={{ uri: media.uploadedBy.avatar }}
          style={styles.avatar}
        />
        <Text style={styles.userName}>
          {media.uploadedBy.firstName} {media.uploadedBy.lastName}
        </Text>
        {media.uploadedBy.isVerified && <Icon name="checkmark" />}
      </View>

      {/* Engagement Metrics */}
      <View style={styles.metrics}>
        <Text>👁️ {media.viewCount}</Text>
        <Text>📤 {media.shareCount}</Text>
        <Text>🔖 {media.saveCount}</Text>
        <Text>❤️ {likeCount}</Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity onPress={handleLike}>
          <Icon
            name={isLiked ? "heart" : "heart-outline"}
            color={isLiked ? "red" : "gray"}
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleComment(media._id)}>
          <Icon name="chatbubble-outline" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleShare(media._id)}>
          <Icon name="share-outline" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleSave(media._id)}>
          <Icon name={media.userHasSaved ? "bookmark" : "bookmark-outline"} />
        </TouchableOpacity>
      </View>
    </View>
  );
};
```

## 📱 **Usage Examples**

### **Main Feed**

```javascript
const MainFeed = () => {
  const [media, setMedia] = useState([]);

  useEffect(() => {
    fetchAllMedia().then(setMedia);
  }, []);

  return (
    <FlatList
      data={media}
      renderItem={({ item }) => <MediaCard media={item} token={userToken} />}
      keyExtractor={item => item._id}
    />
  );
};
```

### **Category Filter**

```javascript
const CategoryFeed = ({ category }) => {
  const [media, setMedia] = useState([]);

  useEffect(() => {
    fetch(`/api/media/public?category=${category}`)
      .then(res => res.json())
      .then(data => setMedia(data.media));
  }, [category]);

  return <FlatList data={media} renderItem={...} />;
};
```

## 🎯 **Key Points**

1. **Public endpoints** work without authentication
2. **Authenticated endpoints** include user interactions (likes, saves)
3. **Real-time updates** - update UI immediately, sync with server
4. **Error handling** - always handle network failures
5. **Loading states** - show spinners during API calls
6. **Optimistic updates** - update UI before server response

This will give you the social media interface shown in the reference image with all engagement features working!
