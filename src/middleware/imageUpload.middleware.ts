import multer from "multer";
import { RequestHandler } from "express";
import logger from "../utils/logger";

const DEFAULT_ALLOWED = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export type ImageUploadOptions = {
  /** Form field name (default: image) */
  field?: string;
  /** Max bytes (default: 5MB) */
  maxBytes?: number;
  allowedMimes?: Set<string>;
};

/** Shared memory multer for JPEG/PNG/WebP image fields. */
export function createImageUpload(options: ImageUploadOptions = {}) {
  const field = options.field || "image";
  const maxBytes = options.maxBytes ?? 5 * 1024 * 1024;
  const allowed = options.allowedMimes || DEFAULT_ALLOWED;

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes },
    fileFilter: (_req, file, cb) => {
      if (allowed.has(file.mimetype)) {
        cb(null, true);
        return;
      }
      cb(
        new Error(
          "Invalid file type. Only JPEG, PNG, and WebP images are allowed."
        )
      );
    },
  });

  const single = upload.single(field);

  const runSingle: RequestHandler = (req, res, next) => {
    single(req, res, (err: unknown) => {
      if (!err) {
        next();
        return;
      }
      const message =
        err instanceof multer.MulterError
          ? err.code === "LIMIT_FILE_SIZE"
            ? `Image too large (max ${Math.round(maxBytes / (1024 * 1024))}MB)`
            : err.message
          : (err as Error)?.message || "Invalid image upload";
      logger.warn("Image upload multer rejected", { message, field });
      res.status(400).json({ success: false, message });
    });
  };

  /** Only parse when Content-Type is multipart (JSON create stays untouched). */
  const parseIfMultipart: RequestHandler = (req, res, next) => {
    const ct = String(req.headers["content-type"] || "");
    if (!ct.includes("multipart/form-data")) {
      next();
      return;
    }
    runSingle(req, res, next);
  };

  return { single: runSingle, parseIfMultipart };
}
