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
exports.BibleFact = void 0;
const mongoose_1 = __importStar(require("mongoose"));
// Mongoose schema definition
const bibleFactSchema = new mongoose_1.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
    },
    fact: {
        type: String,
        required: true,
        maxlength: 500,
    },
    scripture: {
        type: String,
        required: true,
        trim: true,
    },
    category: {
        type: String,
        enum: [
            "creation",
            "prophecy",
            "miracles",
            "characters",
            "history",
            "wisdom",
            "love",
            "faith",
            "hope",
            "forgiveness",
            "prayer",
            "worship",
            "salvation",
            "heaven",
            "angels",
            "demons",
            "end_times",
            "covenants",
            "law",
            "grace",
            "church",
            "ministry",
            "family",
            "relationships",
            "money",
            "work",
            "health",
            "nature",
            "science",
            "culture",
        ],
        required: true,
        index: true,
    },
    tags: {
        type: [String],
        default: [],
        index: true,
    },
    difficulty: {
        type: String,
        enum: ["beginner", "intermediate", "advanced"],
        default: "beginner",
        index: true,
    },
    language: {
        type: String,
        default: "en",
        index: true,
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true,
    },
}, {
    timestamps: true,
});
// Export model
exports.BibleFact = mongoose_1.default.models.BibleFact ||
    mongoose_1.default.model("BibleFact", bibleFactSchema);
