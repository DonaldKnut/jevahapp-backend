import * as fs from "fs";
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
    logger.warn(`Failed to cleanup file ${filePath}:`, error);
  }
}

export async function checkFFmpegAvailable(): Promise<boolean> {
  return hasFfmpeg();
}
