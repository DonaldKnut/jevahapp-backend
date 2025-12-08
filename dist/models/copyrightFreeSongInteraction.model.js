"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopyrightFreeSongInteraction = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const interactionSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    songId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "CopyrightFreeSong",
        required: true,
        index: true,
    },
    hasLiked: {
        type: Boolean,
        default: false,
    },
    hasShared: {
        type: Boolean,
        default: false,
    },
    hasViewed: {
        type: Boolean,
        default: false,
    },
    // View engagement metrics (optional, for analytics)
    durationMs: {
        type: Number,
        default: 0,
    },
    progressPct: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
    },
    isComplete: {
        type: Boolean,
        default: false,
    },
    viewedAt: {
        type: Date,
    },
    lastViewedAt: {
        type: Date,
    },
}, {
    timestamps: true,
});
// Unique index: one interaction record per user per song (CRITICAL for deduplication)
interactionSchema.index({ userId: 1, songId: 1 }, { unique: true, name: "user_song_unique" });
// Index for querying song views
interactionSchema.index({ songId: 1 }, { name: "song_index" });
// Index for querying user views
interactionSchema.index({ userId: 1 }, { name: "user_index" });
exports.CopyrightFreeSongInteraction = mongoose_1.default.models.CopyrightFreeSongInteraction ||
    mongoose_1.default.model("CopyrightFreeSongInteraction", interactionSchema);
