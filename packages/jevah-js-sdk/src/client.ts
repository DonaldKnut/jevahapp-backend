import {
  User,
  Media,
  LiveStream,
  ChatMessage,
  AIResponse,
  ChatbotInfo,
  TrendingUser,
  Bookmark,
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
  RequestOptions,
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

      const data = await response.json();

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
}

// Export default instance
export default JevahClient;

// Export types
export * from "./types";






