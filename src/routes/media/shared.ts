import { Request, Response, NextFunction } from "express";
import multer from "multer";
import { UPLOAD_LIMITS } from "../../controllers/media.controller";

export { UPLOAD_LIMITS };

export interface UserActionRequestBody {
  actionType: "favorite" | "share";
}

/** Legacy buffered upload ceiling — keep below previous 300MB to protect API memory. */
const LEGACY_MAX_VIDEO_MB = Math.min(UPLOAD_LIMITS.FILE_SIZE.SERMON_MB, 100);
const MAX_UPLOAD_BYTES = LEGACY_MAX_VIDEO_MB * 1024 * 1024;
const MAX_THUMBNAIL_BYTES = UPLOAD_LIMITS.FILE_SIZE.THUMBNAIL_MB * 1024 * 1024;

const ALLOWED_FILE_MIME = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/aac",
  "audio/ogg",
  "application/pdf",
  "application/epub+zip",
]);

const ALLOWED_THUMB_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

function fileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) {
  if (file.fieldname === "thumbnail") {
    if (!ALLOWED_THUMB_MIME.has(file.mimetype)) {
      const err: any = new Error(
        `Unsupported thumbnail type: ${file.mimetype}. Use JPEG, PNG, or WebP.`
      );
      err.code = "LIMIT_UNEXPECTED_FILE";
      err.status = 415;
      return cb(err);
    }
    return cb(null, true);
  }

  if (file.fieldname === "file") {
    if (!ALLOWED_FILE_MIME.has(file.mimetype)) {
      const err: any = new Error(
        `Unsupported file type: ${file.mimetype}.`
      );
      err.code = "LIMIT_FILE_CONTENT_TYPE";
      err.status = 415;
      return cb(err);
    }
    return cb(null, true);
  }

  const err: any = new Error(`Unexpected field: ${file.fieldname}`);
  err.code = "LIMIT_UNEXPECTED_FILE";
  err.status = 400;
  cb(err);
}

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 2,
    fields: 20,
    fieldSize: 256 * 1024,
  },
  fileFilter,
});

/** Multer error → proper 413/415 instead of generic 500. */
export function handleUploadMulterError(
  err: any,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!err) return next();
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({
        success: false,
        message: `File too large. Legacy buffered upload max is ${LEGACY_MAX_VIDEO_MB}MB (use staged direct upload for larger videos).`,
        code: "FILE_TOO_LARGE",
        maxSizeMB: LEGACY_MAX_VIDEO_MB,
      });
      return;
    }
    res.status(400).json({
      success: false,
      message: err.message || "Invalid multipart upload",
      code: err.code,
    });
    return;
  }
  if (err.status === 415 || err.code === "LIMIT_FILE_CONTENT_TYPE") {
    res.status(415).json({
      success: false,
      message: err.message,
      code: "UNSUPPORTED_MEDIA_TYPE",
    });
    return;
  }
  if (err.status === 400 || err.code === "LIMIT_UNEXPECTED_FILE") {
    res.status(400).json({
      success: false,
      message: err.message,
      code: err.code || "BAD_UPLOAD",
    });
    return;
  }
  next(err);
}

export const MAX_THUMBNAIL_BYTES_EXPORT = MAX_THUMBNAIL_BYTES;
export const LEGACY_MAX_VIDEO_MB_EXPORT = LEGACY_MAX_VIDEO_MB;

export const logRequest = (req: Request, res: Response, next: Function) => {
  console.log("Incoming Request Body:", req.body);
  console.log("Incoming Request Files:", req.files);
  next();
};
