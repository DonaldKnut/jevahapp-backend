"use strict";
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
exports.CopyrightFreeSongInteractionService = void 0;
const mongoose_1 = require("mongoose");
const copyrightFreeSongInteraction_model_1 = require("../models/copyrightFreeSongInteraction.model");
const copyrightFreeSong_service_1 = require("./copyrightFreeSong.service");
const logger_1 = __importDefault(require("../utils/logger"));
class CopyrightFreeSongInteractionService {
    constructor() {
        this.songService = new copyrightFreeSong_service_1.CopyrightFreeSongService();
    }
    isLiked(userId, songId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const interaction = yield copyrightFreeSongInteraction_model_1.CopyrightFreeSongInteraction.findOne({
                    userId: new mongoose_1.Types.ObjectId(userId),
                    songId: new mongoose_1.Types.ObjectId(songId),
                });
                return (interaction === null || interaction === void 0 ? void 0 : interaction.hasLiked) || false;
            }
            catch (error) {
                logger_1.default.error("Error checking if liked:", error);
                return false;
            }
        });
    }
    toggleLike(userId, songId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Get or create interaction
                let interaction = yield copyrightFreeSongInteraction_model_1.CopyrightFreeSongInteraction.findOne({
                    userId: new mongoose_1.Types.ObjectId(userId),
                    songId: new mongoose_1.Types.ObjectId(songId),
                });
                const wasLiked = (interaction === null || interaction === void 0 ? void 0 : interaction.hasLiked) || false;
                const newLikedState = !wasLiked;
                if (!interaction) {
                    interaction = yield copyrightFreeSongInteraction_model_1.CopyrightFreeSongInteraction.create({
                        userId: new mongoose_1.Types.ObjectId(userId),
                        songId: new mongoose_1.Types.ObjectId(songId),
                        hasLiked: newLikedState,
                        hasShared: false,
                    });
                }
                else {
                    interaction.hasLiked = newLikedState;
                    yield interaction.save();
                }
                // Update song counts
                if (newLikedState) {
                    yield this.songService.incrementLikeCount(songId);
                }
                else {
                    yield this.songService.decrementLikeCount(songId);
                }
                // Get updated counts
                const song = yield this.songService.getSongById(songId);
                return {
                    liked: newLikedState,
                    likeCount: (song === null || song === void 0 ? void 0 : song.likeCount) || 0,
                    shareCount: (song === null || song === void 0 ? void 0 : song.shareCount) || 0,
                };
            }
            catch (error) {
                logger_1.default.error("Error toggling like:", error);
                throw error;
            }
        });
    }
    shareSong(userId, songId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Get or create interaction
                let interaction = yield copyrightFreeSongInteraction_model_1.CopyrightFreeSongInteraction.findOne({
                    userId: new mongoose_1.Types.ObjectId(userId),
                    songId: new mongoose_1.Types.ObjectId(songId),
                });
                if (!interaction) {
                    interaction = yield copyrightFreeSongInteraction_model_1.CopyrightFreeSongInteraction.create({
                        userId: new mongoose_1.Types.ObjectId(userId),
                        songId: new mongoose_1.Types.ObjectId(songId),
                        hasLiked: false,
                        hasShared: true,
                    });
                }
                else if (!interaction.hasShared) {
                    interaction.hasShared = true;
                    yield interaction.save();
                }
                else {
                    // Already shared, don't increment again
                    const song = yield this.songService.getSongById(songId);
                    return {
                        shareCount: (song === null || song === void 0 ? void 0 : song.shareCount) || 0,
                        likeCount: (song === null || song === void 0 ? void 0 : song.likeCount) || 0,
                    };
                }
                // Increment share count
                yield this.songService.incrementShareCount(songId);
                // Get updated counts
                const song = yield this.songService.getSongById(songId);
                return {
                    shareCount: (song === null || song === void 0 ? void 0 : song.shareCount) || 0,
                    likeCount: (song === null || song === void 0 ? void 0 : song.likeCount) || 0,
                };
            }
            catch (error) {
                logger_1.default.error("Error sharing song:", error);
                throw error;
            }
        });
    }
}
exports.CopyrightFreeSongInteractionService = CopyrightFreeSongInteractionService;
