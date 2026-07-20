/**
 * Shared types and tiny helpers for media controllers.
 * Heavy verification/moderation lives in services — do not reintroduce dead paths here.
 */

export interface UploadMediaRequestBody {
  title: string;
  description?: string;
  contentType: "music" | "videos" | "books" | "live" | "sermon";
  category?: string;
  topics?: string[] | string;
  duration?: number;
}

export interface InteractionRequestBody {
  interactionType: "view" | "listen" | "read" | "download";
}

export interface UserActionRequestBody {
  actionType: "favorite" | "share";
}

export interface SearchQueryParameters {
  search?: string;
  contentType?: string;
  category?: string;
  topics?: string;
  sort?: string;
  page?: string;
  limit?: string;
  creator?: string;
  duration?: "short" | "medium" | "long";
  startDate?: string;
  endDate?: string;
}

export interface ViewTrackingRequestBody {
  duration: number;
  isComplete?: boolean;
}

export interface DownloadRequestBody {
  fileSize?: number;
}

export interface ShareRequestBody {
  platform?: string;
}

export const extractObjectKeyFromUrl = (url: string): string | null => {
  try {
    if (url.includes("/")) {
      const parts = url.split("/");
      return parts.slice(3).join("/");
    }
    return url;
  } catch {
    return null;
  }
};

export const mapContentType = (contentType: string): "video" | "audio" | "image" => {
  switch (contentType) {
    case "videos":
    case "sermon":
      return "video";
    case "audio":
    case "music":
    case "devotional":
      return "audio";
    case "ebook":
    case "books":
      return "image";
    default:
      return "video";
  }
};
