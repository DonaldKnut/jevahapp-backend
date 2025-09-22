# 🎨 Frontend AI Description Integration Guide

## 📋 **Complete Implementation for VideoCard with Typewriter Effect**

This guide shows you exactly how to integrate the AI-powered description box with a typewriter effect into your existing VideoCard component.

## 🔧 **Step 1: Update Your VideoCardProps Interface**

First, update your `types/media.ts` file to include the new AI fields:

```typescript
// types/media.ts
export interface VideoCardProps {
  video: {
    _id: string;
    title: string;
    description?: string;
    enhancedDescription?: string; // NEW
    bibleVerses?: string[]; // NEW
    contentType: string;
    category?: string;
    fileUrl: string;
    thumbnailUrl?: string;
    topics?: string[];
    authorInfo?: {
      _id: string;
      firstName: string;
      lastName: string;
      fullName: string;
      avatar?: string;
    };
    createdAt: string;
    // ... other existing properties
  };
  // ... other existing props
}
```

## 🎨 **Step 2: Create the AI Description Box Component**

Create a new file `components/AIDescriptionBox.tsx`:

```typescript
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';

interface AIDescriptionBoxProps {
  description?: string;
  enhancedDescription?: string;
  bibleVerses?: string[];
  title: string;
  authorName: string;
  contentType: string;
  category?: string;
}

const { width } = Dimensions.get('window');

export default function AIDescriptionBox({
  description,
  enhancedDescription,
  bibleVerses = [],
  title,
  authorName,
  contentType,
  category,
}: AIDescriptionBoxProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showVerses, setShowVerses] = useState(false);
  const [typewriterText, setTypewriterText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));

  const typewriterRef = useRef<NodeJS.Timeout | null>(null);
  const currentText = description || enhancedDescription || `Discover the spiritual wisdom in "${title}" by ${authorName}.`;

  // Typewriter effect
  useEffect(() => {
    if (isExpanded && currentText) {
      setIsTyping(true);
      setTypewriterText('');

      let index = 0;
      const speed = 30; // milliseconds per character

      typewriterRef.current = setInterval(() => {
        if (index < currentText.length) {
          setTypewriterText(currentText.substring(0, index + 1));
          index++;
        } else {
          setIsTyping(false);
          if (typewriterRef.current) {
            clearInterval(typewriterRef.current);
          }
        }
      }, speed);
    }

    return () => {
      if (typewriterRef.current) {
        clearInterval(typewriterRef.current);
      }
    };
  }, [isExpanded, currentText]);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
    Animated.timing(fadeAnim, {
      toValue: isExpanded ? 0 : 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const toggleVerses = () => {
    setShowVerses(!showVerses);
  };

  const getContentIcon = () => {
    switch (contentType) {
      case 'videos':
        return 'play-circle';
      case 'audio':
      case 'music':
        return 'headphones';
      case 'books':
      case 'ebook':
        return 'book-open';
      case 'sermon':
        return 'person';
      default:
        return 'sparkles';
    }
  };

  const getContentColor = () => {
    switch (contentType) {
      case 'videos':
        return '#FEA74E';
      case 'audio':
      case 'music':
        return '#8B5CF6';
      case 'books':
      case 'ebook':
        return '#059669';
      case 'sermon':
        return '#DC2626';
      default:
        return '#6B7280';
    }
  };

  const contentColor = getContentColor();
  const hasEnhancedDescription = enhancedDescription && enhancedDescription !== description;
  const hasVerses = bibleVerses && bibleVerses.length > 0;

  return (
    <View style={styles.container}>
      {/* Header with AI Icon */}
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: contentColor }]}>
          <Ionicons name="sparkles" size={16} color="white" />
        </View>
        <Text style={styles.headerText}>AI Spiritual Insight</Text>
        <TouchableOpacity onPress={toggleExpanded} style={styles.expandButton}>
          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={20}
            color="#6B7280"
          />
        </TouchableOpacity>
      </View>

      {/* Main Description with Typewriter Effect */}
      <View style={styles.descriptionContainer}>
        <Text style={styles.description}>
          {typewriterText}
          {isTyping && <Text style={styles.cursor}>|</Text>}
        </Text>
      </View>

      {/* Expanded Content */}
      <Animated.View
        style={[
          styles.expandedContent,
          {
            opacity: fadeAnim,
            maxHeight: isExpanded ? 1000 : 0,
          },
        ]}
      >
        {/* Enhanced Description */}
        {hasEnhancedDescription && (
          <View style={styles.enhancedSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="bulb" size={16} color="#F59E0B" />
              <Text style={styles.sectionTitle}>Deeper Insight</Text>
            </View>
            <Text style={styles.enhancedDescription}>
              {enhancedDescription}
            </Text>
          </View>
        )}

        {/* Bible Verses */}
        {hasVerses && (
          <View style={styles.versesSection}>
            <TouchableOpacity
              onPress={toggleVerses}
              style={styles.versesHeader}
            >
              <View style={styles.sectionHeader}>
                <Ionicons name="book" size={16} color="#DC2626" />
                <Text style={styles.sectionTitle}>
                  Related Scripture ({bibleVerses.length})
                </Text>
              </View>
              <Ionicons
                name={showVerses ? "chevron-up" : "chevron-down"}
                size={16}
                color="#6B7280"
              />
            </TouchableOpacity>

            {showVerses && (
              <View style={styles.versesList}>
                {bibleVerses.map((verse, index) => (
                  <View key={index} style={styles.verseItem}>
                    <Text style={styles.verseReference}>{verse}</Text>
                    <TouchableOpacity style={styles.verseButton}>
                      <Feather name="external-link" size={14} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Content Type Info */}
        <View style={styles.contentTypeInfo}>
          <View style={styles.sectionHeader}>
            <Ionicons name={getContentIcon()} size={16} color={contentColor} />
            <Text style={styles.sectionTitle}>Content Type</Text>
          </View>
          <Text style={styles.contentTypeText}>
            {contentType.charAt(0).toUpperCase() + contentType.slice(1)} •
            Spiritual {contentType === 'videos' ? 'Teaching' : contentType === 'audio' ? 'Message' : contentType === 'music' ? 'Worship' : 'Content'}
          </Text>
        </View>
      </Animated.View>

      {/* Expand/Collapse Button */}
      <TouchableOpacity onPress={toggleExpanded} style={styles.expandButtonFull}>
        <Text style={styles.expandButtonText}>
          {isExpanded ? 'Show Less' : 'Show More'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    marginHorizontal: 12,
    backgroundColor: '#FEFEFE',
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#E5E7EB',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  headerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    fontFamily: 'Rubik-SemiBold',
  },
  expandButton: {
    padding: 4,
  },
  descriptionContainer: {
    marginBottom: 8,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    color: '#4B5563',
    fontFamily: 'Rubik-Regular',
  },
  cursor: {
    color: '#FEA74E',
    fontWeight: 'bold',
    fontSize: 16,
  },
  expandedContent: {
    overflow: 'hidden',
  },
  enhancedSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  versesSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  versesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  versesList: {
    marginTop: 8,
  },
  verseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#FEF7F0',
    borderRadius: 6,
    marginBottom: 4,
  },
  verseReference: {
    fontSize: 12,
    fontWeight: '500',
    color: '#DC2626',
    fontFamily: 'Rubik-Medium',
  },
  verseButton: {
    padding: 2,
  },
  contentTypeInfo: {
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 6,
    fontFamily: 'Rubik-SemiBold',
  },
  enhancedDescription: {
    fontSize: 12,
    lineHeight: 16,
    color: '#4B5563',
    fontStyle: 'italic',
    fontFamily: 'Rubik-Regular',
  },
  contentTypeText: {
    fontSize: 11,
    color: '#6B7280',
    fontFamily: 'Rubik-Regular',
  },
  expandButtonFull: {
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  expandButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    fontFamily: 'Rubik-Medium',
  },
});
```

