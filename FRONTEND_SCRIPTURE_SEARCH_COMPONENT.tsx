// Frontend Scripture Search Component
// Copy this to your frontend project: components/ScriptureSearch.tsx

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { hymnsAPI } from "../services/hymnsAPI";
import { POPULAR_SCRIPTURES, HYMN_CATEGORIES } from "../utils/hymnMapper";
import { HymnData } from "../services/hymnsAPI";

interface ScriptureSearchProps {
  onSearchResults: (hymns: HymnData[]) => void;
  onClose?: () => void;
  visible?: boolean;
}

export const ScriptureSearch: React.FC<ScriptureSearchProps> = ({
  onSearchResults,
  onClose,
  visible = true,
}) => {
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showPopular, setShowPopular] = useState(true);

  // Load recent searches from storage
  useEffect(() => {
    loadRecentSearches();
  }, []);

  const loadRecentSearches = async () => {
    try {
      const AsyncStorage = await import(
        "@react-native-async-storage/async-storage"
      );
      const stored = await AsyncStorage.default.getItem("hymnRecentSearches");
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Failed to load recent searches:", error);
    }
  };

  const saveRecentSearch = async (searchTerm: string) => {
    try {
      const AsyncStorage = await import(
        "@react-native-async-storage/async-storage"
      );
      const updated = [
        searchTerm,
        ...recentSearches.filter(s => s !== searchTerm),
      ].slice(0, 10);
      setRecentSearches(updated);
      await AsyncStorage.default.setItem(
        "hymnRecentSearches",
        JSON.stringify(updated)
      );
    } catch (error) {
      console.error("Failed to save recent search:", error);
    }
  };

  const handleSearch = async () => {
    if (!reference.trim()) {
      Alert.alert("Error", "Please enter a Scripture reference");
      return;
    }

    setLoading(true);
    try {
      const result = await hymnsAPI.searchHymnsByScripture({
        reference: reference.trim(),
      });

      if (result.hymns.length === 0) {
        Alert.alert(
          "No Results",
          `No hymns found for "${reference}". Try a different Scripture reference.`
        );
        return;
      }

      await saveRecentSearch(reference.trim());
      onSearchResults(result.hymns);
      setShowPopular(false);
    } catch (error: any) {
      console.error("Search failed:", error);
      Alert.alert(
        "Search Error",
        error.message || "Failed to search hymns. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePopularScripturePress = async (scripture: string) => {
    setReference(scripture);
    setLoading(true);

    try {
      const result = await hymnsAPI.searchHymnsByScripture({
        reference: scripture,
      });

      if (result.hymns.length === 0) {
        Alert.alert(
          "No Results",
          `No hymns found for "${scripture}". This Scripture may not have associated hymns.`
        );
        return;
      }

      await saveRecentSearch(scripture);
      onSearchResults(result.hymns);
      setShowPopular(false);
    } catch (error: any) {
      console.error("Search failed:", error);
      Alert.alert(
        "Search Error",
        error.message || "Failed to search hymns. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRecentSearchPress = (searchTerm: string) => {
    setReference(searchTerm);
    handleSearch();
  };

  const clearRecentSearches = async () => {
    try {
      const AsyncStorage = await import(
        "@react-native-async-storage/async-storage"
      );
      await AsyncStorage.default.removeItem("hymnRecentSearches");
      setRecentSearches([]);
    } catch (error) {
      console.error("Failed to clear recent searches:", error);
    }
  };

  const renderPopularScripture = ({
    item,
  }: {
    item: (typeof POPULAR_SCRIPTURES)[0];
  }) => (
    <TouchableOpacity
      className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2"
      onPress={() => handlePopularScripturePress(item.reference)}
      disabled={loading}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="font-semibold text-blue-900 text-base">
            {item.reference}
          </Text>
          <Text className="text-blue-700 text-sm mt-1">{item.description}</Text>
        </View>
        <Ionicons name="search" size={20} color="#1e40af" />
      </View>
    </TouchableOpacity>
  );

  const renderRecentSearch = ({ item }: { item: string }) => (
    <TouchableOpacity
      className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-2"
      onPress={() => handleRecentSearchPress(item)}
      disabled={loading}
    >
      <View className="flex-row items-center justify-between">
        <Text className="font-medium text-gray-800 text-base">{item}</Text>
        <Ionicons name="time" size={16} color="#6b7280" />
      </View>
    </TouchableOpacity>
  );

  const content = (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="bg-blue-600 px-4 py-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-white text-xl font-bold">
            Search Hymns by Scripture
          </Text>
          {onClose && (
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          )}
        </View>
        <Text className="text-blue-100 text-sm mt-1">
          Find hymns based on Bible verses
        </Text>
      </View>

      {/* Search Input */}
      <View className="p-4">
        <View className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2">
          <Ionicons name="search" size={20} color="#6b7280" />
          <TextInput
            className="flex-1 ml-3 text-gray-800 text-base"
            placeholder="e.g., John 3:16, Psalm 23, Romans 8:28"
            placeholderTextColor="#9ca3af"
            value={reference}
            onChangeText={setReference}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {reference.length > 0 && (
            <TouchableOpacity onPress={() => setReference("")}>
              <Ionicons name="close-circle" size={20} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          className={`mt-3 rounded-lg py-3 ${
            loading || !reference.trim() ? "bg-gray-300" : "bg-blue-600"
          }`}
          onPress={handleSearch}
          disabled={loading || !reference.trim()}
        >
          <View className="flex-row items-center justify-center">
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="search" size={20} color="white" />
            )}
            <Text className="text-white font-semibold text-base ml-2">
              {loading ? "Searching..." : "Search Hymns"}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView className="flex-1 px-4">
        {showPopular && (
          <>
            {/* Popular Scriptures */}
            <View className="mb-6">
              <Text className="text-gray-800 text-lg font-semibold mb-3">
                Popular Scripture References
              </Text>
              <FlatList
                data={POPULAR_SCRIPTURES}
                renderItem={renderPopularScripture}
                keyExtractor={item => item.reference}
                scrollEnabled={false}
              />
            </View>

            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <View className="mb-6">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-gray-800 text-lg font-semibold">
                    Recent Searches
                  </Text>
                  <TouchableOpacity onPress={clearRecentSearches}>
                    <Text className="text-blue-600 text-sm font-medium">
                      Clear
                    </Text>
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={recentSearches}
                  renderItem={renderRecentSearch}
                  keyExtractor={(item, index) => `${item}-${index}`}
                  scrollEnabled={false}
                />
              </View>
            )}

            {/* Search Tips */}
            <View className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <View className="flex-row items-start">
                <Ionicons name="information-circle" size={20} color="#d97706" />
                <View className="ml-3 flex-1">
                  <Text className="text-yellow-800 font-semibold text-base mb-2">
                    Search Tips
                  </Text>
                  <Text className="text-yellow-700 text-sm leading-5">
                    • Use common Bible references like "John 3:16" or "Psalm 23"
                    {"\n"}• Try book names like "Romans" or "Ephesians"{"\n"}•
                    Include chapter and verse numbers for specific results{"\n"}
                    • Some Scriptures may not have associated hymns
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );

  if (onClose) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        {content}
      </Modal>
    );
  }

  return content;
};

export default ScriptureSearch;
