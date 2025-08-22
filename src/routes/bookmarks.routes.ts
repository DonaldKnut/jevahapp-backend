import { Router } from "express";
import {
  getBookmarkedMedia,
  addBookmark,
  removeBookmark,
} from "../controllers/bookmarks.controller";
import { verifyToken } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

/**
 * @route   GET /api/bookmarks/get-bookmarked-media
 * @desc    Get all bookmarked media for the current user
 * @access  Protected
 * @returns { success: boolean, media: Media[] }
 */
router.get(
  "/get-bookmarked-media",
  verifyToken,
  asyncHandler(getBookmarkedMedia)
);

/**
 * @route   POST /api/bookmarks/:mediaId
 * @desc    Add a media item to the user's bookmarks
 * @access  Protected
 * @param   { mediaId: string } - Media ID to bookmark
 * @returns { success: boolean, message: string }
 */
router.post("/:mediaId", verifyToken, asyncHandler(addBookmark));

/**
 * @route   DELETE /api/bookmarks/:mediaId
 * @desc    Remove a media item from the user's bookmarks
 * @access  Protected
 * @param   { mediaId: string } - Media ID to remove from bookmarks
 * @returns { success: boolean, message: string }
 */
router.delete("/:mediaId", verifyToken, asyncHandler(removeBookmark));

export default router;