## 🔧 **Step 3: Update Your VideoCard Component**

Now update your existing VideoCard component to include the AI Description Box. Add this import at the top:

```typescript
// Add this import
import AIDescriptionBox from "./AIDescriptionBox";
```

Then, in your VideoCard component's return statement, add the AI Description Box after the Footer section and before the Modal:

```typescript
export default function VideoCard({
  video,
  index,
  modalKey,
  contentStats,
  userFavorites,
  globalFavoriteCounts,
  playingVideos,
  mutedVideos,
  progresses,
  videoVolume,
  currentlyVisibleVideo,
  onVideoTap,
  onTogglePlay,
  onToggleMute,
  onFavorite,
  onComment,
  onSave,
  onDownload,
  onShare,
  onModalToggle,
  modalVisible,
  comments,
  checkIfDownloaded,
  getContentKey,
  getTimeAgo,
  getUserDisplayNameFromContent,
  getUserAvatarFromContent,
}: VideoCardProps) {
  // ... your existing code ...

  return (
    <View key={modalKey} className="flex flex-col mb-10">
      {/* ... your existing video and footer code ... */}

      {/* Footer */}
      <View className="flex-row items-center justify-between mt-1 px-3">
        {/* ... your existing footer code ... */}
      </View>

      {/* AI Description Box - ADD THIS */}
      <AIDescriptionBox
        description={video.description}
        enhancedDescription={video.enhancedDescription}
        bibleVerses={video.bibleVerses}
        title={video.title}
        authorName={getUserDisplayNameFromContent(video)}
        contentType={video.contentType}
        category={video.category}
      />

      {/* Modal */}
      {modalVisible === modalKey && (
        <>
          {/* ... your existing modal code ... */}
        </>
      )}
    </View>
  );
}
```

