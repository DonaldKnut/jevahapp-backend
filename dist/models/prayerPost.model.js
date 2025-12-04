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
exports.PrayerPost = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const prayerPostSchema = new mongoose_1.Schema({
    content: { type: String, required: true, trim: true, minlength: 1, maxlength: 2000 },
    prayerText: {
        type: String,
        trim: true,
        minlength: 1,
        maxlength: 2000
    }, // Alias, will sync with content
    verse: {
        type: {
            text: {
                type: String,
                trim: true,
                maxlength: 500,
                default: null
            },
            reference: {
                type: String,
                trim: true,
                maxlength: 50,
                default: null
            },
        },
        default: null,
        _id: false
    },
    color: {
        type: String,
        required: true,
        default: "#A16CE5",
        validate: {
            validator: function (v) {
                return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v);
            },
            message: "Color must be a valid hex color code"
        }
    },
    shape: {
        type: String,
        required: true,
        default: "square",
        enum: ["rectangle", "circle", "scalloped", "square", "square2", "square3", "square4"]
    },
    anonymous: { type: Boolean, default: false },
    media: { type: [String], default: [] },
    authorId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    likesCount: { type: Number, default: 0, min: 0 },
    commentsCount: { type: Number, default: 0, min: 0 },
}, { timestamps: true });
// Sync prayerText with content and validate verse
prayerPostSchema.pre("save", function (next) {
    // Sync prayerText with content
    if (this.prayerText && !this.content) {
        this.content = this.prayerText;
    }
    else if (this.content && !this.prayerText) {
        this.prayerText = this.content;
    }
    // Validate verse: if verse object exists, at least one field must be present
    if (this.verse && !this.verse.text && !this.verse.reference) {
        return next(new Error("If verse is provided, at least text or reference must be included"));
    }
    // If verse is empty, set to null
    if (this.verse && !this.verse.text && !this.verse.reference) {
        this.verse = null;
    }
    next();
});
prayerPostSchema.index({ createdAt: -1 });
prayerPostSchema.index({ authorId: 1, createdAt: -1 });
prayerPostSchema.index({ "verse.reference": 1 });
prayerPostSchema.index({ content: "text", "verse.text": "text" }); // Text search index
exports.PrayerPost = mongoose_1.default.models.PrayerPost ||
    mongoose_1.default.model("PrayerPost", prayerPostSchema);
