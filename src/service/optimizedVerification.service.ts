import { getVerificationTempDir } from "./verification/tempWorkspace";
import {
  verifyContentWithProgress,
  verifyVideoPathWithProgress,
} from "./verification/verifyOrchestrator";
import type {
  OptimizedVerificationResult,
  ProgressCallback,
  VerificationProgress,
} from "./verification/types";

export type {
  OptimizedVerificationResult,
  ProgressCallback,
  VerificationProgress,
};

export class OptimizedVerificationService {
  constructor() {
    getVerificationTempDir();
  }

  async verifyContentWithProgress(
    file: Buffer,
    fileMimeType: string,
    contentType: string,
    title: string,
    description: string | undefined,
    uploadId: string,
    onProgress?: ProgressCallback,
    thumbnailBuffer?: Buffer,
    thumbnailMimeType?: string,
    opts?: { mediaId?: string; contentHash?: string }
  ): Promise<OptimizedVerificationResult> {
    return verifyContentWithProgress(
      file,
      fileMimeType,
      contentType,
      title,
      description,
      uploadId,
      onProgress,
      thumbnailBuffer,
      thumbnailMimeType,
      opts
    );
  }

  async verifyVideoPathWithProgress(
    filePath: string,
    fileMimeType: string,
    contentType: string,
    title: string,
    description: string | undefined,
    uploadId: string,
    opts?: { mediaId?: string; contentHash?: string }
  ): Promise<OptimizedVerificationResult> {
    return verifyVideoPathWithProgress(
      filePath,
      fileMimeType,
      contentType,
      title,
      description,
      uploadId,
      opts
    );
  }
}

export const optimizedVerificationService = new OptimizedVerificationService();
