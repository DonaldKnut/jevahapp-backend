import { Types } from "mongoose";

export interface MediaInput {
title: string;
description?: string;
contentType: "music" | "videos" | "books" | "live" | "sermon";
category?: string;
uploadedBy: Types.ObjectId | string;
file?: Buffer;
fileMimeType?: string;
thumbnail?: Buffer;
thumbnailMimeType?: string;
topics?: string[];
duration?: number;
isLive?: boolean;
liveStreamStatus?: "scheduled" | "live" | "ended" | "archived";
streamKey?: string;
rtmpUrl?: string;
playbackUrl?: string;
isDownloadable?: boolean;
viewThreshold?: number;
}

export interface MediaInteractionInput {
userIdentifier: string;
mediaIdentifier: string;
interactionType: "view" | "listen" | "read" | "download";
duration?: number;
}

export interface MediaUserActionInput {
userIdentifier: string;
mediaIdentifier: string;
actionType: "favorite" | "share";
metadata?: Record<string, any>;
}

export interface ViewTrackingInput {
userIdentifier: string;
mediaIdentifier: string;
duration: number;
isComplete?: boolean;
}

export interface DownloadInput {
userIdentifier: string;
mediaIdentifier: string;
fileSize: number;
}

export interface ShareInput {
userIdentifier: string;
mediaIdentifier: string;
platform?: string;
}

export interface PopulatedMedia {
_id: Types.ObjectId;
title: string;
contentType: "music" | "videos" | "books" | "live";
category?: string;
createdAt: Date;
thumbnailUrl?: string;
fileUrl?: string;
topics?: string[];
uploadedBy: {
  _id: Types.ObjectId;
  firstName?: string;
  lastName?: string;
  avatar?: string;
};
duration?: number;
}

export interface LeanUserViewedMedia {
_id: Types.ObjectId;
user: Types.ObjectId;
viewedMedia: { media: PopulatedMedia; viewedAt: Date }[];
__v: number;
}

export type DurationRangeKey = "short" | "medium" | "long";
