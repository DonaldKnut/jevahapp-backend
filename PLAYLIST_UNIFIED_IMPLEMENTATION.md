# Professional Playlist System - Unified Implementation Guide

**Architecture:** Unified Playlists Supporting Both Media & Copyright-Free Songs

---

## Professional Implementation Pattern

### The Pattern: Type Discriminator + Optional Fields

This is the industry-standard approach (used by Spotify, Apple Music, YouTube Music).

---

## 1. Model Changes

### Update Playlist Track Schema

**File:** `src/models/playlist.model.ts`

```typescript
const playlistTrackSchema = new Schema(
  {
    // Content reference - one required (polymorphic)
    mediaId: {
      type: Schema.Types.ObjectId,
      ref: "Media",
      required: false,
    },
    copyrightFreeSongId: {
      type: Schema.Types.ObjectId,
      ref: "CopyrightFreeSong",
      required: false,
    },
    
    // Type discriminator (required)
    trackType: {
      type: String,
      enum: ["media", "copyrightFree"],
      required: true,
      index: true,
    },
    
    // Common metadata
    addedAt: {
      type: Date,
      default: Date.now,
    },
    addedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    order: {
      type: Number,
      required: true,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  { _id: false }
);

// Professional validation: Ensure exactly one content reference matches trackType
playlistTrackSchema.pre("validate", function (next) {
  const hasMedia = !!this.mediaId;
  const hasCopyrightFree = !!this.copyrightFreeSongId;
  
  // Must have exactly one
  if (!hasMedia && !hasCopyrightFree) {
    return next(new Error("Track must have either mediaId or copyrightFreeSongId"));
  }
  
  if (hasMedia && hasCopyrightFree) {
    return next(new Error("Track cannot have both mediaId and copyrightFreeSongId"));
  }
  
  // Validate trackType matches content reference
  if (this.trackType === "media" && !hasMedia) {
    return next(new Error("trackType 'media' requires mediaId"));
  }
  
  if (this.trackType === "copyrightFree" && !hasCopyrightFree) {
    return next(new Error("trackType 'copyrightFree' requires copyrightFreeSongId"));
  }
  
  next();
});
```

---

## 2. Controller Implementation

### Professional Add Track Endpoint

**File:** `src/controllers/playlist.controller.ts` → `addTrackToPlaylist()`

```typescript
export const addTrackToPlaylist = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { playlistId } = request.params;
    const userId = request.userId;

    if (!userId) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    if (!Types.ObjectId.isValid(playlistId)) {
      response.status(400).json({
        success: false,
        message: "Invalid playlist ID",
      });
      return;
    }

    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      response.status(404).json({
        success: false,
        message: "Playlist not found",
      });
      return;
    }

    // Check ownership
    if (playlist.userId.toString() !== userId) {
      response.status(403).json({
        success: false,
        message: "You can only add tracks to your own playlists",
      });
      return;
    }

    const { mediaId, copyrightFreeSongId, notes, position } = request.body;

    // Professional validation: Determine track type and validate
    let trackType: "media" | "copyrightFree" | null = null;
    let trackId: string | null = null;

    if (mediaId && copyrightFreeSongId) {
      response.status(400).json({
        success: false,
        error: "Cannot specify both mediaId and copyrightFreeSongId",
      });
      return;
    }

    if (mediaId) {
      trackType = "media";
      trackId = mediaId;
    } else if (copyrightFreeSongId) {
      trackType = "copyrightFree";
      trackId = copyrightFreeSongId;
    } else {
      response.status(400).json({
        success: false,
        error: "Either mediaId or copyrightFreeSongId is required",
      });
      return;
    }

    if (!Types.ObjectId.isValid(trackId)) {
      response.status(400).json({
        success: false,
        error: `Invalid ${trackType === "media" ? "media" : "copyright-free song"} ID`,
      });
      return;
    }

    // Verify content exists in appropriate collection
    let contentExists = false;
    if (trackType === "media") {
      const { Media } = await import("../models/media.model");
      const media = await Media.findById(trackId);
      contentExists = !!media;
    } else {
      const { CopyrightFreeSong } = await import("../models/copyrightFreeSong.model");
      const song = await CopyrightFreeSong.findById(trackId);
      contentExists = !!song;
    }

    if (!contentExists) {
      response.status(404).json({
        success: false,
        error: `${trackType === "media" ? "Media" : "Copyright-free song"} not found`,
      });
      return;
    }

    // Check for duplicate (check both fields)
    const existingTrack = playlist.tracks.find((t: any) => {
      if (trackType === "media") {
        return t.trackType === "media" && t.mediaId?.toString() === trackId;
      } else {
        return t.trackType === "copyrightFree" && t.copyrightFreeSongId?.toString() === trackId;
      }
    });

    if (existingTrack) {
      response.status(400).json({
        success: false,
        message: "This track is already in the playlist",
      });
      return;
    }

    // Determine order
    let order = position !== undefined ? position : playlist.tracks.length;

    // If inserting at specific position, update orders of subsequent tracks
    if (position !== undefined && position < playlist.tracks.length) {
      playlist.tracks.forEach((track: any) => {
        if (track.order >= position) {
          track.order += 1;
        }
      });
    }

    // Create track object
    const newTrack: any = {
      trackType,
      addedAt: new Date(),
      addedBy: new Types.ObjectId(userId),
      order,
      notes: notes?.trim(),
    };

    if (trackType === "media") {
      newTrack.mediaId = new Types.ObjectId(trackId);
    } else {
      newTrack.copyrightFreeSongId = new Types.ObjectId(trackId);
    }

    // Add track
    playlist.tracks.push(newTrack);
    playlist.totalTracks = playlist.tracks.length;
    await playlist.save();

    // Return populated playlist
    const populated = await populatePlaylistTracks(playlist);

    logger.info("Track added to playlist", {
      playlistId,
      trackId,
      trackType,
      userId,
    });

    response.status(200).json({
      success: true,
      message: "Track added to playlist successfully",
      data: populated,
    });
  } catch (error: any) {
    logger.error("Add track to playlist error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to add track to playlist",
      error: error.message,
    });
  }
};
```

