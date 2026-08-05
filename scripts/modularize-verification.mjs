/**
 * Split optimizedVerification.service.ts into src/service/verification/*
 */
import fs from "fs";
import path from "path";
import { extractClassMethod } from "./extract-ts-method.mjs";

const root = process.cwd();
const bakPath = path.join(
  root,
  "src/service/optimizedVerification.service.ts.bak"
);

function write(rel, content) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content.replace(/\r\n/g, "\n"));
  console.log("wrote", rel, content.split("\n").length);
}

const lines = fs.readFileSync(bakPath, "utf8").split(/\r?\n/);

function toExportedFunction(name) {
  let body = extractClassMethod(lines, name).map(l =>
    l.startsWith("  ") ? l.slice(2) : l
  );
  let first = body[0]
    .replace(/^private\s+async\s+/, "export async function ")
    .replace(/^private\s+/, "export function ")
    .replace(/^async\s+/, "export async function ");
  if (!first.startsWith("export ")) first = "export " + first;
  body[0] = first;

  let text = body.join("\n");
  text = text
    .replace(/this\.tempDir/g, "getVerificationTempDir()")
    .replace(/this\.cleanupFile\(/g, "cleanupFile(")
    .replace(/this\.checkFFmpegAvailable\(/g, "checkFFmpegAvailable(")
    .replace(/this\.sampleDistributedText\(/g, "sampleDistributedText(")
    .replace(/this\.processVideoContent\(/g, "processVideoContent(")
    .replace(/this\.processVideoPath\(/g, "processVideoPath(")
    .replace(/this\.processAudioContent\(/g, "processAudioContent(")
    .replace(/this\.processBookContent\(/g, "processBookContent(")
    .replace(/this\.getVideoDurationFromPath\(/g, "getVideoDurationFromPath(")
    .replace(/this\.extractAudioSampleFromPath\(/g, "extractAudioSampleFromPath(")
    .replace(
      /this\.extractMultipleAudioSamplesFromPath\(/g,
      "extractMultipleAudioSamplesFromPath("
    )
    .replace(/this\.extractVideoFramesFromPath\(/g, "extractVideoFramesFromPath(")
    .replace(/this\.extractMultipleAudioSamples\(/g, "extractMultipleAudioSamples(")
    .replace(/this\.extractAudioSample\(/g, "extractAudioSample(")
    .replace(/this\.extractVideoFramesOptimized\(/g, "extractVideoFramesOptimized(")
    .replace(/this\.getVideoDuration\(/g, "getVideoDuration(")
    .replace(/this\.getAudioDuration\(/g, "getAudioDuration(")
    .replace(/this\.extractTextFromPDF\(/g, "extractTextFromPDF(")
    .replace(/this\.extractTextFromEPUB\(/g, "extractTextFromEPUB(")
    .replace(
      /this\.processVideoContentLegacyBuffer\(/g,
      "processVideoContentLegacyBuffer("
    );
  console.log("extracted", name, text.split("\n").length);
  return text + "\n";
}

function joinMethods(names) {
  return names.map(toExportedFunction).join("\n");
}

write(
  "src/service/verification/types.ts",
  `export interface VerificationProgress {
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
`
);

write(
  "src/service/verification/tempWorkspace.ts",
  `import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import logger from "../../utils/logger";
import { hasFfmpeg } from "../../utils/mediaTools";

let cachedTempDir: string | null = null;

export function getVerificationTempDir(): string {
  if (!cachedTempDir) {
    cachedTempDir = path.join(os.tmpdir(), "jevah-media-processing");
    if (!fs.existsSync(cachedTempDir)) {
      fs.mkdirSync(cachedTempDir, { recursive: true });
    }
  }
  return cachedTempDir;
}

export function cleanupFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    logger.warn(\`Failed to cleanup file \${filePath}:\`, error);
  }
}

export async function checkFFmpegAvailable(): Promise<boolean> {
  return hasFfmpeg();
}
`
);

write(
  "src/service/verification/videoPathEvidence.ts",
  `import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import logger from "../../utils/logger";
import { computeDistributedAudioSampleOffsets } from "../../utils/verificationAudio.util";
import { mediaProcessingService } from "../mediaProcessing.service";
import { transcriptionService } from "../transcription.service";
import {
  clipDurationsWithinBudget,
  getEvidenceProfile,
} from "../moderation/evidenceProfile";
import { cleanupFile, getVerificationTempDir } from "./tempWorkspace";

const execAsync = promisify(exec);

` +
    joinMethods([
      "processVideoPath",
      "getVideoDurationFromPath",
      "extractAudioSampleFromPath",
      "extractMultipleAudioSamplesFromPath",
      "extractVideoFramesFromPath",
    ])
);

write(
  "src/service/verification/bufferEvidence.ts",
  `import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import logger from "../../utils/logger";
import { computeDistributedAudioSampleOffsets } from "../../utils/verificationAudio.util";
import { mediaProcessingService } from "../mediaProcessing.service";
import { transcriptionService } from "../transcription.service";
import {
  clipDurationsWithinBudget,
  getEvidenceProfile,
} from "../moderation/evidenceProfile";
import {
  checkFFmpegAvailable,
  cleanupFile,
  getVerificationTempDir,
} from "./tempWorkspace";
import {
  extractMultipleAudioSamplesFromPath,
  extractVideoFramesFromPath,
  getVideoDurationFromPath,
  processVideoPath,
} from "./videoPathEvidence";

const execAsync = promisify(exec);

` +
    joinMethods([
      "processVideoContent",
      "processVideoContentLegacyBuffer",
      "processAudioContent",
      "extractMultipleAudioSamples",
      "extractAudioSample",
      "extractVideoFramesOptimized",
      "getVideoDuration",
      "getAudioDuration",
    ])
);

write(
  "src/service/verification/bookEvidence.ts",
  `import * as fs from "fs";
import * as path from "path";
import logger from "../../utils/logger";
import { getEvidenceProfile } from "../moderation/evidenceProfile";
import { cleanupFile, getVerificationTempDir } from "./tempWorkspace";

` +
    joinMethods([
      "processBookContent",
      "sampleDistributedText",
      "extractTextFromPDF",
      "extractTextFromEPUB",
    ])
);

write(
  "src/service/verification/verifyOrchestrator.ts",
  `import logger from "../../utils/logger";
import { contentModerationService } from "../contentModeration.service";
import { assertFfmpegForContentType } from "../../utils/mediaTools";
import type {
  OptimizedVerificationResult,
  ProgressCallback,
} from "./types";
import { processAudioContent, processVideoContent } from "./bufferEvidence";
import { processBookContent } from "./bookEvidence";
import { processVideoPath } from "./videoPathEvidence";

` + joinMethods(["verifyContentWithProgress", "verifyVideoPathWithProgress"])
);

write(
  "src/service/optimizedVerification.service.ts",
  `import { getVerificationTempDir } from "./verification/tempWorkspace";
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
`
);

console.log("done verification");
