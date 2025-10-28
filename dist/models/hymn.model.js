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
exports.Hymn = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const hymnSchema = new mongoose_1.Schema({
    title: {
        type: String,
        required: true,
        index: true,
        trim: true,
    },
    author: {
        type: String,
        required: true,
        trim: true,
    },
    composer: {
        type: String,
        trim: true,
    },
    year: {
        type: Number,
        min: 1000,
        max: new Date().getFullYear(),
    },
    category: {
        type: String,
        required: true,
        enum: [
            "praise",
            "worship",
            "traditional",
            "contemporary",
            "gospel",
            "christmas",
            "easter",
        ],
        index: true,
    },
    lyrics: [
        {
            type: String,
            trim: true,
        },
    ],
    audioUrl: {
        type: String,
        validate: {
            validator: function (v) {
                return !v || /^https?:\/\/.+/.test(v);
            },
            message: "Audio URL must be a valid HTTP/HTTPS URL",
        },
    },
    thumbnailUrl: {
        type: String,
        validate: {
            validator: function (v) {
                return !v || /^https?:\/\/.+/.test(v);
            },
            message: "Thumbnail URL must be a valid HTTP/HTTPS URL",
        },
    },
    duration: {
        type: Number,
        min: 0,
    },
    hymnNumber: {
        type: String,
        trim: true,
    },
    meter: {
        type: String,
        trim: true,
    },
    key: {
        type: String,
        trim: true,
    },
    scripture: [
        {
            type: String,
            trim: true,
        },
    ],
    tags: [
        {
            type: String,
            trim: true,
            // Index defined at schema level (line 198)
        },
    ],
    source: {
        type: String,
        enum: ["hymnary", "openhymnal", "manual"],
        default: "manual",
        // Index defined at schema level as compound index (line 196)
    },
    externalId: {
        type: String,
        unique: true,
        sparse: true,
        // Index defined at schema level as compound index (line 196)
    },
    viewCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    likeCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    commentCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    shareCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    bookmarkCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true,
    },
    // Hymnary.org specific fields
    hymnaryData: {
        textLink: String,
        placeOfOrigin: String,
        originalLanguage: String,
        numberOfHymnals: Number,
        roles: [
            {
                name: String,
                role: String,
            },
        ],
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
// Indexes for better performance
hymnSchema.index({ title: "text", author: "text", lyrics: "text" });
hymnSchema.index({ category: 1, isActive: 1 });
hymnSchema.index({ source: 1, externalId: 1 });
hymnSchema.index({ scripture: 1 });
hymnSchema.index({ tags: 1 });
hymnSchema.index({ viewCount: -1 });
hymnSchema.index({ likeCount: -1 });
hymnSchema.index({ createdAt: -1 });
// Virtual for total interactions
hymnSchema.virtual("totalInteractions").get(function () {
    return (this.likeCount + this.commentCount + this.shareCount + this.bookmarkCount);
});
// Pre-save middleware
hymnSchema.pre("save", function (next) {
    // Ensure externalId is unique per source
    if (this.isNew && this.externalId) {
        this.externalId = `${this.source}-${this.externalId}`;
    }
    next();
});
exports.Hymn = mongoose_1.default.models.Hymn || mongoose_1.default.model("Hymn", hymnSchema);
