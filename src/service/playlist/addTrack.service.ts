import { Types } from "mongoose";
import { Playlist } from "../../models/playlist.model";
import { Media } from "../../models/media.model";
import { CopyrightFreeSong } from "../../models/copyrightFreeSong.model";
import {
  populatePlaylistTracks,
  playlistOwnerId,
  invalidatePlaylistCaches,
} from "../../controllers/playlist/shared";

export type TrackType = "media" | "copyrightFree";

export interface AddPlaylistTrackInput {
  playlistId: string;
  userId: string;
  trackType: TrackType;
  trackId: string;
  notes?: string;
  position?: number;
}

export type AddPlaylistTrackResult =
  | { ok: true; playlist: any; alreadyExists?: boolean }
  | { ok: false; status: number; error: string; code?: string };

/**
 * Race-safe add: atomic filter prevents duplicate $push under concurrent POSTs.
 * Mongo cannot unique-index "values inside one array", so $elemMatch + $push is
 * the authoritative uniqueness guard.
 */
export async function addTrackToPlaylistAtomic(
  input: AddPlaylistTrackInput
): Promise<AddPlaylistTrackResult> {
  const { playlistId, userId, trackType, trackId, notes, position } = input;

  if (!Types.ObjectId.isValid(playlistId) || !Types.ObjectId.isValid(trackId)) {
    return { ok: false, status: 400, error: "Invalid playlist or track ID" };
  }

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    return { ok: false, status: 404, error: "Playlist not found" };
  }
  if (playlistOwnerId(playlist) !== String(userId)) {
    return {
      ok: false,
      status: 403,
      error: "You can only add tracks to your own playlists",
    };
  }

  if (trackType === "media") {
    const media = await Media.findById(trackId);
    if (!media) {
      return { ok: false, status: 404, error: "Media not found" };
    }
  } else {
    const song = await CopyrightFreeSong.findById(trackId);
    if (!song) {
      return { ok: false, status: 404, error: "Copyright-free song not found" };
    }
    const url = String(
      (song as any).audio?.playbackUrl || (song as any).fileUrl || ""
    );
    const status = String((song as any).processing?.status || "").toLowerCase();
    if (
      url.startsWith("pending://") ||
      status === "pending" ||
      status === "failed"
    ) {
      return {
        ok: false,
        status: 400,
        error: "Song is not ready to add to a playlist yet",
        code: "TRACK_NOT_READY",
      };
    }
  }

  const order =
    position !== undefined ? position : playlist.tracks?.length || 0;

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

  const duplicateFilter =
    trackType === "media"
      ? {
          tracks: {
            $elemMatch: {
              trackType: "media",
              mediaId: new Types.ObjectId(trackId),
            },
          },
        }
      : {
          tracks: {
            $elemMatch: {
              trackType: "copyrightFree",
              copyrightFreeSongId: new Types.ObjectId(trackId),
            },
          },
        };

  // If already present, return populated playlist (idempotent success for FE)
  const existing = await Playlist.findOne({
    _id: playlistId,
    ...duplicateFilter,
  });
  if (existing) {
    const populated = await populatePlaylistTracks(existing);
    return { ok: true, playlist: populated, alreadyExists: true };
  }

  // Shift orders when inserting mid-list
  if (position !== undefined && position < (playlist.tracks?.length || 0)) {
    await Playlist.updateOne(
      { _id: playlistId },
      { $inc: { "tracks.$[t].order": 1 } },
      { arrayFilters: [{ "t.order": { $gte: position } }] }
    );
  }

  const updated = await Playlist.findOneAndUpdate(
    {
      _id: new Types.ObjectId(playlistId),
      userId: new Types.ObjectId(userId),
      ...{
        // Only push when the track is not already present (race-safe)
        $nor: [duplicateFilter],
      },
    },
    {
      $push: { tracks: newTrack },
      $inc: { totalTracks: 1 },
    },
    { new: true }
  );

  if (!updated) {
    // Lost race — treat as already exists
    const again = await Playlist.findById(playlistId);
    if (again) {
      const populated = await populatePlaylistTracks(again);
      return { ok: true, playlist: populated, alreadyExists: true };
    }
    return { ok: false, status: 404, error: "Playlist not found" };
  }

  await invalidatePlaylistCaches(String(userId), playlistId);
  const populated = await populatePlaylistTracks(updated);
  return { ok: true, playlist: populated, alreadyExists: false };
}
