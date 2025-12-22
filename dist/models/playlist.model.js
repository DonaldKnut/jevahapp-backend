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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Playlist = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const playlistTrackSchema = new mongoose_1.Schema({
    // Content reference - one required (polymorphic)
    mediaId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Media",
        required: false,
    },
    copyrightFreeSongId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "CopyrightFreeSong",
        required: false,
    },
    // Type discriminator (required)
    trackType: {
        type: String,
        enum: ["media", "copyrightFree"],
        required: true,
        // Index defined at schema level below (line 161)
    },
    addedAt: {
        type: Date,
        default: Date.now,
    },
    addedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    order: {
        type: Number,
        required: true,
        min: 0,
    },
    notes: {
        type: String,
        trim: true,
        maxlength: 500,
    },
}, { _id: false });
// Professional validation: Ensure exactly one content reference matches trackType
playlistTrackSchema.pre("validate", function (next) {
    const hasMedia = !!this.mediaId;
    const hasCopyrightFree = !!this.copyrightFreeSongId;
    // Must have exactly one
    if (!hasMedia && !hasCopyrightFree) {
        return next(new Error("Track must have either mediaId or copyrightFreeSongId"));
    }
    if (hasMedia && hasCopyrightFree) {
        return next(new Error("Track cannot have both mediaId and copyrightFreeSongId"));
    }
    // Validate trackType matches content reference
    if (this.trackType === "media" && !hasMedia) {
        return next(new Error("trackType 'media' requires mediaId"));
    }
    if (this.trackType === "copyrightFree" && !hasCopyrightFree) {
        return next(new Error("trackType 'copyrightFree' requires copyrightFreeSongId"));
    }
    next();
});
const playlistSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
    },
    description: {
        type: String,
        trim: true,
        maxlength: 500,
    },
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    isPublic: {
        type: Boolean,
        default: false,
    },
    tracks: [playlistTrackSchema],
    coverImageUrl: {
        type: String,
    },
    totalTracks: {
        type: Number,
        default: 0,
        min: 0,
    },
    totalDuration: {
        type: Number,
        min: 0,
    },
    playCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    lastPlayedAt: {
        type: Date,
    },
    tags: {
        type: [String],
        default: [],
    },
    isDefault: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps: true,
});
// Indexes for better performance
playlistSchema.index({ userId: 1, createdAt: -1 });
playlistSchema.index({ userId: 1, name: 1 }); // For finding playlists by name
playlistSchema.index({ isPublic: 1, playCount: -1 }); // For public playlist discovery
playlistSchema.index({ "tracks.mediaId": 1 }); // For finding which playlists contain a media track
playlistSchema.index({ "tracks.copyrightFreeSongId": 1 }); // For finding which playlists contain a copyright-free song
playlistSchema.index({ "tracks.trackType": 1 }); // For filtering by track type
// Pre-save middleware to update totalTracks
playlistSchema.pre("save", function (next) {
    this.totalTracks = this.tracks ? this.tracks.length : 0;
    next();
});
// Virtual for calculating total duration (can be computed on-demand)
playlistSchema.virtual("calculatedDuration").get(function () {
    return __awaiter(this, void 0, void 0, function* () {
        if (!this.tracks || this.tracks.length === 0)
            return 0;
        const Media = mongoose_1.default.model("Media");
        const mediaIds = this.tracks.map((t) => t.mediaId);
        const mediaItems = yield Media.find({ _id: { $in: mediaIds } }).select("duration");
        return mediaItems.reduce((total, media) => {
            return total + (media.duration || 0);
        }, 0);
    });
});
exports.Playlist = mongoose_1.default.models.Playlist ||
    mongoose_1.default.model("Playlist", playlistSchema);
