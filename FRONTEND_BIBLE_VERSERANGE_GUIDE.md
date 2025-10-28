# 📖 Frontend Integration Guide: Bible Verse Range Endpoint

## ✅ **Endpoint is Live and Working!**

Test it: [https://jevahapp-backend.onrender.com/api/bible/verses/range/Romans%208:28-31](https://jevahapp-backend.onrender.com/api/bible/verses/range/Romans%208:28-31)

---

## 🚀 **Quick Copy-Paste Code for Frontend**

### **1. TypeScript Service (bibleApiService.ts)**

```typescript
// bibleApiService.ts
import { getApiBaseUrl } from "../utils/api";

export interface BibleVerse {
  _id: string;
  bookId: string;
  bookName: string;
  chapterNumber: number;
  verseNumber: number;
  text: string;
  translation: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VerseRangeResponse {
  success: boolean;
  data: BibleVerse[];
  count: number;
  reference: {
    bookName: string;
    startChapter: number;
    startVerse: number;
    endVerse: number;
  };
}

export const bibleApiService = {
  /**
   * Get a range of Bible verses
   * @param reference - Bible reference like "John 3:16-18" or "Romans 8:28-31"
   * @returns Array of verses in the range
   */
  async getVerseRange(reference: string): Promise<VerseRangeResponse> {
    try {
      // URL encode the reference (spaces become %20, etc.)
      const encodedReference = encodeURIComponent(reference);
      const url = `${getApiBaseUrl()}/api/bible/verses/range/${encodedReference}`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Failed to fetch verse range");
      }

      return data;
    } catch (error) {
      console.error("Error fetching verse range:", error);
      throw error;
    }
  },

  /**
   * Get all Bible books
   */
  async getAllBooks() {
    const response = await fetch(`${getApiBaseUrl()}/api/bible/books`);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message);
    }
    
    return data.data;
  },

  /**
   * Get a specific verse
   */
  async getVerse(bookName: string, chapter: number, verse: number) {
    const response = await fetch(
      `${getApiBaseUrl()}/api/bible/books/${bookName}/chapters/${chapter}/verses/${verse}`
    );
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message);
    }
    
    return data.data;
  },
};
```

---

### **2. React Native / React Component Example**

```typescript
// VerseRangeComponent.tsx
import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { bibleApiService, BibleVerse } from "../services/bibleApiService";

interface VerseRangeProps {
  reference: string; // e.g., "Romans 8:28-31"
}

export const VerseRangeComponent: React.FC<VerseRangeProps> = ({ reference }) => {
  const [verses, setVerses] = useState<BibleVerse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadVerses();
  }, [reference]);

  const loadVerses = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await bibleApiService.getVerseRange(reference);
      setVerses(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load verses");
      console.error("Error loading verses:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={styles.loadingText}>Loading verses...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error: {error}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.reference}>{reference}</Text>
        <Text style={styles.count}>{verses.length} verse{verses.length !== 1 ? "s" : ""}</Text>
      </View>

      {verses.map((verse, index) => (
        <View key={verse._id} style={styles.verseContainer}>
          <View style={styles.verseHeader}>
            <Text style={styles.verseNumber}>
              {verse.bookName} {verse.chapterNumber}:{verse.verseNumber}
            </Text>
          </View>
          <Text style={styles.verseText}>{verse.text}</Text>
          {index < verses.length - 1 && <View style={styles.separator} />}
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#fff",
  },
  header: {
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: "#0066cc",
  },
  reference: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 5,
  },
  count: {
    fontSize: 14,
    color: "#666",
  },
  verseContainer: {
    marginBottom: 20,
  },
  verseHeader: {
    marginBottom: 8,
  },
  verseNumber: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0066cc",
  },
  verseText: {
    fontSize: 16,
    lineHeight: 24,
    color: "#333",
  },
  separator: {
    height: 1,
    backgroundColor: "#e0e0e0",
    marginTop: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
  },
  errorText: {
    fontSize: 16,
    color: "#d32f2f",
  },
});
```

---

### **3. Usage Examples**

#### **Example 1: Display Romans 8:28-31**

```typescript
import { VerseRangeComponent } from "./components/VerseRangeComponent";

// In your screen/component
<VerseRangeComponent reference="Romans 8:28-31" />
```

#### **Example 2: Custom Hook**

```typescript
// useVerseRange.ts
import { useState, useEffect } from "react";
import { bibleApiService, BibleVerse } from "../services/bibleApiService";

export const useVerseRange = (reference: string) => {
  const [verses, setVerses] = useState<BibleVerse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadVerses = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await bibleApiService.getVerseRange(reference);
        setVerses(response.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    };

    if (reference) {
      loadVerses();
    }
  }, [reference]);

  return { verses, loading, error };
};

// Usage:
const { verses, loading, error } = useVerseRange("John 3:16-18");
```

#### **Example 3: Direct API Call**

```typescript
// Direct fetch without service layer
const fetchVerseRange = async (reference: string) => {
  const encodedRef = encodeURIComponent(reference); // "Romans 8:28-31" -> "Romans%208%3A28-31"
  const url = `https://jevahapp-backend.onrender.com/api/bible/verses/range/${encodedRef}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.success) {
    return data.data; // Array of verses
  } else {
    throw new Error(data.message);
  }
};

