import { Router } from "express";
import {
  uploadMedia,
  generateMediaDescription,
} from "../../controllers/media.controller";
import {
  createStagedUploadIntent,
  finalizeStagedUpload,
  abortStagedUpload,
  getStagedUploadStatus,
} from "../../controllers/media/staged/stagedUpload.controller";
import { verifyToken } from "../../middleware/auth.middleware";
import {
  mediaUploadRateLimiter,
  aiDescriptionRateLimiter,
} from "../../middleware/rateLimiter";
import { requireUploadsEnabled } from "../../middleware/platformGate.middleware";
import { logRequest, upload, handleUploadMulterError } from "./shared";

const router = Router();

router.post(
  "/generate-description",
  verifyToken,
  requireUploadsEnabled,
  aiDescriptionRateLimiter,
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  handleUploadMulterError,
  generateMediaDescription
);

/** Legacy memory-buffered upload (kept for backward compatibility). Prefer staged. */
router.post(
  "/upload",
  verifyToken,
  requireUploadsEnabled,
  mediaUploadRateLimiter,
  logRequest,
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  handleUploadMulterError,
  uploadMedia
);

/**
 * Staged direct-to-R2 upload:
 * 1) POST /upload/intent → presigned PUT
 * 2) Client PUTs bytes to R2
 * 3) POST /upload/:mediaId/finalize → queue moderation + transcode
 */
router.post(
  "/upload/intent",
  verifyToken,
  requireUploadsEnabled,
  mediaUploadRateLimiter,
  createStagedUploadIntent
);

router.post(
  "/upload/:mediaId/finalize",
  verifyToken,
  requireUploadsEnabled,
  mediaUploadRateLimiter,
  upload.fields([{ name: "thumbnail", maxCount: 1 }]),
  handleUploadMulterError,
  finalizeStagedUpload
);

router.delete(
  "/upload/:mediaId",
  verifyToken,
  mediaUploadRateLimiter,
  abortStagedUpload
);

router.get("/upload/:mediaId/status", verifyToken, getStagedUploadStatus);

export default router;