## 🔧 **Step 4: Update Your API Call**

Make sure your API call to fetch content includes the new fields. The backend now returns:

```typescript
// Your API call should now receive this enhanced response
const fetchAllContent = async () => {
  try {
    const response = await fetch("/api/media/public/all-content");
    const data = await response.json();

    if (data.success) {
      // Each media item now includes:
      // - description: AI-generated description
      // - bibleVerses: Array of Bible verse references
      // - enhancedDescription: More detailed spiritual insight
      setMediaItems(data.media);
    }
  } catch (error) {
    console.error("Error fetching content:", error);
  }
};
```

## 🎨 **Step 5: Customize the Typewriter Effect**

You can customize the typewriter effect by modifying these values in the `AIDescriptionBox` component:

```typescript
// Customize typewriter speed (milliseconds per character)
const speed = 30; // Faster: 20, Slower: 50

// Customize cursor appearance
<Text style={styles.cursor}>|</Text> // Default cursor
<Text style={styles.cursor}>█</Text> // Block cursor
<Text style={styles.cursor}>_</Text> // Underscore cursor
```

## 🎯 **Step 6: Advanced Typewriter Effects**

For more advanced typewriter effects, you can add these features:

### **Blinking Cursor Animation**

```typescript
const [cursorVisible, setCursorVisible] = useState(true);

useEffect(() => {
  const interval = setInterval(() => {
    setCursorVisible(prev => !prev);
  }, 500);

  return () => clearInterval(interval);
}, []);

// In your render:
{isTyping && cursorVisible && <Text style={styles.cursor}>|</Text>}
```

### **Typing Sound Effect**

```typescript
import { Audio } from "expo-av";

const [sound, setSound] = useState<Audio.Sound | null>(null);

useEffect(() => {
  const loadSound = async () => {
    const { sound } = await Audio.Sound.createAsync(
      require("../assets/sounds/typewriter.mp3")
    );
    setSound(sound);
  };
  loadSound();
}, []);

// Play sound on each character
if (index < currentText.length) {
  setTypewriterText(currentText.substring(0, index + 1));
  sound?.playAsync(); // Play typing sound
  index++;
}
```

### **Multiple Text Lines with Typewriter**

