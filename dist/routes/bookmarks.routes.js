"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bookmarks_controller_1 = require("../controllers/bookmarks.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const asyncHandler_1 = require("../utils/asyncHandler");
const router = (0, express_1.Router)();
/**
 * @route   GET /api/bookmarks/get-bookmarked-media
 * @desc    Get all bookmarked media for the current user
 * @access  Protected
 * @returns { success: boolean, media: Media[] }
 */
router.get("/get-bookmarked-media", auth_middleware_1.verifyToken, (0, asyncHandler_1.asyncHandler)(bookmarks_controller_1.getBookmarkedMedia));
/**
 * @route   POST /api/bookmarks/:mediaId
 * @desc    Add a media item to the user's bookmarks
 * @access  Protected
 * @param   { mediaId: string } - Media ID to bookmark
 * @returns { success: boolean, message: string }
 */
router.post("/:mediaId", auth_middleware_1.verifyToken, (0, asyncHandler_1.asyncHandler)(bookmarks_controller_1.addBookmark));
/**
 * @route   DELETE /api/bookmarks/:mediaId
 * @desc    Remove a media item from the user's bookmarks
 * @access  Protected
 * @param   { mediaId: string } - Media ID to remove from bookmarks
 * @returns { success: boolean, message: string }
 */
router.delete("/:mediaId", auth_middleware_1.verifyToken, (0, asyncHandler_1.asyncHandler)(bookmarks_controller_1.removeBookmark));
exports.default = router;