---

## 3. Professional Population Helper

**File:** `src/controllers/playlist.controller.ts` (add at top)

```typescript
import { CopyrightFreeSong } from "../models/copyrightFreeSong.model";

/**
 * Professional helper: Populate playlist tracks from both collections
 * Returns unified format for frontend consumption
 */
async function populatePlaylistTracks(playlist: any) {
  if (!playlist || !playlist.tracks || playlist.tracks.length === 0) {
    return playlist;
  }

  // Separate track IDs by type
  const mediaIds: Types.ObjectId[] = [];
  const copyrightFreeIds: Types.ObjectId[] = [];

  playlist.tracks.forEach((track: any) => {
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
          artistName: media.speaker || 
            (media.uploadedBy ? `${media.uploadedBy.firstName} ${media.uploadedBy.lastName}`.trim() : "Unknown"),
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
          artistName: song.singer,
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
```

---

## 4. Update Other Endpoints

### Remove Track (support both types)

```typescript
export const removeTrackFromPlaylist = async (
  request: Request,
  response: Response
): Promise<void> => {
  // ... existing validation ...

  const { playlistId, mediaId, copyrightFreeSongId } = request.params;
  
  // Support removing by either ID
  const trackToRemove = playlist.tracks.find((t: any) => {
    if (mediaId && t.trackType === "media") {
      return t.mediaId?.toString() === mediaId;
    }
    if (copyrightFreeSongId && t.trackType === "copyrightFree") {
      return t.copyrightFreeSongId?.toString() === copyrightFreeSongId;
    }
    return false;
  });

  // ... rest of removal logic ...
};
```

---

## 5. Update Interface Types

**File:** `src/controllers/playlist.controller.ts`

```typescript
interface AddTrackToPlaylistBody {
  mediaId?: string;              // For regular Media
  copyrightFreeSongId?: string;  // For copyright-free songs
  notes?: string;
  position?: number;
}
```

---

## Summary: How a Pro Would Write It

### Key Professional Patterns:

1. **Type Discriminator** - `trackType` field makes it explicit
2. **Optional Fields** - `mediaId?` and `copyrightFreeSongId?` - one required
3. **Validation** - Schema-level validation ensures data integrity
4. **Unified Response** - Frontend sees consistent `content` object
5. **Parallel Fetching** - Performance-optimized population
6. **Error Handling** - Clear, specific error messages

### Frontend Benefits:

```typescript
// Frontend code is simple - doesn't care about source!
playlist.tracks.forEach(track => {
  <TrackCard
    title={track.content.title}
    artist={track.content.artistName}
    thumbnail={track.content.thumbnailUrl}
    fileUrl={track.content.fileUrl}
  />
});
```

**No conditional logic needed!** The backend normalizes everything.

---

## Next Steps

Would you like me to implement this unified playlist system now? It will:

1. ✅ Update playlist model to support both types
2. ✅ Extend all playlist endpoints
3. ✅ Add professional population helpers
4. ✅ Maintain backward compatibility
5. ✅ Include full validation and error handling

This is the professional, production-ready approach! 🚀

