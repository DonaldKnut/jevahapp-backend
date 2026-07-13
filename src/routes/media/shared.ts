import { Request, Response } from "express";
import multer from "multer";
import { UPLOAD_LIMITS } from "../../controllers/media.controller";

export { UPLOAD_LIMITS };

export interface UserActionRequestBody {
  actionType: "favorite" | "share";
}

const MAX_UPLOAD_BYTES = UPLOAD_LIMITS.FILE_SIZE.SERMON_MB * 1024 * 1024;

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

export const logRequest = (req: Request, res: Response, next: Function) => {
  console.log("Incoming Request Body:", req.body);
  console.log("Incoming Request Files:", req.files);
  next();
};
