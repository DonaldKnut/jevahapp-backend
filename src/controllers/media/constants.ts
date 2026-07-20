// Upload limits configuration
export const UPLOAD_LIMITS = {
  FILE_SIZE: {
    /** Soft ceiling for legacy memory-buffered uploads (prefer staged R2 for larger). */
    SERMON_MB: 100,
    /** Absolute max for staged direct-to-R2 uploads. */
    SERMON_STAGED_MB: 300,
    MUSIC_MB: 50,
    BOOK_MB: 100,
    THUMBNAIL_MB: 5,
  },
  UPLOAD_COUNT: {
    MUSIC_PER_USER: 50,
    SERMON_PER_USER: 30,
  },
};

// AI Description Generation limits (more restrictive for cost/performance)
export const AI_DESCRIPTION_LIMITS = {
  MAX_FILE_SIZE_MB: 50,
  MAX_VIDEO_DURATION_SECONDS: 180,
  TIMEOUT_MS: 20000,
  MAX_REQUESTS_PER_MINUTE: 5,
};
