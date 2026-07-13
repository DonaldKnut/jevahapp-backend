import { Types } from "mongoose";
import mongoose from "mongoose";
import { CopyrightFreeSongInteraction } from "../../../models/copyrightFreeSongInteraction.model";
import { CopyrightFreeSong } from "../../../models/copyrightFreeSong.model";
import logger from "../../../utils/logger";
import type { CopyrightFreeSongInteractionDeps } from "./deps";

export function isTransactionUnsupportedError(error: any): boolean {
  if (!error) return false;
  const msg = (error.message || "").toLowerCase();
  const code = error.code ?? error.codeName;
  return (
    code === 72 ||
    code === 251 ||
    code === "IllegalOperation" ||
    msg.includes("replica set") ||
    msg.includes("transaction numbers are only allowed") ||
    msg.includes("transaction is not supported")
  );
}

export async function recordViewWithoutTransaction(
  deps: CopyrightFreeSongInteractionDeps,
  userIdObj: Types.ObjectId,
  songIdObj: Types.ObjectId,
  song: { _id: Types.ObjectId },
  payload: { durationMs?: number; progressPct?: number; isComplete?: boolean }
): Promise<{ viewCount: number; hasViewed: boolean; isNewView: boolean }> {
  const { durationMs = 0, progressPct = 0, isComplete = false } = payload;
  const now = new Date();

  const existingInteraction = await CopyrightFreeSongInteraction.findOne({
    userId: userIdObj,
    songId: songIdObj,
  });

  if (existingInteraction?.hasViewed) {
    const maxDurationMs = Math.max(existingInteraction.durationMs || 0, durationMs || 0);
    const maxProgressPct = Math.max(existingInteraction.progressPct || 0, progressPct || 0);
    existingInteraction.durationMs = maxDurationMs;
    existingInteraction.progressPct = maxProgressPct;
    existingInteraction.isComplete = existingInteraction.isComplete || isComplete;
    existingInteraction.lastViewedAt = now;
    await existingInteraction.save();

    await deps.songService.ensureViewCountInvariant(songIdObj.toString());
    const updatedSong = await CopyrightFreeSong.findById(songIdObj).select("viewCount likeCount").lean() as { viewCount?: number; likeCount?: number } | null;
    const viewCount = Math.max(updatedSong?.viewCount ?? 0, updatedSong?.likeCount ?? 0);
    return {
      viewCount,
      hasViewed: true,
      isNewView: false,
    };
  }

  const maxDurationMs = Math.max(existingInteraction?.durationMs || 0, durationMs || 0);
  const maxProgressPct = Math.max(existingInteraction?.progressPct || 0, progressPct || 0);
  const updatedIsComplete = (existingInteraction?.isComplete || false) || isComplete;

  try {
    await CopyrightFreeSongInteraction.findOneAndUpdate(
      { userId: userIdObj, songId: songIdObj, hasViewed: { $ne: true } },
      {
        $set: {
          hasViewed: true,
          lastViewedAt: now,
          durationMs: maxDurationMs,
          progressPct: maxProgressPct,
          isComplete: updatedIsComplete,
        },
        $setOnInsert: {
          userId: userIdObj,
          songId: songIdObj,
          hasLiked: false,
          hasShared: false,
          viewedAt: now,
        },
      },
      { upsert: true, new: false, runValidators: true }
    );

    await CopyrightFreeSong.findByIdAndUpdate(songIdObj, { $inc: { viewCount: 1 } });
    await deps.songService.ensureViewCountInvariant(songIdObj.toString());
    const updatedSong = await CopyrightFreeSong.findById(songIdObj).select("viewCount likeCount").lean() as { viewCount?: number; likeCount?: number } | null;
    const viewCount = Math.max(updatedSong?.viewCount ?? 0, updatedSong?.likeCount ?? 0);
    return {
      viewCount,
      hasViewed: true,
      isNewView: true,
    };
  } catch (err: any) {
    if (err.code === 11000 || (err.message && String(err.message).includes("duplicate"))) {
      const existingView = await CopyrightFreeSongInteraction.findOne({
        userId: userIdObj,
        songId: songIdObj,
      });
      if (existingView) {
        const maxD = Math.max(existingView.durationMs || 0, durationMs || 0);
        const maxP = Math.max(existingView.progressPct || 0, progressPct || 0);
        existingView.durationMs = maxD;
        existingView.progressPct = maxP;
        existingView.isComplete = existingView.isComplete || isComplete;
        existingView.lastViewedAt = now;
        await existingView.save();
      }
      await deps.songService.ensureViewCountInvariant(songIdObj.toString());
      const currentSong = await CopyrightFreeSong.findById(songIdObj).select("viewCount likeCount").lean() as { viewCount?: number; likeCount?: number } | null;
      const viewCount = Math.max(currentSong?.viewCount ?? 0, currentSong?.likeCount ?? 0);
      return {
        viewCount,
        hasViewed: true,
        isNewView: false,
      };
    }
    throw err;
  }
}

