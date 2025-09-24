// Frontend Hymns Screen Integration
// Copy this to your frontend project: screens/HymnsScreen.tsx

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

// Import your existing components
import { MusicCard } from "../components/MusicCard"; // Your existing MusicCard
import ScriptureSearch from "../components/ScriptureSearch";
import { hymnsAPI, HymnData } from "../services/hymnsAPI";
import { mapHymnToAudioFormat, HYMN_CATEGORIES } from "../utils/hymnMapper";

interface HymnsScreenProps {
  // Add any props you need
}

export const HymnsScreen: React.FC<HymnsScreenProps> = () => {
  const [hymns, setHymns] = useState<HymnData[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [showScriptureSearch, setShowScriptureSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<HymnData[]>([]);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Load hymns on component mount
  useEffect(() => {
    loadHymns();
  }, [selectedCategory]);

  const loadHymns = async (pageNum: number = 1, append: boolean = false) => {
    if (loading) return;

    setLoading(true);
    try {
      const result = await hymnsAPI.getHymns({
        page: pageNum,
        limit: 20,
        category: selectedCategory || undefined,
        sortBy: "title",
        sortOrder: "asc",
      });

      if (append) {
        setHymns(prev => [...prev, ...result.hymns]);
      } else {
        setHymns(result.hymns);
      }

      setHasMore(pageNum < result.pagination.totalPages);
      setPage(pageNum);
    } catch (error: any) {
      console.error("Failed to load hymns:", error);
      Alert.alert(
        "Error",
        error.message || "Failed to load hymns. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadHymns(1, false);
    setRefreshing(false);
  }, [selectedCategory]);

  const handleLoadMore = useCallback(async () => {
    if (hasMore && !loading) {
      await loadHymns(page + 1, true);
    }
  }, [hasMore, loading, page]);

  const handleScriptureSearch = (searchHymns: HymnData[]) => {
    setSearchResults(searchHymns);
    setIsSearchMode(true);
    setShowScriptureSearch(false);
  };

  const handleBackToHymns = () => {
    setIsSearchMode(false);
    setSearchResults([]);
  };

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category === selectedCategory ? "" : category);
    setPage(1);
  };

  // Handle interactions (you'll need to implement these based on your existing logic)
  const handleLike = async (hymn: HymnData) => {
    try {
      // Use your existing like logic here
      console.log("Like hymn:", hymn.title);
      // Update local state or call your existing like API
    } catch (error) {
      console.error("Failed to like hymn:", error);
    }
  };

  const handleComment = (hymn: HymnData) => {
    // Use your existing comment logic here
    console.log("Comment on hymn:", hymn.title);
  };

  const handleSave = async (hymn: HymnData) => {
    try {
      // Use your existing save/bookmark logic here
      console.log("Save hymn:", hymn.title);
      // Update local state or call your existing bookmark API
    } catch (error) {
      console.error("Failed to save hymn:", error);
    }
  };

  const handleShare = (hymn: HymnData) => {
    // Use your existing share logic here
    console.log("Share hymn:", hymn.title);
  };

  const handleDownload = (hymn: HymnData) => {
    // Use your existing download logic here
    console.log("Download hymn:", hymn.title);
  };

  const renderCategoryFilter = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="px-4 mb-4"
    >
      <TouchableOpacity
        className={`mr-3 px-4 py-2 rounded-full ${
          selectedCategory === "" ? "bg-blue-600" : "bg-gray-200"
        }`}
        onPress={() => handleCategorySelect("")}
      >
        <Text
          className={`font-medium ${
            selectedCategory === "" ? "text-white" : "text-gray-700"
          }`}
        >
          All
        </Text>
      </TouchableOpacity>

      {HYMN_CATEGORIES.map(category => (
        <TouchableOpacity
          key={category.value}
          className={`mr-3 px-4 py-2 rounded-full ${
            selectedCategory === category.value ? "bg-blue-600" : "bg-gray-200"
          }`}
          onPress={() => handleCategorySelect(category.value)}
        >
          <Text
            className={`font-medium ${
              selectedCategory === category.value
                ? "text-white"
                : "text-gray-700"
            }`}
          >
            {category.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderHymnCard = (hymn: HymnData, index: number) => {
    // Map hymn data to your existing audio format
    const audioData = mapHymnToAudioFormat(hymn);

    return (
      <MusicCard
        key={hymn._id}
        audio={audioData}
        index={index}
        onLike={() => handleLike(hymn)}
        onComment={() => handleComment(hymn)}
        onSave={() => handleSave(hymn)}
        onShare={() => handleShare(hymn)}
        onDownload={() => handleDownload(hymn)}
        onPlay={() => {}} // Add your play logic
        isPlaying={false} // Add your playing state logic
        progress={0} // Add your progress logic
      />
    );
  };

  const renderContent = () => {
    const displayHymns = isSearchMode ? searchResults : hymns;

    if (loading && displayHymns.length === 0) {
      return (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text className="text-gray-600 mt-4">Loading hymns...</Text>
        </View>
      );
    }

    if (displayHymns.length === 0) {
      return (
        <View className="flex-1 justify-center items-center px-4">
          <Ionicons name="musical-notes" size={64} color="#d1d5db" />
          <Text className="text-gray-600 text-lg font-medium mt-4 text-center">
            {isSearchMode
              ? "No hymns found for this Scripture reference"
              : "No hymns available"}
          </Text>
          <Text className="text-gray-500 text-sm mt-2 text-center">
            {isSearchMode
              ? "Try searching with a different Bible verse"
              : "Check back later for new hymns"}
          </Text>
        </View>
      );
    }

    return (
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={["#3b82f6"]}
            tintColor="#3b82f6"
          />
        }
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const paddingToBottom = 20;

          if (
            layoutMeasurement.height + contentOffset.y >=
            contentSize.height - paddingToBottom
          ) {
            handleLoadMore();
          }
        }}
        scrollEventThrottle={400}
      >
        {displayHymns.map((hymn, index) => renderHymnCard(hymn, index))}

        {loading && displayHymns.length > 0 && (
          <View className="py-4 items-center">
            <ActivityIndicator size="small" color="#3b82f6" />
            <Text className="text-gray-600 mt-2">Loading more hymns...</Text>
          </View>
        )}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="bg-blue-600 px-4 py-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-white text-xl font-bold">
              {isSearchMode ? "Search Results" : "Hymns"}
            </Text>
            <Text className="text-blue-100 text-sm mt-1">
              {isSearchMode
                ? `${searchResults.length} hymns found`
                : "Scripture-based hymns and worship songs"}
            </Text>
          </View>

          <View className="flex-row items-center">
            {isSearchMode && (
              <TouchableOpacity
                className="mr-3 p-2"
                onPress={handleBackToHymns}
              >
                <Ionicons name="arrow-back" size={24} color="white" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              className="p-2"
              onPress={() => setShowScriptureSearch(true)}
            >
              <Ionicons name="search" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Category Filter */}
      {!isSearchMode && renderCategoryFilter()}

      {/* Content */}
      {renderContent()}

      {/* Scripture Search Modal */}
      <Modal
        visible={showScriptureSearch}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <ScriptureSearch
          onSearchResults={handleScriptureSearch}
          onClose={() => setShowScriptureSearch(false)}
          visible={showScriptureSearch}
        />
      </Modal>
    </SafeAreaView>
  );
};

export default HymnsScreen;
