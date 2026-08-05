import * as like from "./like";
import * as save from "./save";
import * as share from "./share";
import * as view from "./view";
import { createDeps, type CopyrightFreeSongInteractionDeps } from "./deps";

export class CopyrightFreeSongInteractionService {
  private deps: CopyrightFreeSongInteractionDeps;

  constructor() {
    this.deps = createDeps();
  }

  async isLiked(userId: string, songId: string): Promise<boolean> {
    return like.isLiked(userId, songId);
  }

  async toggleLike(
    userId: string,
    songId: string
  ): Promise<{ liked: boolean; likeCount: number; shareCount: number; viewCount: number }> {
    return like.toggleLike(this.deps, userId, songId);
  }

  async shareSong(
    userId: string,
    songId: string,
    opts: { platform?: string } = {}
  ): Promise<{
    shared: true;
    shareCount: number;
    likeCount: number;
    viewCount: number;
    shareUrl: string;
    platform?: string;
  }> {
    return share.shareSong(this.deps, userId, songId, opts);
  }

  async getInteraction(userId: string, songId: string) {
    return save.getInteraction(userId, songId);
  }

  async isSaved(userId: string, songId: string): Promise<boolean> {
    return save.isSaved(userId, songId);
  }

  async toggleSave(
    userId: string,
    songId: string
  ): Promise<{ saved: boolean; saveCount: number }> {
    return save.toggleSave(this.deps, userId, songId);
  }

  async markAsViewed(userId: string, songId: string): Promise<void> {
    return save.markAsViewed(userId, songId);
  }

  async recordView(
    userId: string,
    songId: string,
    payload: {
      durationMs?: number;
      progressPct?: number;
      isComplete?: boolean;
    } = {}
  ): Promise<{ viewCount: number; hasViewed: boolean; isNewView: boolean }> {
    return view.recordView(this.deps, userId, songId, payload);
  }
}