export async function recordView(
  deps: CopyrightFreeSongInteractionDeps,
  userId: string,
  songId: string,
  payload: {
    durationMs?: number;
    progressPct?: number;
    isComplete?: boolean;
  } = {}
): Promise<{ viewCount: number; hasViewed: boolean; isNewView: boolean }> {
  const { durationMs = 0, progressPct = 0, isComplete = false } = payload;

  try {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error(`Invalid userId format: ${userId}`);
    }
    if (!Types.ObjectId.isValid(songId)) {
      throw new Error(`Invalid songId format: ${songId}`);
    }

    const userIdObj = new Types.ObjectId(userId);
    const songIdObj = new Types.ObjectId(songId);

    const song = await CopyrightFreeSong.findById(songIdObj);
    if (!song) {
      throw new Error("Song not found");
    }

    const now = new Date();
    const isQualified = durationMs >= 3000 || progressPct >= 25 || isComplete === true;

    const existingInteraction = await CopyrightFreeSongInteraction.findOne({
      userId: userIdObj,
      songId: songIdObj,
    });

    if (existingInteraction && existingInteraction.hasViewed) {
      const maxDurationMs = Math.max(existingInteraction.durationMs || 0, durationMs || 0);
      const maxProgressPct = Math.max(existingInteraction.progressPct || 0, progressPct || 0);
      const updatedIsComplete = existingInteraction.isComplete || isComplete;

      existingInteraction.durationMs = maxDurationMs;
      existingInteraction.progressPct = maxProgressPct;
      existingInteraction.isComplete = updatedIsComplete;
      existingInteraction.lastViewedAt = now;
      await existingInteraction.save();

      await deps.songService.ensureViewCountInvariant(songId);
      const updatedSong = await CopyrightFreeSong.findById(songIdObj).select("viewCount likeCount").lean() as { viewCount?: number; likeCount?: number } | null;
      const viewCount = Math.max(updatedSong?.viewCount ?? 0, updatedSong?.likeCount ?? 0);
      return {
        viewCount,
        hasViewed: true,
        isNewView: false,
      };
    }

    if (!isQualified) {
      await deps.songService.ensureViewCountInvariant(songId);
      const currentSong = await CopyrightFreeSong.findById(songIdObj).select("viewCount likeCount").lean() as { viewCount?: number; likeCount?: number } | null;
      return {
        viewCount: Math.max(currentSong?.viewCount ?? 0, currentSong?.likeCount ?? 0),
        hasViewed: false,
        isNewView: false,
      };
    }

    const session = await mongoose.startSession();

    try {
      let isNewView = false;
      let viewCount = 0;

      await session.withTransaction(async () => {
        const existingViewInTx = await CopyrightFreeSongInteraction.findOne(
          {
            userId: userIdObj,
            songId: songIdObj,
            hasViewed: true,
          },
          null,
          { session }
        );

        if (existingViewInTx) {
          const maxDurationMs = Math.max(existingViewInTx.durationMs || 0, durationMs || 0);
          const maxProgressPct = Math.max(existingViewInTx.progressPct || 0, progressPct || 0);
          const updatedIsComplete = existingViewInTx.isComplete || isComplete;

          existingViewInTx.durationMs = maxDurationMs;
          existingViewInTx.progressPct = maxProgressPct;
          existingViewInTx.isComplete = updatedIsComplete;
          existingViewInTx.lastViewedAt = now;
          await existingViewInTx.save({ session });

          const currentSong = await CopyrightFreeSong.findById(songIdObj).select("viewCount likeCount").session(session).lean() as { viewCount?: number; likeCount?: number } | null;
          viewCount = Math.max(currentSong?.viewCount ?? 0, currentSong?.likeCount ?? 0);
          isNewView = false;
          return;
        }

        const interactionInTx = await CopyrightFreeSongInteraction.findOne(
          { userId: userIdObj, songId: songIdObj },
          null,
          { session }
        );

        isNewView = !interactionInTx || !interactionInTx.hasViewed;

        const currentDurationMs = interactionInTx?.durationMs || 0;
        const currentProgressPct = interactionInTx?.progressPct || 0;
        const maxDurationMs = Math.max(currentDurationMs, durationMs || 0);
        const maxProgressPct = Math.max(currentProgressPct, progressPct || 0);
        const updatedIsComplete = (interactionInTx?.isComplete || false) || isComplete;

        const updateData: any = {
          $set: {
            hasViewed: true,
            lastViewedAt: now,
            durationMs: maxDurationMs,
            progressPct: maxProgressPct,
            isComplete: updatedIsComplete,
          },
          $setOnInsert: {
            userId: userIdObj,
            songId: songIdObj,
            hasLiked: false,
            hasShared: false,
            viewedAt: now,
          },
        };

        await CopyrightFreeSongInteraction.findOneAndUpdate(
          { userId: userIdObj, songId: songIdObj },
          updateData,
          {
            upsert: true,
            new: true,
            session,
            runValidators: true,
          }
        );

        if (isNewView) {
          await CopyrightFreeSong.findByIdAndUpdate(
            songIdObj,
            { $inc: { viewCount: 1 } },
            { session }
          );
        }

        const updatedSong = await CopyrightFreeSong.findById(songIdObj).select("viewCount").session(session).lean() as { viewCount?: number } | null;
        viewCount = (updatedSong?.viewCount as number) || 0;
      });

      await deps.songService.ensureViewCountInvariant(songId);
      const afterInvariant = await CopyrightFreeSong.findById(songIdObj).select("viewCount likeCount").lean() as { viewCount?: number; likeCount?: number } | null;
      const normalized = Math.max(afterInvariant?.viewCount ?? 0, afterInvariant?.likeCount ?? 0);

      return {
        viewCount: normalized,
        hasViewed: true,
        isNewView,
      };
    } catch (error: any) {
      if (error.code === 11000 || (error.message && error.message.includes("duplicate"))) {
        try {
          const existingView = await CopyrightFreeSongInteraction.findOne({
            userId: userIdObj,
            songId: songIdObj,
          });

          if (existingView) {
            const maxDurationMs = Math.max(existingView.durationMs || 0, durationMs || 0);
            const maxProgressPct = Math.max(existingView.progressPct || 0, progressPct || 0);
            const updatedIsComplete = existingView.isComplete || isComplete;

            existingView.durationMs = maxDurationMs;
            existingView.progressPct = maxProgressPct;
            existingView.isComplete = updatedIsComplete;
            existingView.lastViewedAt = now;
            await existingView.save();
          }

          await deps.songService.ensureViewCountInvariant(songId);
          const currentSong = await CopyrightFreeSong.findById(songIdObj).select("viewCount likeCount").lean() as { viewCount?: number; likeCount?: number } | null;
          const normalized = Math.max(currentSong?.viewCount ?? 0, currentSong?.likeCount ?? 0);
          return {
            viewCount: normalized,
            hasViewed: true,
            isNewView: false,
          };
        } catch (recoveryError: any) {
          logger.error("Error during duplicate key recovery:", {
            error: recoveryError.message,
            stack: recoveryError.stack,
            code: recoveryError.code,
            name: recoveryError.name,
            userId,
            songId,
          });
          throw recoveryError;
        }
      }

      if (isTransactionUnsupportedError(error)) {
        await session.endSession();
        logger.warn("Transactions not supported, using fallback for view recording", {
          userId,
          songId,
          message: error.message,
        });
        return recordViewWithoutTransaction(deps, userIdObj, songIdObj, song, {
          durationMs,
          progressPct,
          isComplete,
        });
      }

      logger.error("Error in transaction while recording view:", {
        error: error.message,
        stack: error.stack,
        code: error.code,
        codeName: error.codeName,
        name: error.name,
        userId,
        songId,
        durationMs,
        progressPct,
        isComplete,
      });
      throw error;
    } finally {
      await session.endSession();
    }
  } catch (error: any) {
    if (isTransactionUnsupportedError(error)) {
      logger.warn("Transactions not supported, using fallback for view recording", {
        userId,
        songId,
        message: error.message,
      });
      const userIdObj = new Types.ObjectId(userId);
      const songIdObj = new Types.ObjectId(songId);
      const song = await CopyrightFreeSong.findById(songIdObj);
      if (!song) throw new Error("Song not found");
      return recordViewWithoutTransaction(deps, userIdObj, songIdObj, song, {
        durationMs,
        progressPct,
        isComplete,
      });
    }

    logger.error("Error recording view:", {
      error: error.message,
      stack: error.stack,
      code: error.code,
      codeName: error.codeName,
      name: error.name,
      userId,
      songId,
      durationMs,
      progressPct,
      isComplete,
      mongoError: error.code,
      mongoErrorCode: error.codeName,
      errorType: error.constructor.name,
    });

    throw error;
  }
}
