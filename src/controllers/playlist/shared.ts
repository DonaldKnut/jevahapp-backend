import { Types } from "mongoose";
import { Media } from "../../models/media.model";
import { CopyrightFreeSong } from "../../models/copyrightFreeSong.model";

export interface CreatePlaylistBody {
  name: string;
  description?: string;
  isPublic?: boolean;
  coverImageUrl?: string;
  tags?: string[];
}

export interface AddTrackToPlaylistBody {
  mediaId?: string; // For regular Media items
  copyrightFreeSongId?: string; // For copyright-free songs
  notes?: string;
  position?: number; // Optional position to insert at
}

export interface UpdatePlaylistBody {
  name?: string;
  description?: string;
  isPublic?: boolean;
  coverImageUrl?: string;
  tags?: string[];
}

export interface ReorderTracksBody {
  tracks: Array<{
    mediaId?: string;
    copyrightFreeSongId?: string;
    trackType: "media" | "copyrightFree";
    order: number;
  }>;
}

/**
 * Professional helper: Populate playlist tracks from both collections
 * Returns unified format for frontend consumption
 */
export async function populatePlaylistTracks(playlist: any) {
  if (!playlist || !playlist.tracks || playlist.tracks.length === 0) {
    return playlist;
  }

  // Separate track IDs by type
  const mediaIds: Types.ObjectId[] = [];
  const copyrightFreeIds: Types.ObjectId[] = [];

  playlist.tracks.forEach((track: any) => {
    // Backward compatibility: if trackType doesn't exist, assume it's media (old format)
    if (!track.trackType && track.mediaId) {
      track.trackType = "media"; // Auto-migrate old tracks
    }

    if (track.trackType === "media" && track.mediaId) {
      mediaIds.push(track.mediaId);
    } else if (track.trackType === "copyrightFree" && track.copyrightFreeSongId) {
      copyrightFreeIds.push(track.copyrightFreeSongId);
    }
  });

  // Fetch both collections in parallel (performance optimization)
  const [mediaItems, copyrightFreeSongs] = await Promise.all([
    mediaIds.length > 0
      ? Media.find({ _id: { $in: mediaIds } })
          .populate("uploadedBy", "firstName lastName avatar")
          .lean()
      : Promise.resolve([]),
    copyrightFreeIds.length > 0
      ? CopyrightFreeSong.find({ _id: { $in: copyrightFreeIds } })
          .populate("uploadedBy", "firstName lastName avatar")
          .lean()
      : Promise.resolve([]),
  ]);

  // Create lookup maps for O(1) access
  const mediaMap = new Map(mediaItems.map((m: any) => [String(m._id), m]));
  const copyrightFreeMap = new Map(
    copyrightFreeSongs.map((s: any) => [String(s._id), s])
  );

  // Transform tracks to unified format
  const populatedTracks = playlist.tracks.map((track: any) => {
    const trackData = track.toObject ? track.toObject() : track;

    // Backward compatibility: auto-detect trackType if missing
    if (!trackData.trackType) {
      if (trackData.mediaId) {
        trackData.trackType = "media";
      } else if (trackData.copyrightFreeSongId) {
        trackData.trackType = "copyrightFree";
      }
    }

    let content: any = null;

    if (trackData.trackType === "media" && trackData.mediaId) {
      const media = mediaMap.get(String(trackData.mediaId));
      if (media) {
        content = {
          _id: media._id,
          title: media.title,
          thumbnailUrl: media.thumbnailUrl,
          fileUrl: media.fileUrl,
          duration: media.duration,
          artistName:
            media.speaker ||
            (media.uploadedBy
              ? `${media.uploadedBy.firstName || ""} ${media.uploadedBy.lastName || ""}`.trim() ||
                "Unknown"
              : "Unknown"),
          contentType: media.contentType,
          uploadedBy: media.uploadedBy,
        };
      }
    } else if (trackData.trackType === "copyrightFree" && trackData.copyrightFreeSongId) {
      const song = copyrightFreeMap.get(String(trackData.copyrightFreeSongId));
      if (song) {
        content = {
          _id: song._id,
          title: song.title,
          thumbnailUrl: song.thumbnailUrl,
          fileUrl: song.fileUrl,
          duration: song.duration,
          artistName: song.singer || "Unknown",
          contentType: "music",
          uploadedBy: song.uploadedBy,
        };
      }
    }

    return {
      _id: trackData._id,
      trackType: trackData.trackType,
      mediaId: trackData.mediaId || null,
      copyrightFreeSongId: trackData.copyrightFreeSongId || null,
      content, // Unified content object (frontend doesn't need to care about source)
      addedAt: trackData.addedAt,
      addedBy: trackData.addedBy,
      order: trackData.order,
      notes: trackData.notes,
    };
  });

  // Return playlist with populated tracks
  const playlistObj = playlist.toObject ? playlist.toObject() : playlist;
  return {
    ...playlistObj,
    tracks: populatedTracks,
  };
}
