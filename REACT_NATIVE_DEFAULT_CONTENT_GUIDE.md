# React Native Default Content Integration Guide

## 🎯 **Overview**

This guide provides complete instructions for React Native developers to integrate and consume the default gospel media content endpoints. The system provides pre-loaded Nigerian gospel content (music, sermons, devotionals, e-books) that users see immediately when they join the app.

## 📡 **Available Endpoints**

### 1. **Public Default Content (No Authentication Required)**

**Endpoint:** `GET /api/media/default`

**Description:** Retrieve default gospel media content without requiring user authentication. Perfect for onboarding screens and public content display.

**Query Parameters:**

- `contentType` (optional): Filter by content type (`music`, `videos`, `audio`, `books`, `sermon`, `devotional`, `ebook`)
- `limit` (optional): Number of items to return (default: 10, max: 50)

**Base URL:** `https://jevahapp-backend.onrender.com`

### 2. **Authenticated Onboarding Content (Requires Authentication)**

**Endpoint:** `GET /api/media/onboarding`

**Description:** Get curated onboarding content experience with organized sections for new users.

**Headers Required:**

- `Authorization: Bearer YOUR_TOKEN`
- `Content-Type: application/json`

## 🚀 **React Native Implementation**

### **1. Basic Setup**

First, create a service file for API calls:

```typescript
// services/defaultContentService.ts
const BASE_URL = "https://jevahapp-backend.onrender.com";

export interface DefaultContentResponse {
  success: boolean;
  message: string;
  data: {
    total: number;
    grouped: {
      music: MediaItem[];
      videos: MediaItem[];
      audio: MediaItem[];
      books: MediaItem[];
      shortClips: MediaItem[];
    };
    all: MediaItem[];
  };
}

export interface OnboardingResponse {
  success: boolean;
  message: string;
  data: {
    welcome: ContentSection;
    quickStart: ContentSection;
    featured: ContentSection;
    devotionals: ContentSection;
  };
}

export interface MediaItem {
  _id: string;
  title: string;
  description?: string;
  contentType:
    | "music"
    | "videos"
    | "audio"
    | "books"
    | "sermon"
    | "devotional"
    | "ebook";
  category?: string;
  fileUrl: string;
  thumbnailUrl?: string;
  duration?: number;
  uploadedBy: {
    _id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
    isVerified?: boolean;
  };
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContentSection {
  title: string;
  subtitle: string;
  content: MediaItem[];
}

// Fetch public default content
export const fetchDefaultContent = async (
  contentType?: string,
  limit: number = 10
): Promise<DefaultContentResponse> => {
  try {
    const params = new URLSearchParams();
    if (contentType) params.append("contentType", contentType);
    params.append("limit", limit.toString());

    const response = await fetch(`${BASE_URL}/api/media/default?${params}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching default content:", error);
    throw error;
  }
};

// Fetch authenticated onboarding content
export const fetchOnboardingContent = async (
  token: string
): Promise<OnboardingResponse> => {
  try {
    const response = await fetch(`${BASE_URL}/api/media/onboarding`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching onboarding content:", error);
    throw error;
  }
};
```

### **2. Custom React Hooks**

Create reusable hooks for managing default content:

```typescript
// hooks/useDefaultContent.ts
import { useState, useEffect } from "react";
import {
  fetchDefaultContent,
  DefaultContentResponse,
} from "../services/defaultContentService";

export const useDefaultContent = (contentType?: string, limit: number = 10) => {
  const [data, setData] = useState<DefaultContentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadContent = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchDefaultContent(contentType, limit);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load content");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContent();
  }, [contentType, limit]);

  return { data, loading, error, refetch: loadContent };
};

// hooks/useOnboardingContent.ts
import { useState, useEffect } from "react";
import {
  fetchOnboardingContent,
  OnboardingResponse,
} from "../services/defaultContentService";

export const useOnboardingContent = (token: string | null) => {
  const [data, setData] = useState<OnboardingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOnboardingContent = async () => {
    if (!token) {
      setError("Authentication token required");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await fetchOnboardingContent(token);
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load onboarding content"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadOnboardingContent();
    }
  }, [token]);

  return { data, loading, error, refetch: loadOnboardingContent };
};
```

### **3. Media Card Component**

Create a reusable media card component:

```typescript
// components/DefaultMediaCard.tsx
import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { MediaItem } from '../services/defaultContentService';

interface DefaultMediaCardProps {
  media: MediaItem;
  onPress: (media: MediaItem) => void;
  onPlay?: (media: MediaItem) => void;
}

const { width } = Dimensions.get('window');
const cardWidth = (width - 45) / 2; // 2 columns with margins

