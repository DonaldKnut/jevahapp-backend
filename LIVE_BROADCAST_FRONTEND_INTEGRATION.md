# Live Broadcast Frontend Integration Guide

## 🎥 **Overview**

This guide explains how to integrate with Jevah's live broadcast functionality, similar to Instagram Live, TikTok Live, or YouTube Live. The system supports real-time streaming with interactive features like comments, reactions, and viewer engagement.

## 🏗️ **Architecture Overview**

```
Frontend (React Native) ←→ WebSocket ←→ Backend ←→ Contabo Streaming Service
     ↓
Live Video Player (Expo AV) ←→ HLS/DASH Streams
```

## 📡 **API Endpoints**

### **Live Stream Management**

```javascript
// Start a live stream
POST /api/media/live/start
{
  "title": "My Live Stream",
  "description": "Join me for worship!",
  "category": "worship",
  "scheduledStart": "2024-01-15T20:00:00Z", // Optional
  "isPublic": true
}

// End a live stream
POST /api/media/live/{streamId}/end

// Get live stream status
GET /api/media/live/{streamId}/status

// Get all live streams
GET /api/media/live

// Join a live stream (WebSocket)
socket.emit('join-live-stream', { streamId: 'stream123' })
```

### **Real-Time Interactions**

```javascript
// Send comment to live stream
POST /api/media/live/{streamId}/comment
{
  "content": "Amazing worship! 🙏"
}

// Send reaction to live stream
POST /api/media/live/{streamId}/reaction
{
  "type": "heart" // heart, fire, prayer, amen
}

// Get live stream comments
GET /api/media/live/{streamId}/comments

// Get live stream reactions
GET /api/media/live/{streamId}/reactions
```

## 🎨 **UI Components Structure**

### **1. Live Stream Card (Preview)**

```jsx
import React from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const LiveStreamCard = ({ stream, onPress }) => {
  return (
    <TouchableOpacity
      className="bg-white rounded-lg shadow-md mb-4 overflow-hidden"
      onPress={() => onPress(stream)}
    >
      {/* Live Indicator */}
      <View className="absolute top-2 left-2 z-10">
        <View className="bg-red-500 px-2 py-1 rounded-full flex-row items-center">
          <View className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse" />
          <Text className="text-white text-xs font-bold">LIVE</Text>
        </View>
      </View>

      {/* Thumbnail */}
      <Image
        source={{ uri: stream.thumbnailUrl || stream.creator.avatar }}
        className="w-full h-48"
        resizeMode="cover"
      />

      {/* Stream Info */}
      <View className="p-4">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-lg font-bold text-gray-900">
            {stream.title}
          </Text>
          <View className="flex-row items-center">
            <Ionicons name="eye" size={16} color="#6B7280" />
            <Text className="text-sm text-gray-500 ml-1">
              {stream.concurrentViewers} watching
            </Text>
          </View>
        </View>

        <View className="flex-row items-center mb-2">
          <Image
            source={{ uri: stream.creator.avatar }}
            className="w-6 h-6 rounded-full mr-2"
          />
          <Text className="text-sm text-gray-700">
            {stream.creator.firstName} {stream.creator.lastName}
          </Text>
        </View>

        <Text className="text-sm text-gray-600" numberOfLines={2}>
          {stream.description}
        </Text>
      </View>
    </TouchableOpacity>
  );
};
```

### **2. Live Stream Player (Main View)**

