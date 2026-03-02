import {
  User,
  Media,
  LiveStream,
  ChatMessage,
  AIResponse,
  ChatbotInfo,
  TrendingUser,
  ApiResponse,
  MediaListResponse,
  UserListResponse,
  BookmarkListResponse,
  AuthResponse,
  HealthResponse,
  LoginRequest,
  RegisterRequest,
  CompleteProfileRequest,
  MediaUploadRequest,
  MediaFilters,
  UserFilters,
  InteractionRequest,
  TrackViewRequest,
  LiveStreamRequest,
  ScheduledLiveStreamRequest,
  AIMessageRequest,
  JevahConfig,
  GoLiveRequest,
  ContentType,
  ToggleLikeResponse,
  ContentMetadata,
  BatchContentMetadata,
  CommentsResponse,
  Comment,
  AddCommentRequest,
  ShareContentRequest,
  ShareContentResponse,
  ContentLikersResponse,
  RecordViewRequest,
  RecordViewResponse,
} from "./types";

export class JevahClient {
  private baseURL: string;
  private token: string | null;
  private timeout: number;
  private retries: number;

  constructor(config: JevahConfig = {}) {
    this.baseURL = config.baseURL || "https://jevahapp-backend.onrender.com";
    this.token = config.token || null;
    this.timeout = config.timeout || 30000;
    this.retries = config.retries || 3;
  }

  // Set authentication token
  setToken(token: string): void {
    this.token = token;
  }

  // Clear authentication token
  clearToken(): void {
    this.token = null;
  }