export const DefaultMediaCard: React.FC<DefaultMediaCardProps> = ({
  media,
  onPress,
  onPlay,
}) => {
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(media)}
      activeOpacity={0.8}
    >
      {/* Thumbnail */}
      <View style={styles.thumbnailContainer}>
        <Image
          source={{ uri: media.thumbnailUrl || media.fileUrl }}
          style={styles.thumbnail}
          resizeMode="cover"
        />

        {/* Duration Badge */}
        {media.duration && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>
              {formatDuration(media.duration)}
            </Text>
          </View>
        )}

        {/* Play Button Overlay */}
        {onPlay && (
          <TouchableOpacity
            style={styles.playButton}
            onPress={() => onPlay(media)}
          >
            <Text style={styles.playIcon}>▶</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content Info */}
      <View style={styles.contentInfo}>
        <Text style={styles.title} numberOfLines={2}>
          {media.title}
        </Text>

        {media.description && (
          <Text style={styles.description} numberOfLines={2}>
            {media.description}
          </Text>
        )}

        {/* Creator Info */}
        <View style={styles.creatorInfo}>
          <Image
            source={{ uri: media.uploadedBy.avatar }}
            style={styles.creatorAvatar}
          />
          <Text style={styles.creatorName}>
            {media.uploadedBy.firstName} {media.uploadedBy.lastName}
          </Text>
          {media.uploadedBy.isVerified && (
            <Text style={styles.verifiedIcon}>✓</Text>
          )}
        </View>

        {/* Engagement Stats */}
        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Text style={styles.statIcon}>👁️</Text>
            <Text style={styles.statText}>{formatCount(media.viewCount)}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statIcon}>❤️</Text>
            <Text style={styles.statText}>{formatCount(media.likeCount)}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statIcon}>💬</Text>
            <Text style={styles.statText}>{formatCount(media.commentCount)}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: cardWidth,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  thumbnailContainer: {
    position: 'relative',
    width: '100%',
    height: cardWidth * 0.75,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -20 }, { translateY: -20 }],
    width: 40,
    height: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 2,
  },
  contentInfo: {
    padding: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  description: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  creatorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  creatorAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
  },
  creatorName: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  verifiedIcon: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 12,
    marginRight: 2,
  },
  statText: {
    fontSize: 11,
    color: '#666',
  },
});
```

### **4. Content Section Component**

Create a component for displaying content sections:

```typescript
// components/ContentSection.tsx
import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { DefaultMediaCard } from './DefaultMediaCard';
import { MediaItem } from '../services/defaultContentService';

interface ContentSectionProps {
  title: string;
  subtitle: string;
  content: MediaItem[];
  onMediaPress: (media: MediaItem) => void;
  onMediaPlay?: (media: MediaItem) => void;
  onViewAll?: () => void;
}

export const ContentSection: React.FC<ContentSectionProps> = ({
  title,
  subtitle,
  content,
  onMediaPress,
  onMediaPlay,
  onViewAll,
}) => {
  const renderMediaItem = ({ item }: { item: MediaItem }) => (
    <DefaultMediaCard
      media={item}
      onPress={onMediaPress}
      onPlay={onMediaPlay}
    />
  );

  if (!content || content.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        {onViewAll && (
          <TouchableOpacity onPress={onViewAll} style={styles.viewAllButton}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content Grid */}
      <FlatList
        data={content}
        renderItem={renderMediaItem}
        keyExtractor={(item) => item._id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 15,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  viewAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#007AFF',
    borderRadius: 16,
  },
  viewAllText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  row: {
    justifyContent: 'space-between',
    paddingHorizontal: 15,
  },
});
```

### **5. Main Screens Implementation**

#### **Onboarding Screen**

```typescript
// screens/OnboardingScreen.tsx
import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Text,
  Alert,
} from 'react-native';
import { useOnboardingContent } from '../hooks/useOnboardingContent';
import { ContentSection } from '../components/ContentSection';
import { MediaItem } from '../services/defaultContentService';

