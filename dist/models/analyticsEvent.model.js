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
exports.AnalyticsEvent = void 0;
const mongoose_1 = __importStar(require("mongoose"));
/**
 * Analytics events written by the BullMQ analytics worker.
 * This is intentionally append-only and TTL'd to prevent unbounded growth.
 */
const analyticsEventSchema = new mongoose_1.Schema({
    name: { type: String, required: true, index: true },
    payload: { type: mongoose_1.Schema.Types.Mixed, required: true },
    requestId: { type: String, index: true },
    createdAt: { type: Date, default: Date.now, index: true },
}, { timestamps: false });
// Keep events for 7 days by default (MongoDB TTL index).
// Can be overridden by setting ANALYTICS_EVENTS_TTL_DAYS.
const ttlDays = parseInt(process.env.ANALYTICS_EVENTS_TTL_DAYS || "7", 10);
if (Number.isFinite(ttlDays) && ttlDays > 0) {
    analyticsEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: ttlDays * 24 * 60 * 60 });
}
exports.AnalyticsEvent = mongoose_1.default.models.AnalyticsEvent ||
    mongoose_1.default.model("AnalyticsEvent", analyticsEventSchema);
