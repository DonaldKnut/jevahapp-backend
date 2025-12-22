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
exports.PlaybackSession = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const playbackSessionSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        // Index defined at schema level (line 96)
    },
    mediaId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Media",
        required: true,
        index: true,
    },
    startedAt: {
        type: Date,
        default: Date.now,
    },
    lastProgressAt: {
        type: Date,
        default: Date.now,
    },
    currentPosition: {
        type: Number,
        default: 0,
        min: 0,
    },
    duration: {
        type: Number,
        required: true,
        min: 0,
    },
    progressPercentage: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
    },
    isActive: {
        type: Boolean,
        default: true,
        // Index defined at schema level (line 96)
    },
    isPaused: {
        type: Boolean,
        default: false,
    },
    pausedAt: {
        type: Date,
    },
    endedAt: {
        type: Date,
    },
    totalWatchTime: {
        type: Number,
        default: 0,
        min: 0,
    },
    deviceInfo: {
        type: String,
    },
    userAgent: {
        type: String,
    },
}, {
    timestamps: true,
});
// Indexes for better performance
// Index for active sessions (one active session per user)
// Note: We'll handle uniqueness in service layer since MongoDB unique partial indexes can be tricky
playbackSessionSchema.index({ userId: 1, isActive: 1 });
playbackSessionSchema.index({ userId: 1, mediaId: 1, isActive: 1 });
playbackSessionSchema.index({ lastProgressAt: -1 });
playbackSessionSchema.index({ createdAt: -1 });
exports.PlaybackSession = mongoose_1.default.models.PlaybackSession ||
    mongoose_1.default.model("PlaybackSession", playbackSessionSchema);