```jsx
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from "react-native";
import { Video, ResizeMode } from "expo-av";
import { Ionicons, MaterialIcons, FontAwesome } from "@expo/vector-icons";
import io from "socket.io-client";

const LiveStreamPlayer = ({ streamId, onClose }) => {
  const [isLive, setIsLive] = useState(true);
  const [viewerCount, setViewerCount] = useState(0);
  const [comments, setComments] = useState([]);
  const [reactions, setReactions] = useState({});
  const [isMuted, setIsMuted] = useState(false);
  const [showComments, setShowComments] = useState(true);
  const [newComment, setNewComment] = useState("");
  const socket = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    // Connect to WebSocket
    socket.current = io("YOUR_WEBSOCKET_URL");

    // Join live stream room
    socket.current.emit("join-live-stream", { streamId });

    // Listen for real-time updates
    socket.current.on("viewer-count-update", count => {
      setViewerCount(count);
    });

    socket.current.on("new-comment", comment => {
      setComments(prev => [...prev, comment]);
    });

    socket.current.on("new-reaction", reaction => {
      setReactions(prev => ({
        ...prev,
        [reaction.type]: (prev[reaction.type] || 0) + 1,
      }));
    });

    socket.current.on("stream-ended", () => {
      setIsLive(false);
    });

    return () => {
      socket.current?.disconnect();
    };
  }, [streamId]);

  const sendComment = () => {
    if (newComment.trim()) {
      socket.current.emit("send-comment", {
        streamId,
        content: newComment,
      });
      setNewComment("");
    }
  };

  const sendReaction = type => {
    socket.current.emit("send-reaction", {
      streamId,
      type,
    });
  };

  return (
    <View className="flex-1 bg-black">
      {/* Video Player */}
      <View className="flex-1 relative">
        <Video
          ref={videoRef}
          source={{ uri: stream.playbackUrl }}
          style={{ flex: 1 }}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay={true}
          isMuted={isMuted}
          isLooping={false}
        />

        {/* Live Indicator */}
        <View className="absolute top-12 left-4">
          <View className="bg-red-500 px-3 py-1 rounded-full flex-row items-center">
            <View className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse" />
            <Text className="text-white text-sm font-bold">LIVE</Text>
          </View>
        </View>

        {/* Viewer Count */}
        <View className="absolute top-12 right-4">
          <View className="bg-black/50 px-3 py-1 rounded-full flex-row items-center">
            <Ionicons name="eye" size={16} color="white" />
            <Text className="text-white text-sm ml-1">{viewerCount}</Text>
          </View>
        </View>

        {/* Top Controls */}
        <View className="absolute top-20 left-4 right-4 flex-row justify-between">
          <TouchableOpacity
            className="bg-black/50 p-2 rounded-full"
            onPress={onClose}
          >
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-black/50 p-2 rounded-full"
            onPress={() => setIsMuted(!isMuted)}
          >
            <Ionicons
              name={isMuted ? "volume-mute" : "volume-high"}
              size={24}
              color="white"
            />
          </TouchableOpacity>
        </View>

        {/* Bottom Controls */}
        <View className="absolute bottom-20 right-4 flex-col space-y-4">
          {/* Reactions */}
          <TouchableOpacity
            className="bg-black/50 p-3 rounded-full"
            onPress={() => sendReaction("heart")}
          >
            <Ionicons name="heart" size={24} color="white" />
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-black/50 p-3 rounded-full"
            onPress={() => sendReaction("fire")}
          >
            <Ionicons name="flame" size={24} color="white" />
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-black/50 p-3 rounded-full"
            onPress={() => sendReaction("prayer")}
          >
            <FontAwesome name="pray" size={24} color="white" />
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-black/50 p-3 rounded-full"
            onPress={() => sendReaction("amen")}
          >
            <Text className="text-white text-lg font-bold">Amen</Text>
          </TouchableOpacity>

          {/* Comments Toggle */}
          <TouchableOpacity
            className="bg-black/50 p-3 rounded-full"
            onPress={() => setShowComments(!showComments)}
          >
            <Ionicons
              name={showComments ? "chatbubble" : "chatbubble-outline"}
              size={24}
              color="white"
            />
          </TouchableOpacity>
        </View>

        {/* Reaction Animations */}
        {Object.entries(reactions).map(([type, count]) => (
          <View key={type} className="absolute bottom-32 right-4">
            <View className="bg-red-500 px-2 py-1 rounded-full">
              <Text className="text-white text-xs">{count}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Comments Section */}
      {showComments && (
        <View className="h-64 bg-white/90">
          <View className="p-4 border-b border-gray-200">
            <Text className="text-lg font-bold">Live Comments</Text>
          </View>

          <ScrollView className="flex-1 p-4">
            {comments.map((comment, index) => (
              <View key={index} className="mb-3">
                <View className="flex-row items-center mb-1">
                  <Image
                    source={{ uri: comment.user.avatar }}
                    className="w-6 h-6 rounded-full mr-2"
                  />
                  <Text className="text-sm font-semibold text-gray-800">
                    {comment.user.firstName} {comment.user.lastName}
                  </Text>
                  <Text className="text-xs text-gray-500 ml-2">
                    {new Date(comment.timestamp).toLocaleTimeString()}
                  </Text>
                </View>
                <Text className="text-sm text-gray-700 ml-8">
                  {comment.content}
                </Text>
              </View>
            ))}
          </ScrollView>

          {/* Comment Input */}
          <View className="p-4 border-t border-gray-200 flex-row items-center">
            <TextInput
              value={newComment}
              onChangeText={setNewComment}
              placeholder="Add a comment..."
              className="flex-1 border border-gray-300 rounded-full px-4 py-2 mr-2"
              multiline={false}
            />
            <TouchableOpacity
              className="bg-blue-500 p-2 rounded-full"
              onPress={sendComment}
            >
              <Ionicons name="send" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};
```

### **3. Live Stream Creator Controls**

