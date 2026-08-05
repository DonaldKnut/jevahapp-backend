export interface VerificationProgress {
  uploadId: string;
  progress: number;
  stage: string;
  message: string;
  timestamp: string;
}

export interface OptimizedVerificationResult {
  isApproved: boolean;
  moderationResult: any;
  transcript?: string;
  videoFrames?: string[];
}

export type ProgressCallback = (progress: VerificationProgress) => void;
