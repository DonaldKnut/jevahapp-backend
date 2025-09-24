// Frontend Hymn Data Mapper
// Copy this to your frontend project: utils/hymnMapper.ts

import { HymnData } from "./services/hymnsAPI";

// Map hymn data to your existing audio format
export const mapHymnToAudioFormat = (hymn: HymnData) => {
  return {
    _id: hymn._id,
    title: hymn.title,
    author: hymn.author,
    composer: hymn.composer,
    year: hymn.year,
    category: hymn.category,
    lyrics: hymn.lyrics,
    audioUrl: hymn.audioUrl || null, // Will be null initially
    thumbnailUrl: hymn.thumbnailUrl || getDefaultHymnThumbnail(hymn.category),
    duration: hymn.duration || 0,
    hymnNumber: hymn.hymnNumber,
    meter: hymn.meter,
    key: hymn.key,
    scripture: hymn.scripture,
    tags: hymn.tags,
    // Map to your existing audio format
    contentType: "hymn",
    fileUrl: hymn.audioUrl,
    imageUrl: hymn.thumbnailUrl,
    views: hymn.viewCount || 0,
    likes: hymn.likeCount || 0,
    comments: hymn.commentCount || 0,
    saves: hymn.bookmarkCount || 0,
    createdAt: hymn.createdAt,
    // Add hymn-specific fields
    hymnData: {
      hymnNumber: hymn.hymnNumber,
      meter: hymn.meter,
      key: hymn.key,
      scripture: hymn.scripture,
      lyrics: hymn.lyrics,
      hymnaryData: hymn.hymnaryData,
    },
  };
};

// Get default thumbnail based on category
const getDefaultHymnThumbnail = (category: string): string => {
  const thumbnails = {
    praise: "https://via.placeholder.com/400x400/FF6B6B/FFFFFF?text=Praise",
    worship: "https://via.placeholder.com/400x400/4ECDC4/FFFFFF?text=Worship",
    traditional:
      "https://via.placeholder.com/400x400/45B7D1/FFFFFF?text=Traditional",
    contemporary:
      "https://via.placeholder.com/400x400/96CEB4/FFFFFF?text=Contemporary",
    gospel: "https://via.placeholder.com/400x400/FFEAA7/FFFFFF?text=Gospel",
    christmas:
      "https://via.placeholder.com/400x400/DDA0DD/FFFFFF?text=Christmas",
    easter: "https://via.placeholder.com/400x400/98D8C8/FFFFFF?text=Easter",
  };
  return thumbnails[category] || thumbnails.traditional;
};

// Popular Scripture references for quick search
export const POPULAR_SCRIPTURES = [
  { reference: "John 3:16", description: "God's Love" },
  { reference: "Psalm 23", description: "The Lord is My Shepherd" },
  { reference: "Romans 8:28", description: "All Things Work Together" },
  { reference: "Philippians 4:13", description: "I Can Do All Things" },
  { reference: "Jeremiah 29:11", description: "Plans to Prosper" },
  { reference: "Psalm 91", description: "God's Protection" },
  { reference: "Isaiah 40:31", description: "They That Wait" },
  { reference: "Matthew 28:19", description: "Great Commission" },
  { reference: "Ephesians 2:8-9", description: "Saved by Grace" },
  { reference: "Psalm 100", description: "Make a Joyful Noise" },
];

// Hymn categories with descriptions
export const HYMN_CATEGORIES = [
  {
    value: "praise",
    label: "Praise",
    description: "Songs of praise and adoration",
  },
  {
    value: "worship",
    label: "Worship",
    description: "Songs for worship and devotion",
  },
  {
    value: "traditional",
    label: "Traditional",
    description: "Classic hymns and traditional songs",
  },
  {
    value: "contemporary",
    label: "Contemporary",
    description: "Modern worship songs",
  },
  {
    value: "gospel",
    label: "Gospel",
    description: "Gospel and spiritual songs",
  },
  {
    value: "christmas",
    label: "Christmas",
    description: "Christmas carols and songs",
  },
  {
    value: "easter",
    label: "Easter",
    description: "Easter hymns and resurrection songs",
  },
];

// Common hymn tags
export const COMMON_HYMN_TAGS = [
  "grace",
  "salvation",
  "love",
  "faith",
  "hope",
  "peace",
  "joy",
  "praise",
  "worship",
  "prayer",
  "thanksgiving",
  "redemption",
  "scripture-based",
  "traditional",
  "contemporary",
  "gospel",
  "christmas",
  "easter",
  "metered",
  "acapella",
  "instrumental",
];