  // Get headers for requests
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    return headers;
  }

  // Make HTTP request with retry logic
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const config: RequestInit = {
      headers: this.getHeaders(),
      ...options,
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        ...config,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json() as T & { message?: string };

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      if (retryCount < this.retries && this.shouldRetry(error)) {
        await this.delay(Math.pow(2, retryCount) * 1000);
        return this.request<T>(endpoint, options, retryCount + 1);
      }
      throw error;
    }
  }

  // Check if request should be retried
  private shouldRetry(error: any): boolean {
    return (
      error.name === "AbortError" ||
      (error.message && error.message.includes("5"))
    );
  }

  // Delay helper for retries
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ===== AUTHENTICATION =====

  async login(credentials: LoginRequest): Promise<AuthResponse> {
    return this.request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
  }

  async register(userData: RegisterRequest): Promise<AuthResponse> {
    return this.request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

  async getCurrentUser(): Promise<ApiResponse<User>> {
    return this.request<ApiResponse<User>>("/api/auth/me");
  }

  async completeProfile(
    profileData: CompleteProfileRequest
  ): Promise<ApiResponse<User>> {
    return this.request<ApiResponse<User>>("/api/auth/complete-profile", {
      method: "POST",
      body: JSON.stringify(profileData),
    });
  }

  async logout(): Promise<ApiResponse> {
    return this.request<ApiResponse>("/api/auth/logout", {
      method: "POST",
    });
  }

  // ===== MEDIA MANAGEMENT =====

  async getMedia(filters: MediaFilters = {}): Promise<MediaListResponse> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach(v => params.append(key, v));
        } else {
          params.set(key, String(value));
        }
      }
    });

    return this.request<MediaListResponse>(`/api/media?${params.toString()}`);
  }

  async getMediaById(id: string): Promise<ApiResponse<Media>> {
    return this.request<ApiResponse<Media>>(`/api/media/${id}`);
  }

  async uploadMedia(
    mediaData: MediaUploadRequest
  ): Promise<ApiResponse<Media>> {
    const formData = new FormData();

    // Add text fields
    formData.append("title", mediaData.title);
    if (mediaData.description)
      formData.append("description", mediaData.description);
    formData.append("contentType", mediaData.contentType);
    formData.append("category", mediaData.category);
    if (mediaData.duration)
      formData.append("duration", String(mediaData.duration));

    // Add arrays
    if (mediaData.topics) {
      mediaData.topics.forEach(topic => formData.append("topics", topic));
    }

    // Add files
    formData.append("file", mediaData.file);
    if (mediaData.thumbnail) formData.append("thumbnail", mediaData.thumbnail);

    // Override headers for multipart/form-data
    const headers = this.getHeaders();
    delete headers["Content-Type"]; // Let browser set content-type with boundary

    return this.request<ApiResponse<Media>>("/api/media/upload", {
      method: "POST",
      headers,
      body: formData,
    });
  }

  async bookmarkMedia(mediaId: string): Promise<ApiResponse> {
    return this.request<ApiResponse>(`/api/media/${mediaId}/bookmark`, {
      method: "POST",
    });
  }

  async recordInteraction(
    mediaId: string,
    interaction: InteractionRequest
  ): Promise<ApiResponse> {
    return this.request<ApiResponse>(`/api/media/${mediaId}/interact`, {
      method: "POST",
      body: JSON.stringify(interaction),
    });
  }

  async trackView(
    mediaId: string,
    viewData: TrackViewRequest
  ): Promise<ApiResponse> {
    return this.request<ApiResponse>(`/api/media/${mediaId}/track-view`, {
      method: "POST",
      body: JSON.stringify(viewData),
    });
  }

  async getActionStatus(mediaId: string): Promise<ApiResponse> {
    return this.request<ApiResponse>(`/api/media/${mediaId}/action-status`);
  }

  // ===== LIVE STREAMING =====

  async startLiveStream(
    streamData: LiveStreamRequest
  ): Promise<ApiResponse<LiveStream>> {
    return this.request<ApiResponse<LiveStream>>("/api/media/live/start", {
      method: "POST",
      body: JSON.stringify(streamData),
    });
  }

  async getLiveStreams(): Promise<ApiResponse<LiveStream[]>> {
    return this.request<ApiResponse<LiveStream[]>>("/api/media/live");
  }

  async scheduleLiveStream(
    streamData: ScheduledLiveStreamRequest
  ): Promise<ApiResponse<LiveStream>> {
    return this.request<ApiResponse<LiveStream>>("/api/media/live/schedule", {
      method: "POST",
      body: JSON.stringify(streamData),
    });
  }

  async getStreamStatus(streamId: string): Promise<ApiResponse> {
    return this.request<ApiResponse>(`/api/media/live/${streamId}/status`);
  }

  async getStreamStats(streamId: string): Promise<ApiResponse> {
    return this.request<ApiResponse>(`/api/media/live/${streamId}/stats`);
  }

  async goLive(streamData: GoLiveRequest): Promise<ApiResponse<LiveStream>> {
    return this.request<ApiResponse<LiveStream>>("/api/media/live/go-live", {
      method: "POST",
      body: JSON.stringify(streamData),
    });
  }

  // ===== AI CHATBOT =====

  async getChatbotInfo(): Promise<ApiResponse<ChatbotInfo>> {
    return this.request<ApiResponse<ChatbotInfo>>("/api/ai-chatbot/info");
  }

  async sendMessage(message: AIMessageRequest): Promise<AIResponse> {
    return this.request<AIResponse>("/api/ai-chatbot/message", {
      method: "POST",
      body: JSON.stringify(message),
    });
  }

  async getChatHistory(): Promise<
    ApiResponse<{ messages: ChatMessage[]; totalMessages: number }>
  > {
    return this.request<
      ApiResponse<{ messages: ChatMessage[]; totalMessages: number }>
    >("/api/ai-chatbot/history");
  }

  async clearChatHistory(): Promise<ApiResponse> {
    return this.request<ApiResponse>("/api/ai-chatbot/history", {
      method: "DELETE",
    });
  }

  async getSessionStats(): Promise<ApiResponse> {
    return this.request<ApiResponse>("/api/ai-chatbot/stats");
  }

  // ===== BOOKMARKS =====

  async getBookmarks(): Promise<BookmarkListResponse> {
    return this.request<BookmarkListResponse>(
      "/api/bookmarks/get-bookmarked-media"
    );
  }

  async addBookmark(mediaId: string): Promise<ApiResponse> {
    return this.request<ApiResponse>(`/api/bookmarks/${mediaId}`, {
      method: "POST",
    });
  }

  async removeBookmark(mediaId: string): Promise<ApiResponse> {
    return this.request<ApiResponse>(`/api/bookmarks/${mediaId}`, {
      method: "DELETE",
    });
  }

  // ===== TRENDING ANALYTICS =====

  async getTrendingUsers(): Promise<ApiResponse<TrendingUser[]>> {
    return this.request<ApiResponse<TrendingUser[]>>("/api/trending/trending");
  }

  async getMostViewedUsers(): Promise<ApiResponse<TrendingUser[]>> {
    return this.request<ApiResponse<TrendingUser[]>>(
      "/api/trending/most-viewed"
    );
  }

  async getTrendingAnalytics(): Promise<ApiResponse> {
    return this.request<ApiResponse>("/api/trending/analytics");
  }

  // ===== USER MANAGEMENT =====

  async getUsers(filters: UserFilters = {}): Promise<UserListResponse> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.set(key, String(value));
      }
    });

    return this.request<UserListResponse>(`/api/users?${params.toString()}`);
  }

  async getUserById(userId: string): Promise<ApiResponse<User>> {
    return this.request<ApiResponse<User>>(`/api/users/${userId}`);
  }

  async updateUser(
    userId: string,
    userData: Partial<User>
  ): Promise<ApiResponse<User>> {
    return this.request<ApiResponse<User>>(`/api/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify(userData),
    });
  }

  // ===== HEALTH & STATUS =====

  async getHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>("/health");
  }

  async testConnection(): Promise<ApiResponse> {
    return this.request<ApiResponse>("/api/test");
  }

  // ===== UTILITY METHODS =====

  async getApiInfo(): Promise<ApiResponse> {
    return this.request<ApiResponse>("/");
  }

  // ===== CONTENT INTERACTIONS (LIKE SYSTEM) =====

  /**
   * Toggle like on any content type (media, artist, merch, ebook, podcast)
   * 
   * IMPORTANT: This is the primary method for liking/unliking content.
   * - Returns immediately with the new like state and count
   * - Optimistic updates are handled by the backend
   * - Use the returned `liked` and `likeCount` as source of truth
   * 
   * @param contentId - MongoDB ObjectId of the content
   * @param contentType - Type of content: "media", "artist", "merch", "ebook", "podcast"
   * @returns ToggleLikeResponse with contentId, liked state, and likeCount
   * 
   * @example
   * ```typescript
   * // Like/unlike a video
   * const result = await client.toggleContentLike('video-id', 'media');
   * console.log(result.liked); // true if liked, false if unliked
   * console.log(result.likeCount); // updated total like count
   * ```
   */
  async toggleContentLike(
    contentId: string,
    contentType: ContentType
  ): Promise<ApiResponse<ToggleLikeResponse>> {
    return this.request<ApiResponse<ToggleLikeResponse>>(
      `/api/content/${contentType}/${contentId}/like`,
      {
        method: "POST",
        body: JSON.stringify({}),
      }
    );
  }

  /**
   * Get content metadata including like count and user interaction status
   * 
   * Use this to get the initial like state when displaying content.
   * Requires authentication to get user-specific interactions (hasLiked, etc.)
   * 
   * @param contentId - MongoDB ObjectId of the content
   * @param contentType - Type of content
   * @returns ContentMetadata with stats and userInteractions
   * 
   * @example
   * ```typescript
   * const metadata = await client.getContentMetadata('video-id', 'media');
   * console.log(metadata.userInteractions.liked); // true if user liked
   * console.log(metadata.likes); // total like count
   * ```
   */
  async getContentMetadata(
    contentId: string,
    contentType: ContentType
  ): Promise<ApiResponse<ContentMetadata>> {
    return this.request<ApiResponse<ContentMetadata>>(
      `/api/content/${contentType}/${contentId}/metadata`
    );
  }

  /**
   * Get metadata for multiple content IDs in a single request
   * 
   * IMPORTANT: This is REQUIRED for feeds/lists because the feed endpoint
   * does NOT include hasLiked status. After loading a feed, call this method
   * with all visible content IDs to get like status for the current user.
   * 
   * @param contentIds - Array of MongoDB ObjectIds
   * @param contentType - Type of content (default: "media")
   * @returns Object map keyed by content ID with metadata for each
   * 
   * @example
   * ```typescript
   * // After loading feed
   const feed = await client.getMedia();
   * const contentIds = feed.media.map(m => m.id);
   * 
   * // Get like status for all items
   * const batch = await client.getBatchContentMetadata(contentIds, 'media');
   * 
   * // Merge into feed data
   * const feedWithLikes = feed.media.map(item => ({
   *   ...item,
   *   hasLiked: batch.data[item.id]?.userInteractions?.liked || false,
   *   likeCount: batch.data[item.id]?.likes || 0
   * }));
   * ```
   */
  async getBatchContentMetadata(
    contentIds: string[],
    contentType: ContentType = "media"
  ): Promise<ApiResponse<BatchContentMetadata>> {
    return this.request<ApiResponse<BatchContentMetadata>>(
      "/api/content/batch-metadata",
      {
        method: "POST",
        body: JSON.stringify({ contentIds, contentType }),
      }
    );
  }

  /**
   * Get paginated list of users who liked the content
   * 
   * @param contentId - MongoDB ObjectId of the content
   * @param contentType - Type of content
   * @param page - Page number (default: 1)
   * @param limit - Items per page (default: 20)
   * @returns ContentLikersResponse with list of users
   */
  async getContentLikers(
    contentId: string,
    contentType: ContentType,
    page: number = 1,
    limit: number = 20
  ): Promise<ApiResponse<ContentLikersResponse>> {
    return this.request<ApiResponse<ContentLikersResponse>>(
      `/api/content/${contentType}/${contentId}/likers?page=${page}&limit=${limit}`
    );
  }

  /**
   * Add a comment to content
   * 
   * @param contentId - MongoDB ObjectId of the content
   * @param contentType - Type of content (only "media" supported for comments)
   * @param commentData - Comment content and optional parentCommentId for replies
   * @returns The created comment
   */
  async addComment(
    contentId: string,
    contentType: ContentType,
    commentData: AddCommentRequest
  ): Promise<ApiResponse<Comment>> {
    return this.request<ApiResponse<Comment>>(
      `/api/content/${contentType}/${contentId}/comment`,
      {
        method: "POST",
        body: JSON.stringify(commentData),
      }
    );
  }

  /**
   * Get comments for content with pagination
   * 
   * @param contentId - MongoDB ObjectId of the content
   * @param contentType - Type of content
   * @param page - Page number (default: 1)
   * @param limit - Comments per page (default: 20)
   * @param sortBy - Sort order: "newest", "oldest", or "top" (default: "newest")
   * @returns CommentsResponse with comments and pagination info
   */
  async getComments(
    contentId: string,
    contentType: ContentType,
    page: number = 1,
    limit: number = 20,
    sortBy: "newest" | "oldest" | "top" = "newest"
  ): Promise<ApiResponse<CommentsResponse>> {
    return this.request<ApiResponse<CommentsResponse>>(
      `/api/content/${contentType}/${contentId}/comments?page=${page}&limit=${limit}&sortBy=${sortBy}`
    );
  }

  /**
   * Delete a comment (owner only)
   * 
   * @param commentId - MongoDB ObjectId of the comment
   * @returns Success response
   */
  async deleteComment(commentId: string): Promise<ApiResponse> {
    return this.request<ApiResponse>(`/api/content/comments/${commentId}`, {
      method: "DELETE",
    });
  }

  /**
   * Edit a comment (owner only)
   * 
   * @param commentId - MongoDB ObjectId of the comment
   * @param content - New comment content
   * @returns The updated comment
   */
  async editComment(
    commentId: string,
    content: string
  ): Promise<ApiResponse<Comment>> {
    return this.request<ApiResponse<Comment>>(
      `/api/content/comments/${commentId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ content }),
      }
    );
  }

  /**
   * Share content to social platforms
   * 
   * @param contentId - MongoDB ObjectId of the content
   * @param contentType - Type of content
   * @param shareData - Optional platform and message
   * @returns ShareContentResponse with share count and URLs
   */
  async shareContent(
    contentId: string,
    contentType: ContentType,
    shareData: ShareContentRequest = {}
  ): Promise<ApiResponse<ShareContentResponse>> {
    return this.request<ApiResponse<ShareContentResponse>>(
      `/api/content/${contentType}/${contentId}/share`,
      {
        method: "POST",
        body: JSON.stringify(shareData),
      }
    );
  }

  /**
   * Record a view/listen/read event with deduplication
   * 
   * @param contentId - MongoDB ObjectId of the content
   * @param contentType - Type of content
   * @param viewData - Optional duration, progress, and completion status
   * @returns RecordViewResponse with updated view count
   */
  async recordContentView(
    contentId: string,
    contentType: ContentType,
    viewData: RecordViewRequest = {}
  ): Promise<ApiResponse<RecordViewResponse>> {
    return this.request<ApiResponse<RecordViewResponse>>(
      `/api/content/${contentType}/${contentId}/view`,
      {
        method: "POST",
        body: JSON.stringify(viewData),
      }
    );
  }
}

// Export default instance
export default JevahClient;

// Export types
export * from "./types";
