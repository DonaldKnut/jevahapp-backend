// Core types for Jevah API

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string;
  avatarUpload?: string;
  section: "kids" | "adults";
  role:
    | "learner"
    | "parent"
    | "educator"
    | "moderator"
    | "admin"
    | "content_creator"
    | "vendor"
    | "church_admin"
    | "artist";
  isProfileComplete: boolean;
  isEmailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Media {
  id: string;
  title: string;
  description?: string;
  contentType: "music" | "videos" | "books" | "live";
  category:
    | "worship"
    | "inspiration"
    | "youth"
    | "teachings"
    | "marriage"
    | "counselling";
  fileUrl: string;
  thumbnailUrl?: string;
  topics?: string[];
  uploadedBy: string;
  viewCount: number;
  listenCount: number;
  readCount: number;
  downloadCount: number;
  favoriteCount: number;
  shareCount: number;
  isLive: boolean;
  liveStreamStatus?: "scheduled" | "live" | "ended" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface LiveStream {
  streamId: string;
  streamKey: string;
  rtmpUrl: string;
  playbackUrl: string;
  hlsUrl: string;
  dashUrl: string;
  title: string;
  description?: string;
  scheduledStart?: string;
  actualStart?: string;
  concurrentViewers: number;
}

export interface ChatMessage {
  id: string;
  message: string;
  isUser: boolean;
  timestamp: string;
}

export interface AIResponse {
  success: boolean;
  data: {
    message: string;
    timestamp: string;
  };
}

export interface ChatbotInfo {
  name: string;
  description: string;
  capabilities: string[];
  features: string[];
  mission: string;
  disclaimer: string;
}

export interface TrendingUser {
  userId: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  role: string;
  stats: {
    totalViews: number;
    totalInteractions: number;
    totalContent: number;
  };
}

export interface Bookmark {
  id: string;
  user: string;
  media: string;
  createdAt: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface MediaListResponse {
  success: boolean;
  media: Media[];
  pagination: PaginationInfo;
}

export interface UserListResponse {
  success: boolean;
  users: User[];
  pagination: PaginationInfo;
}

export interface BookmarkListResponse {
  success: boolean;
  media: Media[];
}

export interface AuthResponse {
  success: boolean;
  message: string;
  token?: string;
  refreshToken?: string;
  user?: User;
}

export interface HealthResponse {
  status: "healthy" | "unhealthy" | "error";
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
}

// Request types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  section: "kids" | "adults";
  role:
    | "learner"
    | "parent"
    | "educator"
    | "moderator"
    | "admin"
    | "content_creator"
    | "vendor"
    | "church_admin"
    | "artist";
}

export interface CompleteProfileRequest {
  age?: number;
  section: "kids" | "adults";
  role:
    | "learner"
    | "parent"
    | "educator"
    | "moderator"
    | "admin"
    | "content_creator"
    | "vendor"
    | "church_admin"
    | "artist";
  location?: string;
  hasConsentedToPrivacyPolicy: boolean;
  parentalControlEnabled?: boolean;
  parentEmail?: string;
}

export interface MediaUploadRequest {
  title: string;
  description?: string;
  contentType: "music" | "videos" | "books" | "live";
  category:
    | "worship"
    | "inspiration"
    | "youth"
    | "teachings"
    | "marriage"
    | "counselling";
  topics?: string[];
  duration?: number;
  file: File;
  thumbnail?: File;
}

export interface MediaFilters {
  search?: string;
  contentType?: "music" | "videos" | "books" | "live";
  category?:
    | "worship"
    | "inspiration"
    | "youth"
    | "teachings"
    | "marriage"
    | "counselling";
  topics?: string[];
  sort?: string;
  page?: number;
  limit?: number;
  creator?: string;
  duration?: "short" | "medium" | "long";
  startDate?: string;
  endDate?: string;
}

export interface UserFilters {
  search?: string;
  role?: string;
  section?: "kids" | "adults";
  isProfileComplete?: boolean;
  isEmailVerified?: boolean;
  page?: number;
  limit?: number;
}

export interface InteractionRequest {
  interactionType: "view" | "listen" | "read" | "download";
}

export interface TrackViewRequest {
  duration: number;
  isComplete?: boolean;
}

export interface LiveStreamRequest {
  title: string;
  description?: string;
  category?: string;
  topics?: string[];
}

export interface ScheduledLiveStreamRequest extends LiveStreamRequest {
  scheduledStart: string;
  scheduledEnd?: string;
}

export interface AIMessageRequest {
  message: string;
}

// Configuration types
export interface JevahConfig {
  baseURL?: string;
  token?: string;
  timeout?: number;
  retries?: number;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
}




