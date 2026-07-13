// Upload limits configuration
export const UPLOAD_LIMITS = {
  FILE_SIZE: {
    SERMON_MB: 300, // Maximum file size for sermons/videos (MB)
    MUSIC_MB: 50,   // Maximum file size for music (MB)
    BOOK_MB: 100,   // Maximum file size for books/eBooks (MB)
    THUMBNAIL_MB: 5, // Maximum file size for thumbnails (MB) - already enforced in service
  },
  UPLOAD_COUNT: {
    MUSIC_PER_USER: 50,    // Maximum songs per artist/user
    SERMON_PER_USER: 30,   // Maximum sermons/videos per user
  },
};

// AI Description Generation limits (more restrictive for cost/performance)
export const AI_DESCRIPTION_LIMITS = {
  MAX_FILE_SIZE_MB: 50,        // Maximum file size for AI analysis (smaller than upload limit)
  MAX_VIDEO_DURATION_SECONDS: 180, // Maximum video duration to analyze (3 minutes)
  TIMEOUT_MS: 20000,            // 20 seconds timeout for processing
  MAX_REQUESTS_PER_MINUTE: 5,   // Rate limit for AI description generation
};
