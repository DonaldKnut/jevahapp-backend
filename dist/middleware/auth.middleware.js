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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_model_1 = require("../models/user.model");
const blacklistedToken_model_1 = require("../models/blacklistedToken.model");
const logger_1 = __importDefault(require("../utils/logger"));
const redis_1 = require("../lib/redis");
const verifyToken = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    // Try to get token from Authorization header first
    let token;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
    }
    else {
        // If no Authorization header, try to get refresh token from cookie and auto-refresh
        const refreshToken = (_a = req.cookies) === null || _a === void 0 ? void 0 : _a.refreshToken;
        if (refreshToken) {
            try {
                // Dynamic import to avoid circular dependencies
                const authServiceModule = yield Promise.resolve().then(() => __importStar(require("../service/auth.service")));
                const authService = authServiceModule.default;
                const refreshResult = yield authService.refreshToken(refreshToken);
                // Set new access token in response header for client to pick up
                res.setHeader("X-New-Access-Token", refreshResult.accessToken);
                // Use the new access token for this request
                token = refreshResult.accessToken;
                // Fetch full user info for role checks
                const user = yield user_model_1.User.findById(refreshResult.user.id).select("role isVerifiedCreator isVerifiedVendor isVerifiedChurch isBanned banUntil");
                if (!user) {
                    res.status(401).json({ success: false, message: "User not found" });
                    return;
                }
                // Check if user is banned
                if (user.isBanned) {
                    if (user.banUntil && new Date() > user.banUntil) {
                        yield user_model_1.User.findByIdAndUpdate(refreshResult.user.id, {
                            isBanned: false,
                            banUntil: undefined,
                        });
                    }
                    else {
                        res.status(403).json({
                            success: false,
                            message: "Account is banned",
                        });
                        return;
                    }
                }
                // Attach user info
                req.userId = refreshResult.user.id.toString();
                req.user = {
                    role: user.role,
                    isVerifiedCreator: user.isVerifiedCreator,
                    isVerifiedVendor: user.isVerifiedVendor,
                    isVerifiedChurch: user.isVerifiedChurch,
                };
                // Continue with the request using the new token
                return next();
            }
            catch (error) {
                // Refresh token invalid/expired, clear cookie and require login
                res.clearCookie("refreshToken", {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
                    path: "/",
                });
                res.status(401).json({
                    success: false,
                    message: "Session expired. Please login again.",
                });
                return;
            }
        }
    }
    if (!token) {
        res.status(401).json({
            success: false,
            message: "Unauthorized: No token provided",
        });
        return;
    }
    try {
        // Verify JWT first (fast, no DB query)
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        // Always check blacklist in DB (preserves auth behavior)
        const isBlacklisted = yield blacklistedToken_model_1.BlacklistedToken.findOne({ token }).lean();
        if (isBlacklisted) {
            res.status(401).json({
                success: false,
                message: "Unauthorized: Token has been invalidated",
            });
            return;
        }
        // Cache user lookup briefly in Redis (optimization only)
        const userCacheKey = `auth:user:${decoded.userId}`;
        const cachedUser = yield (0, redis_1.redisSafe)("authUserGet", (r) => __awaiter(void 0, void 0, void 0, function* () {
            const u = yield r.get(userCacheKey);
            return u || null;
        }), null);
        const user = cachedUser ||
            (yield user_model_1.User.findById(decoded.userId)
                .select("role isVerifiedCreator isVerifiedVendor isVerifiedChurch isBanned banUntil banReason")
                .lean());
        if (!user) {
            res.status(401).json({ success: false, message: "User not found" });
            return;
        }
        // Refresh cache (best-effort)
        if (!cachedUser) {
            (0, redis_1.redisSafe)("authUserSet", (r) => __awaiter(void 0, void 0, void 0, function* () {
                yield r.set(userCacheKey, user, { ex: 120 }); // 2 minutes
                return true;
            }), false).catch(() => { });
        }
        // Check if user is banned (non-blocking update if expired)
        if (user.isBanned) {
            // Check if ban has expired
            if (user.banUntil && new Date() > user.banUntil) {
                // Ban expired, unban user (non-blocking - don't wait for update)
                user_model_1.User.findByIdAndUpdate(decoded.userId, {
                    isBanned: false,
                    banUntil: undefined,
                }).catch(err => logger_1.default.warn("Failed to unban user", { userId: decoded.userId, error: err.message }));
            }
            else {
                res.status(403).json({
                    success: false,
                    message: "Account is banned",
                    banReason: user.banReason || "Violation of community guidelines",
                    banUntil: user.banUntil || null,
                });
                return;
            }
        }
        // Attach the user object for role checks
        req.user = {
            role: user.role,
            isVerifiedCreator: user.isVerifiedCreator,
            isVerifiedVendor: user.isVerifiedVendor,
            isVerifiedChurch: user.isVerifiedChurch,
        };
        next();
    }
    catch (error) {
        res.status(401).json({
            success: false,
            message: "Invalid token",
            detail: error.message,
        });
    }
});
exports.verifyToken = verifyToken;
