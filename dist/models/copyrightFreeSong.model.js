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
exports.CopyrightFreeSong = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const copyrightFreeSongSchema = new mongoose_1.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
    },
    singer: {
        type: String,
        required: true,
        trim: true,
    },
    uploadedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    fileUrl: {
        type: String,
        required: true,
    },
    thumbnailUrl: {
        type: String,
    },
    likeCount: {
        type: Number,
        default: 0,
    },
    shareCount: {
        type: Number,
        default: 0,
    },
    viewCount: {
        type: Number,
        default: 0,
    },
    duration: {
        type: Number,
    },
}, {
    timestamps: true,
});
// Indexes for optimal search performance
// Text index for full-text search across title and singer (artist)
copyrightFreeSongSchema.index({ title: "text", singer: "text" }, { name: "search_text_index" });
// Single field indexes for sorting
copyrightFreeSongSchema.index({ likeCount: -1 }, { name: "like_count_index" }); // For sorting by popularity
copyrightFreeSongSchema.index({ viewCount: -1 }, { name: "view_count_index" }); // For sorting by most viewed
copyrightFreeSongSchema.index({ createdAt: -1 }, { name: "created_at_index" }); // For sorting by newest
copyrightFreeSongSchema.index({ title: 1 }, { name: "title_index" }); // For alphabetical sorting
// Compound indexes for common query patterns
copyrightFreeSongSchema.index({ viewCount: -1, likeCount: -1 }, { name: "popularity_compound_index" }); // For relevance sorting
copyrightFreeSongSchema.index({ createdAt: -1, viewCount: -1 }, { name: "newest_popular_compound_index" }); // For newest with popularity fallback
exports.CopyrightFreeSong = mongoose_1.default.models.CopyrightFreeSong ||
    mongoose_1.default.model("CopyrightFreeSong", copyrightFreeSongSchema);
