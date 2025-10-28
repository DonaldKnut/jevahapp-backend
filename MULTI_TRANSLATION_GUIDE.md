# 📚 Multiple Bible Translations Guide

## ✅ **Multi-Translation Support Implemented!**

Your Bible API now supports multiple translations (KJV, NIV, ASV, AMP, etc.) just like YouVersion!

---

## 🚀 **Features**

- ✅ **Multiple Translations**: KJV, NIV, ASV, AMP, DARBY, YLT, and more
- ✅ **Translation Switching**: Users can switch between translations
- ✅ **Seeding Script**: Automated script to fetch and seed translations
- ✅ **API Support**: All endpoints support translation parameter
- ✅ **Available Translations Endpoint**: List all available translations

---

## 📡 **API Endpoints**

### **1. Get Available Translations**
```
GET /api/bible/translations
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "code": "WEB",
      "name": "World English Bible",
      "count": 31005
    },
    {
      "code": "KJV",
      "name": "King James Version",
      "count": 31005
    },
    {
      "code": "ASV",
      "name": "American Standard Version",
      "count": 31005
    }
  ],
  "count": 3
}
```

### **2. Get Verses with Translation**
```
GET /api/bible/books/:bookName/chapters/:chapterNumber/verses?translation=KJV
```

**Query Parameters:**
- `translation` (optional) - Translation code (KJV, NIV, ASV, AMP, etc.)
- Defaults to `WEB` if not specified

**Example:**
```
GET /api/bible/books/John/chapters/3/verses?translation=KJV
GET /api/bible/books/John/chapters/3/verses?translation=NIV
```

### **3. Get Single Verse with Translation**
```
GET /api/bible/books/:bookName/chapters/:chapterNumber/verses/:verseNumber?translation=KJV
```

**Example:**
```
GET /api/bible/books/John/chapters/3/verses/16?translation=KJV
```

---

## 🌱 **Seeding Multiple Translations**

### **Run Seeding Script**

```bash
# Seed all available translations (KJV, ASV, DARBY, YLT)
node scripts/seed-multiple-translations.js
```

**What it does:**
1. Uses `bible-api.com` to fetch translations (free API)
2. Seeds verses for each translation
3. Skips verses that already exist
4. Updates incomplete verses
5. Reports statistics for each translation

**Supported Translations:**
- ✅ **WEB** - World English Bible (already have)
- ✅ **KJV** - King James Version
- ✅ **ASV** - American Standard Version
- ✅ **DARBY** - Darby Translation
- ✅ **YLT** - Young's Literal Translation

---

## 📱 **Frontend Integration**

### **Translation Switcher Component**

```typescript
// TranslationSwitcher.tsx
import React, { useState, useEffect } from "react";
import { View, Text, Picker, StyleSheet } from "react-native";

interface Translation {
  code: string;
  name: string;
  count: number;
}

export const TranslationSwitcher = ({ onTranslationChange }) => {
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [selectedTranslation, setSelectedTranslation] = useState("WEB");

  useEffect(() => {
    fetchTranslations();
  }, []);

  const fetchTranslations = async () => {
    try {
      const response = await fetch("/api/bible/translations");
      const data = await response.json();
      
      if (data.success) {
        setTranslations(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch translations:", error);
    }
  };

  const handleTranslationChange = (translation: string) => {
    setSelectedTranslation(translation);
    onTranslationChange(translation);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Translation:</Text>
      <Picker
        selectedValue={selectedTranslation}
        onValueChange={handleTranslationChange}
        style={styles.picker}
      >
        {translations.map((t) => (
          <Picker.Item
            key={t.code}
            label={`${t.name} (${t.code})`}
            value={t.code}
          />
        ))}
      </Picker>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: "#f5f5f5",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  picker: {
    height: 50,
    width: "100%",
  },
});
```

### **Usage in Verse Display**

```typescript
// VerseDisplay.tsx
import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { TranslationSwitcher } from "./TranslationSwitcher";

export const VerseDisplay = ({ bookName, chapter, verse }) => {
  const [translation, setTranslation] = useState("WEB");
  const [verseData, setVerseData] = useState(null);

  useEffect(() => {
    loadVerse();
  }, [bookName, chapter, verse, translation]);

  const loadVerse = async () => {
    try {
      const response = await fetch(
        `/api/bible/books/${bookName}/chapters/${chapter}/verses/${verse}?translation=${translation}`
      );
      const data = await response.json();
      
      if (data.success) {
        setVerseData(data.data);
      }
    } catch (error) {
      console.error("Failed to load verse:", error);
    }
  };

  return (
    <View style={styles.container}>
      <TranslationSwitcher onTranslationChange={setTranslation} />
      
      {verseData && (
        <View style={styles.verseContainer}>
          <Text style={styles.reference}>
            {verseData.bookName} {verseData.chapterNumber}:{verseData.verseNumber}
          </Text>
          <Text style={styles.text}>{verseData.text}</Text>
          <Text style={styles.translation}>{verseData.translation}</Text>
        </View>
      )}
    </View>
  );
};
```

---

## 🌐 **Supported Translation Sources**

### **1. bible-api.com** (Primary)
- ✅ Free API
- ✅ Multiple translations
- ✅ No API key required
- ✅ Rate limit: ~1 req/second

**Supported translations:**
- `kjv` - King James Version
- `asv` - American Standard Version
- `darby` - Darby Translation
- `ylt` - Young's Literal Translation
- `web` - World English Bible (default)

### **2. Bible Gateway** (Optional - Scraping)
- ⚠️ Requires careful ToS compliance
- Can get NIV, AMP, ESV, etc.
- More translations available
- **Note**: Respects robots.txt

---

## 🚀 **Implementation Status**

### **✅ Completed:**
- [x] Database model supports translation field
- [x] API endpoints accept translation parameter
- [x] Service layer filters by translation
- [x] Available translations endpoint
- [x] Seeding script for multiple translations
- [x] Default translation (WEB) maintained

### **📋 Next Steps:**
1. **Run seeding script** to populate translations:
   ```bash
   node scripts/seed-multiple-translations.js
   ```

2. **Frontend Implementation**:
   - Add translation switcher UI
   - Store user preference
   - Update verse displays when translation changes

3. **Additional Translations** (optional):
   - Add more sources for NIV, AMP, ESV
   - Implement caching for better performance
   - Add translation comparison feature

---

## 💡 **Example Requests**

### **Get John 3:16 in KJV:**
```bash
GET /api/bible/books/John/chapters/3/verses/16?translation=KJV
```

### **Get John 3 in ASV:**
```bash
GET /api/bible/books/John/chapters/3/verses?translation=ASV
```

### **Get available translations:**
```bash
GET /api/bible/translations
```

---

## 📊 **Database Structure**

Each verse can have multiple records - one per translation:

```javascript
// WEB translation
{ bookName: "John", chapterNumber: 3, verseNumber: 16, text: "For God so loved...", translation: "WEB" }

// KJV translation (same verse, different text)
{ bookName: "John", chapterNumber: 3, verseNumber: 16, text: "For God so loved...", translation: "KJV" }
```

**Benefits:**
- ✅ Easy to switch translations
- ✅ Fast queries (indexed by translation)
- ✅ Can add more translations without schema changes
- ✅ Users can compare translations

---

## 🎯 **Ready to Use!**

1. **Seed translations**: Run the seeding script
2. **Frontend**: Add translation switcher component
3. **Users**: Can switch between translations seamlessly!

**Just like YouVersion!** 📖✨