```jsx
import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";

const LiveStreamCreatorControls = ({ streamId, onEndStream }) => {
  const [isLive, setIsLive] = useState(true);
  const [viewerCount, setViewerCount] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatDuration = seconds => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleEndStream = () => {
    Alert.alert(
      "End Live Stream",
      "Are you sure you want to end this live stream?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "End Stream",
          style: "destructive",
          onPress: onEndStream,
        },
      ]
    );
  };

  return (
    <View className="absolute top-12 left-4 right-4 flex-row justify-between items-center">
      {/* Live Status */}
      <View className="flex-row items-center">
        <View className="bg-red-500 px-3 py-1 rounded-full flex-row items-center mr-3">
          <View className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse" />
          <Text className="text-white text-sm font-bold">LIVE</Text>
        </View>
        <Text className="text-white text-sm">{formatDuration(duration)}</Text>
      </View>

      {/* Viewer Count */}
      <View className="flex-row items-center">
        <Ionicons name="eye" size={16} color="white" />
        <Text className="text-white text-sm ml-1">{viewerCount} watching</Text>
      </View>

      {/* Creator Controls */}
      <View className="flex-row space-x-2">
        <TouchableOpacity className="bg-black/50 p-2 rounded-full">
          <Ionicons name="settings" size={20} color="white" />
        </TouchableOpacity>

        <TouchableOpacity
          className="bg-red-500 p-2 rounded-full"
          onPress={handleEndStream}
        >
          <Ionicons name="stop" size={20} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
};
```

### **4. Live Stream List**

```jsx
import React, { useState, useEffect } from "react";
import { View, Text, FlatList, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const LiveStreamList = ({ onStreamPress }) => {
  const [liveStreams, setLiveStreams] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLiveStreams = async () => {
    try {
      const response = await fetch("/api/media/live", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await response.json();

      if (data.success) {
        setLiveStreams(data.streams);
      }
    } catch (error) {
      console.error("Failed to fetch live streams:", error);
    }
  };

  useEffect(() => {
    fetchLiveStreams();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLiveStreams();
    setRefreshing(false);
  };

  const renderLiveStream = ({ item }) => (
    <LiveStreamCard stream={item} onPress={onStreamPress} />
  );

  return (
    <View className="flex-1 bg-gray-50">
      <View className="p-4 border-b border-gray-200">
        <Text className="text-2xl font-bold text-gray-900">Live Now</Text>
        <Text className="text-gray-600 mt-1">
          {liveStreams.length} active streams
        </Text>
      </View>

      <FlatList
        data={liveStreams}
        renderItem={renderLiveStream}
        keyExtractor={item => item._id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center py-20">
            <Ionicons name="radio-outline" size={64} color="#9CA3AF" />
            <Text className="text-gray-500 text-lg mt-4">
              No live streams right now
            </Text>
            <Text className="text-gray-400 text-sm mt-2">
              Check back later for live content
            </Text>
          </View>
        }
      />
    </View>
  );
};
```

## 🔌 **WebSocket Integration**

### **Socket.IO Setup**

```javascript
import io from "socket.io-client";

class LiveStreamSocket {
  constructor() {
    this.socket = null;
    this.isConnected = false;
  }

  connect(token) {
    this.socket = io("YOUR_WEBSOCKET_URL", {
      auth: {
        token,
      },
    });

    this.socket.on("connect", () => {
      this.isConnected = true;
      console.log("Connected to live stream socket");
    });

    this.socket.on("disconnect", () => {
      this.isConnected = false;
      console.log("Disconnected from live stream socket");
    });

    return this.socket;
  }

  joinStream(streamId) {
    if (this.socket) {
      this.socket.emit("join-live-stream", { streamId });
    }
  }

  leaveStream(streamId) {
    if (this.socket) {
      this.socket.emit("leave-live-stream", { streamId });
    }
  }

  sendComment(streamId, content) {
    if (this.socket) {
      this.socket.emit("send-comment", { streamId, content });
    }
  }

  sendReaction(streamId, type) {
    if (this.socket) {
      this.socket.emit("send-reaction", { streamId, type });
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export default new LiveStreamSocket();
```

### **Real-Time Event Listeners**