// Use it:
const verses = await fetchVerseRange("Psalm 23:1-6");
```

---

## 📊 **Response Format**

```typescript
{
  "success": true,
  "data": [
    {
      "_id": "68fc836c990b19e69c902161",
      "bookId": "68fc67ec990b19e69c8f4649",
      "bookName": "Romans",
      "chapterNumber": 8,
      "verseNumber": 28,
      "text": "We know that all things work together for good...",
      "translation": "WEB",
      "isActive": true,
      "createdAt": "2025-10-25T07:59:40.285Z",
      "updatedAt": "2025-10-25T07:59:40.285Z"
    },
    // ... more verses
  ],
  "count": 4,
  "reference": {
    "bookName": "Romans",
    "startChapter": 8,
    "startVerse": 28,
    "endVerse": 31
  }
}
```

---

## 🎯 **Supported Reference Formats**

The endpoint accepts these formats:

- ✅ `"John 3:16-18"` - Single chapter, verse range
- ✅ `"Romans 8:28-31"` - Single chapter, verse range
- ✅ `"Psalm 23:1-6"` - Single chapter, verse range
- ✅ `"Genesis 1:1-5"` - Single chapter, verse range
- ✅ `"1 Corinthians 13:4-7"` - Single chapter, verse range (multi-word book name)

**Note**: Currently supports ranges within the same chapter only.

---

## 🔧 **Error Handling**

```typescript
try {
  const response = await bibleApiService.getVerseRange("John 3:16-18");
  // Use response.data
} catch (error) {
  if (error.message.includes("Invalid Bible reference")) {
    // Handle invalid format
    console.error("Invalid reference format");
  } else {
    // Handle other errors
    console.error("API error:", error);
  }
}
```

---

## 🌐 **Base URL Configuration**

Make sure your frontend has the correct API base URL:

```typescript
// utils/api.ts
export const getApiBaseUrl = () => {
  // Use environment variable if available
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  
  // Production
  return "https://jevahapp-backend.onrender.com";
  
  // Local development
  // return "http://localhost:4000";
  // return "http://10.156.136.168:4000"; // Network IP
};
```

---

## ✅ **Testing Checklist**

- [ ] Test with single verse: `"John 3:16-16"`
- [ ] Test with verse range: `"Romans 8:28-31"`
- [ ] Test with multi-word book: `"1 Corinthians 13:4-7"`
- [ ] Test error handling with invalid format
- [ ] Test loading states
- [ ] Test network errors

---

## 📚 **More Bible Endpoints**

See `BACKEND_FRONTEND_INTEGRATION_GUIDE.md` for complete API documentation including:
- All books endpoint
- Search functionality
- Random verses
- Verse of the day
- And more!

---

**Frontend Team**: Copy-paste the service code and component above to get started! 🚀

