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
exports.MediaReport = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const mediaReportSchema = new mongoose_1.Schema({
    mediaId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Media",
        required: true,
        index: true,
    },
    reportedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    reason: {
        type: String,
        enum: [
            "inappropriate_content",
            "non_gospel_content",
            "explicit_language",
            "violence",
            "sexual_content",
            "blasphemy",
            "spam",
            "copyright",
            "other",
        ],
        required: true,
    },
    description: {
        type: String,
        trim: true,
        maxlength: 1000,
    },
    status: {
        type: String,
        enum: ["pending", "reviewed", "resolved", "dismissed"],
        default: "pending",
        index: true,
    },
    reviewedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
    },
    reviewedAt: {
        type: Date,
    },
    adminNotes: {
        type: String,
        trim: true,
        maxlength: 2000,
    },
}, {
    timestamps: true,
});
// Indexes for efficient queries
mediaReportSchema.index({ mediaId: 1, reportedBy: 1 }); // Prevent duplicate reports
mediaReportSchema.index({ status: 1, createdAt: -1 }); // For admin dashboard
mediaReportSchema.index({ mediaId: 1, status: 1 }); // For media-specific reports
exports.MediaReport = mongoose_1.default.models.MediaReport ||
    mongoose_1.default.model("MediaReport", mediaReportSchema);