```typescript
const [currentLineIndex, setCurrentLineIndex] = useState(0);
const [currentLineText, setCurrentLineText] = useState("");

const lines = [
  description,
  enhancedDescription,
  `Content Type: ${contentType}`,
  `Author: ${authorName}`,
].filter(Boolean);

useEffect(() => {
  if (isExpanded && lines[currentLineIndex]) {
    // Typewriter effect for current line
    let index = 0;
    const currentLine = lines[currentLineIndex];

    const interval = setInterval(() => {
      if (index < currentLine.length) {
        setCurrentLineText(currentLine.substring(0, index + 1));
        index++;
      } else {
        clearInterval(interval);
        // Move to next line after a delay
        setTimeout(() => {
          setCurrentLineIndex(prev => prev + 1);
          setCurrentLineText("");
        }, 1000);
      }
    }, 30);

    return () => clearInterval(interval);
  }
}, [isExpanded, currentLineIndex, lines]);
```

## 📱 **Step 7: Responsive Design**

Make the component responsive for different screen sizes:

```typescript
import { Dimensions } from "react-native";

const { width, height } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: {
    marginTop: height > 800 ? 16 : 12,
    marginHorizontal: width > 400 ? 16 : 12,
    padding: width > 400 ? 20 : 16,
  },
  description: {
    fontSize: width > 400 ? 14 : 13,
    lineHeight: width > 400 ? 20 : 18,
  },
});
```

## 🎨 **Step 8: Theme Customization**

Add theme support for different content types:

```typescript
const getTheme = (contentType: string) => {
  const themes = {
    videos: {
      primary: "#FEA74E",
      secondary: "#FEF3E7",
      accent: "#F97316",
    },
    audio: {
      primary: "#8B5CF6",
      secondary: "#F3E8FF",
      accent: "#7C3AED",
    },
    music: {
      primary: "#8B5CF6",
      secondary: "#F3E8FF",
      accent: "#7C3AED",
    },
    books: {
      primary: "#059669",
      secondary: "#ECFDF5",
      accent: "#047857",
    },
    sermon: {
      primary: "#DC2626",
      secondary: "#FEF2F2",
      accent: "#B91C1C",
    },
  };

  return themes[contentType] || themes.videos;
};

// Use in your component:
const theme = getTheme(contentType);
```

## 🚀 **Step 9: Performance Optimization**

Add performance optimizations:

```typescript
import { memo, useMemo } from "react";

// Memoize the component
export default memo(AIDescriptionBox);

// Memoize expensive calculations
const contentColor = useMemo(() => getContentColor(), [contentType]);
const hasEnhancedDescription = useMemo(
  () => enhancedDescription && enhancedDescription !== description,
  [enhancedDescription, description]
);
```

## 📊 **Step 10: Analytics Integration**

Track user interactions with the AI description box:

```typescript
const trackDescriptionInteraction = (action: string, videoId: string) => {
  // Your analytics implementation
  analytics.track("AI Description Interaction", {
    action,
    videoId,
    contentType,
    timestamp: new Date().toISOString(),
  });
};

// Track when user expands/collapses
const toggleExpanded = () => {
  trackDescriptionInteraction(isExpanded ? "collapse" : "expand", video._id);
  setIsExpanded(!isExpanded);
  // ... rest of the function
};
```

## 🎉 **Final Result**

After implementing these steps, your VideoCard will now display:

✅ **AI-Generated Descriptions** with typewriter effect
✅ **Bible Verses** with expandable sections
✅ **Enhanced Descriptions** for deeper insights
✅ **Dotted Border Design** as requested
✅ **Smooth Animations** and interactions
✅ **Content-Type Specific Styling**
✅ **Responsive Design** for all screen sizes

The typewriter effect will automatically start when users expand the description box, creating an engaging and professional user experience that showcases the AI-generated spiritual insights for each piece of content.

**Your users will now see beautiful, AI-powered descriptions with typewriter effects under every video card, making your Jevah platform more informative and spiritually enriching!** 🙏✨