interface OnboardingScreenProps {
  userToken: string;
  onMediaPress: (media: MediaItem) => void;
  onMediaPlay: (media: MediaItem) => void;
  onComplete: () => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  userToken,
  onMediaPress,
  onMediaPlay,
  onComplete,
}) => {
  const { data, loading, error } = useOnboardingContent(userToken);

  const handleViewAll = (sectionType: string) => {
    // Navigate to full content view for this section
    console.log(`View all ${sectionType} content`);
  };

  const handleMediaPress = (media: MediaItem) => {
    onMediaPress(media);
  };

  const handleMediaPlay = (media: MediaItem) => {
    onMediaPlay(media);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading your spiritual journey...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load content</Text>
        <Text style={styles.errorSubtext}>{error}</Text>
      </View>
    );
  }

  if (!data?.success) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>No content available</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Welcome Section */}
      <ContentSection
        title={data.data.welcome.title}
        subtitle={data.data.welcome.subtitle}
        content={data.data.welcome.content}
        onMediaPress={handleMediaPress}
        onMediaPlay={handleMediaPlay}
        onViewAll={() => handleViewAll('welcome')}
      />

      {/* Quick Start Section */}
      <ContentSection
        title={data.data.quickStart.title}
        subtitle={data.data.quickStart.subtitle}
        content={data.data.quickStart.content}
        onMediaPress={handleMediaPress}
        onMediaPlay={handleMediaPlay}
        onViewAll={() => handleViewAll('quickStart')}
      />

      {/* Featured Content */}
      <ContentSection
        title={data.data.featured.title}
        subtitle={data.data.featured.subtitle}
        content={data.data.featured.content}
        onMediaPress={handleMediaPress}
        onMediaPlay={handleMediaPlay}
        onViewAll={() => handleViewAll('featured')}
      />

      {/* Devotionals */}
      <ContentSection
        title={data.data.devotionals.title}
        subtitle={data.data.devotionals.subtitle}
        content={data.data.devotionals.content}
        onMediaPress={handleMediaPress}
        onMediaPlay={handleMediaPlay}
        onViewAll={() => handleViewAll('devotionals')}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
```

#### **Default Content Screen (Public)**

```typescript
// screens/DefaultContentScreen.tsx
import React, { useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useDefaultContent } from '../hooks/useDefaultContent';
import { DefaultMediaCard } from '../components/DefaultMediaCard';
import { MediaItem } from '../services/defaultContentService';

interface DefaultContentScreenProps {
  onMediaPress: (media: MediaItem) => void;
  onMediaPlay: (media: MediaItem) => void;
}