```javascript
// In your LiveStreamPlayer component
useEffect(() => {
  const socket = liveStreamSocket.connect(token);

  // Join stream room
  liveStreamSocket.joinStream(streamId);

  // Listen for real-time updates
  socket.on("viewer-count-update", data => {
    setViewerCount(data.count);
  });

  socket.on("new-comment", comment => {
    setComments(prev => [...prev, comment]);
  });

  socket.on("new-reaction", reaction => {
    setReactions(prev => ({
      ...prev,
      [reaction.type]: (prev[reaction.type] || 0) + 1,
    }));
  });

  socket.on("stream-ended", () => {
    setIsLive(false);
    Alert.alert("Stream Ended", "The live stream has ended.");
  });

  socket.on("user-joined", user => {
    // Show user joined notification
    showNotification(`${user.firstName} joined the stream`);
  });

  socket.on("user-left", user => {
    // Show user left notification
    showNotification(`${user.firstName} left the stream`);
  });

  return () => {
    liveStreamSocket.leaveStream(streamId);
    liveStreamSocket.disconnect();
  };
}, [streamId]);
```

## 🎨 **UI/UX Best Practices**

### **1. Loading States**

```jsx
const LiveStreamLoading = () => (
  <View className="flex-1 bg-black justify-center items-center">
    <View className="animate-spin rounded-full h-16 w-16 border-b-2 border-white"></View>
    <Text className="text-white text-lg mt-4">
      Connecting to live stream...
    </Text>
  </View>
);
```

### **2. Error Handling**

```jsx
const LiveStreamError = ({ error, onRetry }) => (
  <View className="flex-1 bg-black justify-center items-center p-8">
    <Ionicons name="warning" size={64} color="#EF4444" />
    <Text className="text-white text-lg mt-4 text-center">
      Failed to load live stream
    </Text>
    <Text className="text-gray-400 text-sm mt-2 text-center">
      {error.message}
    </Text>
    <TouchableOpacity
      className="bg-blue-500 px-6 py-3 rounded-full mt-6"
      onPress={onRetry}
    >
      <Text className="text-white font-semibold">Try Again</Text>
    </TouchableOpacity>
  </View>
);
```

### **3. Network Status Indicator**

```jsx
const NetworkStatus = ({ isConnected, quality }) => (
  <View className="absolute top-16 left-4 bg-black/50 px-2 py-1 rounded-full">
    <View className="flex-row items-center">
      <View
        className={`w-2 h-2 rounded-full mr-1 ${
          isConnected ? "bg-green-500" : "bg-red-500"
        }`}
      />
      <Text className="text-white text-xs">
        {isConnected ? quality : "Disconnected"}
      </Text>
    </View>
  </View>
);
```

## 📱 **Complete Integration Example**

```jsx
import React, { useState, useEffect } from "react";
import { View, Modal } from "react-native";
import LiveStreamList from "./components/LiveStreamList";
import LiveStreamPlayer from "./components/LiveStreamPlayer";
import LiveStreamSocket from "./utils/LiveStreamSocket";

const LiveStreamScreen = () => {
  const [selectedStream, setSelectedStream] = useState(null);
  const [isPlayerVisible, setIsPlayerVisible] = useState(false);

  const handleStreamPress = stream => {
    setSelectedStream(stream);
    setIsPlayerVisible(true);
  };

  const handleClosePlayer = () => {
    setIsPlayerVisible(false);
    setSelectedStream(null);
  };

  return (
    <View className="flex-1">
      <LiveStreamList onStreamPress={handleStreamPress} />

      <Modal
        visible={isPlayerVisible}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        {selectedStream && (
          <LiveStreamPlayer
            streamId={selectedStream._id}
            onClose={handleClosePlayer}
          />
        )}
      </Modal>
    </View>
  );
};

export default LiveStreamScreen;
```

## 🚀 **Deployment Checklist**

### **Frontend Requirements**

- [ ] Install Socket.IO client: `npm install socket.io-client`
- [ ] Install Expo AV for video playback: `expo install expo-av`
- [ ] Configure WebSocket URL in environment variables
- [ ] Test on both iOS and Android devices
- [ ] Implement proper error handling and retry logic
- [ ] Add loading states and skeleton screens
- [ ] Test network connectivity handling

### **Performance Optimizations**

- [ ] Implement comment pagination (load last 50 comments)
- [ ] Debounce reaction animations
- [ ] Optimize video player settings for mobile
- [ ] Implement proper cleanup on component unmount
- [ ] Add offline detection and reconnection logic

### **Testing Scenarios**

- [ ] Join/leave live stream
- [ ] Send comments and reactions
- [ ] Handle network disconnection
- [ ] Test with multiple concurrent viewers
- [ ] Verify real-time updates work correctly
- [ ] Test stream ending scenarios

## 📚 **Additional Resources**

- [Expo AV Documentation](https://docs.expo.dev/versions/latest/sdk/av/)
- [Socket.IO Client Documentation](https://socket.io/docs/v4/client-api/)
- [React Native Video Best Practices](https://reactnative.dev/docs/performance#my-images-are-slow-to-load)

This integration provides a complete live streaming experience similar to major social media platforms, with real-time interactions and smooth video playback.
