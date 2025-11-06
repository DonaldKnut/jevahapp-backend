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
exports.ForumPost = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const forumPostSchema = new mongoose_1.Schema({
    forumId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Forum",
        required: true
    },
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    content: {
        type: String,
        required: true,
        minlength: 1,
        maxlength: 5000,
    },
    embeddedLinks: [
        {
            url: { type: String, required: true },
            title: { type: String, maxlength: 200 },
            description: { type: String, maxlength: 500 },
            thumbnail: { type: String },
            type: {
                type: String,
                enum: ["video", "article", "resource", "other"],
                required: true,
            },
        },
    ],
    tags: {
        type: [String],
        default: []
    },
    likesCount: {
        type: Number,
        default: 0
    },
    commentsCount: {
        type: Number,
        default: 0
    },
}, { timestamps: true });
forumPostSchema.index({ forumId: 1, createdAt: -1 });
forumPostSchema.index({ userId: 1, createdAt: -1 });
forumPostSchema.index({ createdAt: -1 });
forumPostSchema.index({ tags: 1 });
forumPostSchema.index({ content: "text" }); // Text search index
exports.ForumPost = mongoose_1.default.models.ForumPost || mongoose_1.default.model("ForumPost", forumPostSchema);