export const DefaultContentScreen: React.FC<DefaultContentScreenProps> = ({
  onMediaPress,
  onMediaPlay,
}) => {
  const [selectedType, setSelectedType] = useState<string | undefined>();
  const { data, loading, error } = useDefaultContent(selectedType, 20);

  const contentTypeOptions = [
    { label: 'All', value: undefined },
    { label: 'Music', value: 'music' },
    { label: 'Videos', value: 'videos' },
    { label: 'Audio', value: 'audio' },
    { label: 'Books', value: 'books' },
    { label: 'Sermons', value: 'sermon' },
    { label: 'Devotionals', value: 'devotional' },
  ];

  const renderMediaItem = ({ item }: { item: MediaItem }) => (
    <DefaultMediaCard
      media={item}
      onPress={onMediaPress}
      onPlay={onMediaPlay}
    />
  );

  const renderContentTypeFilter = () => (
    <View style={styles.filterContainer}>
      <FlatList
        data={contentTypeOptions}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.value || 'all'}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.filterButton,
              selectedType === item.value && styles.filterButtonActive,
            ]}
            onPress={() => setSelectedType(item.value)}
          >
            <Text
              style={[
                styles.filterButtonText,
                selectedType === item.value && styles.filterButtonTextActive,
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading gospel content...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load content</Text>
        <Text style={styles.errorSubtext}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderContentTypeFilter()}

      <FlatList
        data={data?.data.all || []}
        renderItem={renderMediaItem}
        keyExtractor={(item) => item._id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  filterContainer: {
    paddingVertical: 16,
    paddingHorizontal: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f3f4',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  row: {
    justifyContent: 'space-between',
    paddingHorizontal: 15,
  },
  listContainer: {
    paddingTop: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
```

### **6. Usage in App Navigation**

```typescript
// App.tsx or your main navigation component
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { DefaultContentScreen } from './screens/DefaultContentScreen';
import { MediaPlayerScreen } from './screens/MediaPlayerScreen';

const Stack = createStackNavigator();

export default function App() {
  const [userToken, setUserToken] = useState<string | null>(null);

  const handleMediaPress = (media: MediaItem) => {
    // Navigate to media detail screen
    navigation.navigate('MediaDetail', { media });
  };

  const handleMediaPlay = (media: MediaItem) => {
    // Navigate to media player screen
    navigation.navigate('MediaPlayer', { media });
  };

  const handleOnboardingComplete = () => {
    // Navigate to main app
    navigation.navigate('MainTabs');
  };

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Onboarding">
        <Stack.Screen
          name="Onboarding"
          options={{ headerShown: false }}
        >
          {(props) => (
            <OnboardingScreen
              {...props}
              userToken={userToken}
              onMediaPress={handleMediaPress}
              onMediaPlay={handleMediaPlay}
              onComplete={handleOnboardingComplete}
            />
          )}
        </Stack.Screen>

        <Stack.Screen
          name="DefaultContent"
          options={{ title: 'Gospel Content' }}
        >
          {(props) => (
            <DefaultContentScreen
              {...props}
              onMediaPress={handleMediaPress}
              onMediaPlay={handleMediaPlay}
            />
          )}
        </Stack.Screen>

        <Stack.Screen
          name="MediaPlayer"
          options={{ headerShown: false }}
        >
          {(props) => (
            <MediaPlayerScreen
              {...props}
              onMediaPress={handleMediaPress}
              onMediaPlay={handleMediaPlay}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

## 📱 **Response Examples**

### **Default Content Response**

```json
{
  "success": true,
  "message": "Default content retrieved successfully",
  "data": {
    "total": 15,
    "grouped": {
      "music": [
        {
          "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
          "title": "Great Are You Lord - Sinach",
          "description": "Powerful worship song by Sinach",
          "contentType": "music",
          "category": "worship",
          "fileUrl": "https://example.com/great-are-you-lord.mp3",
          "thumbnailUrl": "https://example.com/sinach-thumbnail.jpg",
          "duration": 240,
          "uploadedBy": {
            "_id": "64f8a1b2c3d4e5f6a7b8c9d1",
            "firstName": "Sinach",
            "lastName": "",
            "avatar": "https://example.com/sinach-avatar.jpg",
            "isVerified": true
          },
          "viewCount": 1250,
          "likeCount": 89,
          "commentCount": 12,
          "shareCount": 45,
          "createdAt": "2024-01-15T10:00:00.000Z",
          "updatedAt": "2024-01-15T10:00:00.000Z"
        }
      ],
      "videos": [...],
      "audio": [...],
      "books": [...],
      "shortClips": [...]
    },
    "all": [...]
  }
}
```

### **Onboarding Content Response**

```json
{
  "success": true,
  "message": "Onboarding content retrieved successfully",
  "data": {
    "welcome": {
      "title": "Welcome to Jevah",
      "subtitle": "Your spiritual journey starts here",
      "content": [
        {
          "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
          "title": "Welcome Message",
          "description": "Get started with Jevah",
          "contentType": "videos",
          "fileUrl": "https://example.com/welcome.mp4",
          "thumbnailUrl": "https://example.com/welcome-thumb.jpg",
          "duration": 120,
          "uploadedBy": {
            "_id": "64f8a1b2c3d4e5f6a7b8c9d1",
            "firstName": "Jevah",
            "lastName": "Team",
            "avatar": "https://example.com/jevah-avatar.jpg",
            "isVerified": true
          },
          "viewCount": 5000,
          "likeCount": 250,
          "commentCount": 45,
          "shareCount": 120,
          "createdAt": "2024-01-15T10:00:00.000Z",
          "updatedAt": "2024-01-15T10:00:00.000Z"
        }
      ]
    },
    "quickStart": {
      "title": "Quick Start",
      "subtitle": "Short content to get you started",
      "content": [...]
    },
    "featured": {
      "title": "Featured Content",
      "subtitle": "Popular gospel content",
      "content": [...]
    },
    "devotionals": {
      "title": "Daily Devotionals",
      "subtitle": "Start your day with prayer",
      "content": [...]
    }
  }
}
```

## 🎯 **Key Implementation Notes**

### **1. Authentication Handling**

- **Public Endpoint**: `/api/media/default` - No authentication required
- **Protected Endpoint**: `/api/media/onboarding` - Requires Bearer token
- Always check if user is authenticated before calling protected endpoints

### **2. Error Handling**

- Implement proper error handling for network failures
- Show user-friendly error messages
- Provide retry mechanisms for failed requests

### **3. Performance Optimization**

- Use React.memo for components that don't need frequent re-renders
- Implement proper loading states
- Consider implementing pagination for large content lists

### **4. Offline Support**

- Cache default content for offline viewing
- Implement proper cache invalidation strategies
- Show cached content when network is unavailable

### **5. Media Playback**

- Handle different media types (audio, video, ebooks)
- Implement proper media player controls
- Track user interactions (views, likes, shares)

## 🔧 **Testing**

### **Test Default Content Endpoint**

```bash
curl "https://jevahapp-backend.onrender.com/api/media/default?limit=5"
```

### **Test Onboarding Endpoint**

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     "https://jevahapp-backend.onrender.com/api/media/onboarding"
```

### **Test with Content Type Filter**

```bash
curl "https://jevahapp-backend.onrender.com/api/media/default?contentType=music&limit=10"
```

## 🚀 **Quick Start Checklist**

- [ ] Set up the service file with proper TypeScript interfaces
- [ ] Implement the custom React hooks
- [ ] Create the media card component
- [ ] Build the content section component
- [ ] Implement the onboarding screen
- [ ] Create the default content screen
- [ ] Add proper error handling and loading states
- [ ] Test with both authenticated and non-authenticated scenarios
- [ ] Implement media playback functionality
- [ ] Add offline support and caching

This guide provides everything needed to integrate default gospel content into your React Native app, creating a rich onboarding experience for new users with pre-loaded Nigerian gospel content.



















