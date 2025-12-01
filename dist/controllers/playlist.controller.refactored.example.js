"use strict";
/**
 * REFACTORED EXAMPLE - Playlist Controller using DRY utilities
 * This demonstrates how controllers should be structured using shared utilities
 * DO NOT USE THIS FILE - It's for reference only
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlaylistByIdRefactored = exports.getUserPlaylistsRefactored = exports.createPlaylistRefactored = void 0;
const mongoose_1 = require("mongoose");
const playlist_model_1 = require("../models/playlist.model");
const response_util_1 = __importDefault(require("../utils/response.util"));
const validation_util_1 = __importDefault(require("../utils/validation.util"));
const controller_util_1 = __importDefault(require("../utils/controller.util"));
const query_util_1 = __importDefault(require("../utils/query.util"));
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * REFACTORED: Create a new playlist
 * BEFORE: ~50 lines | AFTER: ~30 lines
 */
const createPlaylistRefactored = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = controller_util_1.default.getUserId(request, response);
    if (!userId)
        return;
    // Validate required fields using utility
    if (!validation_util_1.default.validateFields(response, [
        { value: request.body.name, fieldName: "name", required: true, type: "string", minLength: 1, maxLength: 100 },
    ])) {
        return;
    }
    const { name, description, isPublic, coverImageUrl, tags } = request.body;
    // Check for duplicate using query utility
    const existingPlaylist = yield playlist_model_1.Playlist.findOne(Object.assign(Object.assign({}, query_util_1.default.buildUserFilter(userId)), { name: name.trim() }));
    if (existingPlaylist) {
        response_util_1.default.badRequest(response, "You already have a playlist with this name");
        return;
    }
    try {
        const playlist = yield playlist_model_1.Playlist.create({
            name: name.trim(),
            description: description === null || description === void 0 ? void 0 : description.trim(),
            userId: new mongoose_1.Types.ObjectId(userId),
            isPublic: isPublic || false,
            coverImageUrl,
            tags: tags || [],
            tracks: [],
            totalTracks: 0,
            playCount: 0,
        });
        logger_1.default.info("Playlist created", { playlistId: playlist._id, userId, name: playlist.name });
        response_util_1.default.created(response, playlist, "Playlist created successfully");
    }
    catch (error) {
        controller_util_1.default.handleServiceError(response, error, "Failed to create playlist");
    }
});
exports.createPlaylistRefactored = createPlaylistRefactored;
/**
 * REFACTORED: Get user playlists
 * BEFORE: ~40 lines | AFTER: ~15 lines (using base controller)
 */
const getUserPlaylistsRefactored = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = controller_util_1.default.getUserId(request, response);
    if (!userId)
        return;
    const { page, limit, skip } = controller_util_1.default.getPagination(request);
    try {
        const { query, options } = query_util_1.default.buildQuery(query_util_1.default.buildUserFilter(userId), { page, limit, skip }, { sortBy: "createdAt", sortOrder: "desc" });
        const result = yield query_util_1.default.executePaginatedQuery(playlist_model_1.Playlist, query, Object.assign(Object.assign({}, options), { populate: ["tracks.mediaId", "tracks.addedBy"] }));
        response_util_1.default.paginated(response, result.data, result, "Playlists retrieved successfully");
    }
    catch (error) {
        controller_util_1.default.handleServiceError(response, error, "Failed to retrieve playlists");
    }
});
exports.getUserPlaylistsRefactored = getUserPlaylistsRefactored;
/**
 * REFACTORED: Get playlist by ID
 * BEFORE: ~50 lines | AFTER: ~25 lines
 */
const getPlaylistByIdRefactored = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = controller_util_1.default.getUserId(request, response);
    if (!userId)
        return;
    const playlistId = controller_util_1.default.validateAndConvertObjectId(response, request.params.playlistId, "Playlist ID");
    if (!playlistId)
        return;
    try {
        const playlist = yield playlist_model_1.Playlist.findById(playlistId)
            .populate("userId", "firstName lastName avatar")
            .populate({
            path: "tracks.mediaId",
            select: "title description contentType thumbnailUrl fileUrl duration uploadedBy createdAt",
            populate: { path: "uploadedBy", select: "firstName lastName avatar" },
        })
            .populate("tracks.addedBy", "firstName lastName");
        if (!playlist) {
            response_util_1.default.notFound(response, "Playlist not found");
            return;
        }
        // Check access
        const isOwner = playlist.userId.toString() === userId;
        if (!isOwner && !playlist.isPublic) {
            response_util_1.default.forbidden(response, "You don't have permission to view this playlist");
            return;
        }
        response_util_1.default.success(response, playlist, "Playlist retrieved successfully");
    }
    catch (error) {
        controller_util_1.default.handleServiceError(response, error, "Failed to retrieve playlist");
    }
});
exports.getPlaylistByIdRefactored = getPlaylistByIdRefactored;