// Format hymn duration
export const formatHymnDuration = (durationMs: number): string => {
  if (!durationMs) return "0:00";

  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

// Format hymn year
export const formatHymnYear = (year: number): string => {
  if (!year) return "Unknown";
  return year.toString();
};

// Get hymn display name (author + composer)
export const getHymnDisplayName = (hymn: HymnData): string => {
  if (hymn.composer && hymn.composer !== hymn.author) {
    return `${hymn.author} (${hymn.composer})`;
  }
  return hymn.author;
};

// Check if hymn has audio
export const hasHymnAudio = (hymn: HymnData): boolean => {
  return !!(hymn.audioUrl && hymn.audioUrl.trim());
};

// Get hymn scripture display
export const getHymnScriptureDisplay = (hymn: HymnData): string => {
  if (!hymn.scripture || hymn.scripture.length === 0) {
    return "No scripture reference";
  }

  if (hymn.scripture.length === 1) {
    return hymn.scripture[0];
  }

  if (hymn.scripture.length <= 3) {
    return hymn.scripture.join(", ");
  }

  return `${hymn.scripture.slice(0, 2).join(", ")} and ${hymn.scripture.length - 2} more`;
};

// Get hymn meter display
export const getHymnMeterDisplay = (hymn: HymnData): string => {
  if (!hymn.meter) return "No meter";
  return hymn.meter;
};

// Get hymn key display
export const getHymnKeyDisplay = (hymn: HymnData): string => {
  if (!hymn.key) return "No key";
  return hymn.key;
};

// Get hymn number display
export const getHymnNumberDisplay = (hymn: HymnData): string => {
  if (!hymn.hymnNumber) return "No number";
  return `#${hymn.hymnNumber}`;
};

// Get hymn source display
export const getHymnSourceDisplay = (hymn: HymnData): string => {
  const sourceMap = {
    hymnary: "Hymnary.org",
    openhymnal: "Open Hymnal",
    manual: "Manual Entry",
  };
  return sourceMap[hymn.source] || hymn.source;
};

// Get hymn interaction summary
export const getHymnInteractionSummary = (hymn: HymnData): string => {
  const interactions = [
    hymn.likeCount > 0 ? `${hymn.likeCount} likes` : null,
    hymn.commentCount > 0 ? `${hymn.commentCount} comments` : null,
    hymn.shareCount > 0 ? `${hymn.shareCount} shares` : null,
    hymn.bookmarkCount > 0 ? `${hymn.bookmarkCount} saves` : null,
  ].filter(Boolean);

  if (interactions.length === 0) {
    return "No interactions yet";
  }

  return interactions.join(" • ");
};

// Search hymns by text
export const searchHymnsByText = (
  hymns: HymnData[],
  searchText: string
): HymnData[] => {
  if (!searchText.trim()) return hymns;

  const query = searchText.toLowerCase();

  return hymns.filter(
    hymn =>
      hymn.title.toLowerCase().includes(query) ||
      hymn.author.toLowerCase().includes(query) ||
      hymn.composer?.toLowerCase().includes(query) ||
      hymn.lyrics.some(line => line.toLowerCase().includes(query)) ||
      hymn.scripture.some(ref => ref.toLowerCase().includes(query)) ||
      hymn.tags.some(tag => tag.toLowerCase().includes(query))
  );
};

// Sort hymns
export const sortHymns = (
  hymns: HymnData[],
  sortBy: string,
  sortOrder: "asc" | "desc" = "asc"
): HymnData[] => {
  return [...hymns].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortBy) {
      case "title":
        aValue = a.title.toLowerCase();
        bValue = b.title.toLowerCase();
        break;
      case "author":
        aValue = a.author.toLowerCase();
        bValue = b.author.toLowerCase();
        break;
      case "year":
        aValue = a.year || 0;
        bValue = b.year || 0;
        break;
      case "viewCount":
        aValue = a.viewCount;
        bValue = b.viewCount;
        break;
      case "likeCount":
        aValue = a.likeCount;
        bValue = b.likeCount;
        break;
      case "createdAt":
        aValue = new Date(a.createdAt).getTime();
        bValue = new Date(b.createdAt).getTime();
        break;
      default:
        aValue = a.title.toLowerCase();
        bValue = b.title.toLowerCase();
    }

    if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
    if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });
};

// Filter hymns by category
export const filterHymnsByCategory = (
  hymns: HymnData[],
  category: string
): HymnData[] => {
  if (!category) return hymns;
  return hymns.filter(hymn => hymn.category === category);
};

// Filter hymns by tags
export const filterHymnsByTags = (
  hymns: HymnData[],
  tags: string[]
): HymnData[] => {
  if (!tags || tags.length === 0) return hymns;
  return hymns.filter(hymn => tags.some(tag => hymn.tags.includes(tag)));
};

// Get hymn statistics
export const getHymnStatistics = (hymns: HymnData[]) => {
  const stats = {
    total: hymns.length,
    byCategory: {} as Record<string, number>,
    bySource: {} as Record<string, number>,
    totalViews: 0,
    totalLikes: 0,
    totalComments: 0,
    totalShares: 0,
    totalBookmarks: 0,
    withAudio: 0,
    withScripture: 0,
  };

  hymns.forEach(hymn => {
    // Category stats
    stats.byCategory[hymn.category] =
      (stats.byCategory[hymn.category] || 0) + 1;

    // Source stats
    stats.bySource[hymn.source] = (stats.bySource[hymn.source] || 0) + 1;

    // Interaction stats
    stats.totalViews += hymn.viewCount;
    stats.totalLikes += hymn.likeCount;
    stats.totalComments += hymn.commentCount;
    stats.totalShares += hymn.shareCount;
    stats.totalBookmarks += hymn.bookmarkCount;

    // Content stats
    if (hasHymnAudio(hymn)) stats.withAudio++;
    if (hymn.scripture && hymn.scripture.length > 0) stats.withScripture++;
  });

  return stats;
};
