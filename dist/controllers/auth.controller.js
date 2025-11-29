"use strict";
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
const auth_service_1 = __importDefault(require("../service/auth.service"));
// import { VALID_INTERESTS } from "../constants/interests";
const user_model_1 = require("../models/user.model");
const multer_1 = __importDefault(require("multer"));
class AuthController {
    clerkLogin(request, response, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { token, userInfo } = request.body;
                // Validate required fields
                if (!token) {
                    return response.status(400).json({
                        success: false,
                        message: "Clerk authentication token is required",
                    });
                }
                if (!userInfo || typeof userInfo !== "object") {
                    return response.status(400).json({
                        success: false,
                        message: "User information object is required",
                    });
                }
                const result = yield auth_service_1.default.clerkLogin(token, userInfo);
                return response.status(200).json({
                    success: true,
                    message: "Clerk login successful",
                    user: result.user,
                    needsAgeSelection: result.needsAgeSelection,
                    isNewUser: result.isNewUser,
                });
            }
            catch (error) {
                console.error("Clerk login error:", error);
                // Handle specific error types
                if (error.message.includes("Token")) {
                    return response.status(401).json({
                        success: false,
                        message: "Invalid or expired Clerk token",
                    });
                }
                if (error.message.includes("email")) {
                    return response.status(400).json({
                        success: false,
                        message: error.message,
                    });
                }
                return response.status(500).json({
                    success: false,
                    message: "Authentication failed. Please try again.",
                });
            }
        });
    }
    oauthLogin(request, response, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { provider, token, userInfo } = request.body;
                // Validate required fields
                if (!provider) {
                    return response.status(400).json({
                        success: false,
                        message: "OAuth provider is required (e.g., 'google', 'facebook')",
                    });
                }
                if (!token) {
                    return response.status(400).json({
                        success: false,
                        message: "OAuth authentication token is required",
                    });
                }
                if (!userInfo || typeof userInfo !== "object") {
                    return response.status(400).json({
                        success: false,
                        message: "User information object is required",
                    });
                }
                const result = yield auth_service_1.default.oauthLogin(provider, token, userInfo);
                return response.status(200).json({
                    success: true,
                    message: `${provider} login successful`,
                    token: result.token,
                    user: result.user,
                    isNewUser: result.isNewUser,
                });
            }
            catch (error) {
                console.error("OAuth login error:", error);
                // Handle specific error types
                if (error.message.includes("Token")) {
                    return response.status(401).json({
                        success: false,
                        message: "Invalid or expired OAuth token",
                    });
                }
                if (error.message.includes("email")) {
                    return response.status(400).json({
                        success: false,
                        message: error.message,
                    });
                }
                if (error.message.includes("Provider")) {
                    return response.status(400).json({
                        success: false,
                        message: error.message,
                    });
                }
                return response.status(500).json({
                    success: false,
                    message: "OAuth authentication failed. Please try again.",
                });
            }
        });
    }
    registerUser(request, response, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { email, password, firstName, lastName } = request.body;
                // Validate required fields according to BRD
                if (!email || !password || !firstName || !lastName) {
                    return response.status(400).json({
                        success: false,
                        message: "First name, last name, email, and password are required for registration",
                    });
                }
                // Validate email format
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    return response.status(400).json({
                        success: false,
                        message: "Please provide a valid email address",
                    });
                }
                // Validate password strength (minimum 6 characters)
                if (password.length < 6) {
                    return response.status(400).json({
                        success: false,
                        message: "Password must be at least 6 characters long",
                    });
                }
                // Register user with default 'learner' role (future feature ready)
                const user = yield auth_service_1.default.registerUser(email, password, firstName, lastName);
                return response.status(201).json({
                    success: true,
                    message: "User registered successfully. Please verify your email.",
                    user,
                });
            }
            catch (error) {
                if (error instanceof Error) {
                    if (error.message === "Email address is already registered") {
                        return response.status(400).json({
                            success: false,
                            message: error.message,
                        });
                    }
                    if (error.message.includes("Unable to send verification email")) {
                        return response.status(500).json({
                            success: false,
                            message: error.message,
                        });
                    }
                    if (error.message.includes("Unable to send welcome email")) {
                        return response.status(500).json({
                            success: false,
                            message: error.message,
                        });
                    }
                }
                return next(error);
            }
        });
    }
    loginUser(request, response, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { email, password, rememberMe = false, } = request.body;
                if (!email || !password) {
                    return response.status(400).json({
                        success: false,
                        message: "Email and password are required",
                    });
                }
                // Extract device info for security tracking
                const deviceInfo = request.headers["user-agent"] || "Unknown";
                const ipAddress = request.ip || request.socket.remoteAddress || "Unknown";
                const userAgent = request.headers["user-agent"] || "";
                const result = yield auth_service_1.default.loginUser(email, password, rememberMe, deviceInfo, ipAddress, userAgent);
                // Set secure httpOnly cookie for refresh token if rememberMe is true
                if (rememberMe && result.refreshToken) {
                    const isProduction = process.env.NODE_ENV === "production";
                    response.cookie("refreshToken", result.refreshToken, {
                        httpOnly: true, // Prevents JavaScript access (XSS protection)
                        secure: isProduction, // Only send over HTTPS in production
                        sameSite: isProduction ? "strict" : "lax", // CSRF protection
                        maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days in milliseconds
                        path: "/", // Available for all routes
                    });
                }
                // Return access token in response body (for immediate use)
                return response.status(200).json({
                    success: true,
                    message: "Login successful",
                    token: result.accessToken, // Access token for Authorization header
                    accessToken: result.accessToken, // Alias for clarity
                    user: result.user,
                    rememberMe: rememberMe,
                });
            }
            catch (error) {
                if (error instanceof Error) {
                    if (error.message === "Invalid email or password") {
                        return response.status(400).json({
                            success: false,
                            message: error.message,
                        });
                    }
                    if (error.message === "Please verify your email before logging in") {
                        return response.status(403).json({
                            success: false,
                            message: error.message,
                        });
                    }
                }
                return next(error);
            }
        });
    }
    verifyEmail(request, response, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { email, code } = request.body;
                if (!email || !code) {
                    return response.status(400).json({
                        success: false,
                        message: "Email and verification code are required",
                    });
                }
                const user = yield auth_service_1.default.verifyEmail(email, code);
                return response.status(200).json({
                    success: true,
                    message: "Email verified successfully",
                    user: {
                        id: user._id,
                        email: user.email,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        isEmailVerified: user.isEmailVerified,
                        role: user.role,
                    },
                });
            }
            catch (error) {
                if (error instanceof Error) {
                    if (error.message === "Invalid email or code") {
                        return response.status(400).json({
                            success: false,
                            message: error.message,
                        });
                    }
                    if (error.message === "Verification code expired") {
                        return response.status(400).json({
                            success: false,
                            message: error.message,
                        });
                    }
                }
                return next(error);
            }
        });
    }
    resetPassword(request, response, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { email, token, newPassword } = request.body;
                if (!email || !token || !newPassword) {
                    return response.status(400).json({
                        success: false,
                        message: "Email, token, and new password are required",
                    });
                }
                yield auth_service_1.default.resetPassword(email, token, newPassword);
                return response.status(200).json({
                    success: true,
                    message: "Password reset successfully",
                });
            }
            catch (error) {
                if (error instanceof Error &&
                    error.message === "Invalid or expired reset token") {
                    return response.status(400).json({
                        success: false,
                        message: error.message,
                    });
                }
                return next(error);
            }
        });
    }
    resendVerificationEmail(request, response, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { email } = request.body;
                if (!email) {
                    return response.status(400).json({
                        success: false,
                        message: "Email is required",
                    });
                }
                yield auth_service_1.default.resendVerificationEmail(email);
                return response.status(200).json({
                    success: true,
                    message: "Verification email resent successfully",
                });
            }
            catch (error) {
                if (error instanceof Error) {
                    if (error.message === "User not found") {
                        return response.status(404).json({
                            success: false,
                            message: error.message,
                        });
                    }
                    if (error.message === "Email already verified") {
                        return response.status(400).json({
                            success: false,
                            message: error.message,
                        });
                    }
                }
                return next(error);
            }
        });
    }
    completeUserProfile(request, response, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = request.userId;
                if (!userId) {
                    return response.status(401).json({
                        success: false,
                        message: "Unauthorized",
                    });
                }
                const { age, isKid, section, role, location, avatarUpload, interests, hasConsentedToPrivacyPolicy, parentalControlEnabled, parentEmail, } = request.body;
                const updateFields = {};
                if (age !== undefined)
                    updateFields.age = age;
                if (isKid !== undefined)
                    updateFields.isKid = isKid;
                if (section !== undefined)
                    updateFields.section = section;
                if (role !== undefined)
                    updateFields.role = role;
                if (location !== undefined)
                    updateFields.location = location;
                if (avatarUpload !== undefined)
                    updateFields.avatarUpload = avatarUpload;
                if (interests !== undefined)
                    updateFields.interests = interests;
                if (hasConsentedToPrivacyPolicy !== undefined) {
                    updateFields.hasConsentedToPrivacyPolicy = hasConsentedToPrivacyPolicy;
                }
                if (parentalControlEnabled !== undefined) {
                    updateFields.parentalControlEnabled = parentalControlEnabled;
                }
                if (parentEmail !== undefined)
                    updateFields.parentEmail = parentEmail;
                const userBeforeUpdate = yield user_model_1.User.findById(userId);
                if (!userBeforeUpdate) {
                    return response.status(404).json({
                        success: false,
                        message: "User not found",
                    });
                }
                const isSet = (field) => userBeforeUpdate[field] !== undefined ||
                    updateFields[field] !== undefined;
                const isProfileComplete = isSet("hasConsentedToPrivacyPolicy"); // Only require privacy policy consent
                // Update user with provided fields and defaults
                const finalUpdateFields = Object.assign(Object.assign({}, updateFields), { age: updateFields.age || userBeforeUpdate.age || 0, isKid: updateFields.isKid !== undefined
                        ? updateFields.isKid
                        : userBeforeUpdate.isKid || false, section: updateFields.section || userBeforeUpdate.section || "adults", role: updateFields.role || userBeforeUpdate.role || "learner", parentalControlEnabled: updateFields.parentalControlEnabled !== undefined
                        ? updateFields.parentalControlEnabled
                        : userBeforeUpdate.parentalControlEnabled || false, isProfileComplete });
                const updatedUser = yield user_model_1.User.findByIdAndUpdate(userId, finalUpdateFields, {
                    new: true,
                });
                return response.status(200).json({
                    success: true,
                    message: "Profile updated successfully",
                    user: updatedUser,
                });
            }
            catch (error) {
                return next(error);
            }
        });
    }
    getCurrentUser(request, response, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = request.userId;
                if (!userId) {
                    return response.status(401).json({
                        success: false,
                        message: "Unauthorized: User ID missing",
                    });
                }
                const user = yield auth_service_1.default.getCurrentUser(userId);
                return response.status(200).json({
                    success: true,
                    user,
                });
            }
            catch (error) {
                if (error instanceof Error && error.message === "User not found") {
                    return response.status(404).json({
                        success: false,
                        message: error.message,
                    });
                }
                return next(error);
            }
        });
    }
    getUserSession(request, response, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = request.userId;
                if (!userId) {
                    return response.status(401).json({
                        success: false,
                        message: "Unauthorized: User ID missing",
                    });
                }
                const session = yield auth_service_1.default.getUserSession(userId);
                return response.status(200).json({
                    success: true,
                    session,
                });
            }
            catch (error) {
                if (error instanceof Error && error.message === "User not found") {
                    return response.status(404).json({
                        success: false,
                        message: error.message,
                    });
                }
                return next(error);
            }
        });
    }
    updateUserAvatar(request, response, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = request.userId;
                const avatarFile = request.file;
                if (!userId) {
                    return response.status(401).json({
                        success: false,
                        message: "Unauthorized: User ID missing",
                    });
                }
                if (!avatarFile) {
                    return response.status(400).json({
                        success: false,
                        message: "Avatar image is required",
                    });
                }
                const validImageMimeTypes = ["image/jpeg", "image/png", "image/gif"];
                if (!validImageMimeTypes.includes(avatarFile.mimetype)) {
                    return response.status(400).json({
                        success: false,
                        message: `Invalid image type: ${avatarFile.mimetype}`,
                    });
                }
                const updateResult = yield auth_service_1.default.updateUserAvatar(userId, avatarFile.buffer, avatarFile.mimetype);
                return response.status(200).json({
                    success: true,
                    message: "Avatar updated successfully",
                    data: updateResult,
                });
            }
            catch (error) {
                if (error instanceof Error && error.message === "User not found") {
                    return response.status(404).json({
                        success: false,
                        message: error.message,
                    });
                }
                if (error instanceof Error &&
                    error.message.startsWith("Invalid image type")) {
                    return response.status(400).json({
                        success: false,
                        message: error.message,
                    });
                }
                if (error instanceof multer_1.default.MulterError &&
                    error.code === "LIMIT_UNEXPECTED_FILE") {
                    return response.status(400).json({
                        success: false,
                        message: `Unexpected field in file upload. Expected field name: 'avatar'`,
                    });
                }
                if (error instanceof multer_1.default.MulterError &&
                    error.code === "LIMIT_FILE_SIZE") {
                    return response.status(400).json({
                        success: false,
                        message: "File size exceeds the 5MB limit",
                    });
                }
                return next(error);
            }
        });
    }
    initiatePasswordReset(request, response, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { email } = request.body;
                if (!email) {
                    return response.status(400).json({
                        success: false,
                        message: "Email is required",
                    });
                }
                const result = yield auth_service_1.default.initiatePasswordReset(email);
                return response.status(200).json({
                    success: true,
                    message: "Password reset code sent to your email",
                });
            }
            catch (error) {
                if (error instanceof Error && error.message === "User not found") {
                    return response.status(404).json({
                        success: false,
                        message: error.message,
                    });
                }
                return next(error);
            }
        });
    }
    verifyResetCode(request, response, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { email, code } = request.body;
                if (!email || !code) {
                    return response.status(400).json({
                        success: false,
                        message: "Email and verification code are required",
                    });
                }
                const result = yield auth_service_1.default.verifyResetCode(email, code);
                return response.status(200).json({
                    success: true,
                    message: "Reset code verified successfully",
                });
            }
            catch (error) {
                if (error instanceof Error &&
                    error.message === "Invalid or expired reset code") {
                    return response.status(400).json({
                        success: false,
                        message: error.message,
                    });
                }
                return next(error);
            }
        });
    }
    resetPasswordWithCode(request, response, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { email, code, newPassword } = request.body;
                if (!email || !code || !newPassword) {
                    return response.status(400).json({
                        success: false,
                        message: "Email, verification code, and new password are required",
                    });
                }
                // Validate password strength (minimum 6 characters)
                if (newPassword.length < 6) {
                    return response.status(400).json({
                        success: false,
                        message: "Password must be at least 6 characters long",
                    });
                }
                yield auth_service_1.default.resetPasswordWithCode(email, code, newPassword);
                return response.status(200).json({
                    success: true,
                    message: "Password reset successfully",
                });
            }
            catch (error) {
                if (error instanceof Error &&
                    error.message === "Invalid or expired reset code") {
                    return response.status(400).json({
                        success: false,
                        message: error.message,
                    });
                }
                return next(error);
            }
        });
    }
    logout(request, response, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const userId = request.userId;
                const token = (_a = request.headers.authorization) === null || _a === void 0 ? void 0 : _a.split(" ")[1]; // Access token from header
                const refreshToken = (_b = request.cookies) === null || _b === void 0 ? void 0 : _b.refreshToken; // Refresh token from cookie
                if (!userId || !token) {
                    return response.status(401).json({
                        success: false,
                        message: "Unauthorized: User ID or token missing",
                    });
                }
                yield auth_service_1.default.logout(userId, token, refreshToken);
                // Clear refresh token cookie
                response.clearCookie("refreshToken", {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
                    path: "/",
                });
                return response.status(200).json({
                    success: true,
                    message: "Logout successful",
                });
            }
            catch (error) {
                if (error instanceof Error && error.message === "User not found") {
                    return response.status(404).json({
                        success: false,
                        message: error.message,
                    });
                }
                return next(error);
            }
        });
    }
    registerArtist(request, response, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { email, password, firstName, lastName, artistName, genre, bio, socialMedia, recordLabel, yearsActive, } = request.body;
                const avatarFile = request.file;
                // Validate required fields
                if (!email || !password || !firstName || !artistName || !genre) {
                    return response.status(400).json({
                        success: false,
                        message: "Email, password, first name, artist name, and genre are required fields",
                    });
                }
                // Validate genre array
                if (!Array.isArray(genre) || genre.length === 0) {
                    return response.status(400).json({
                        success: false,
                        message: "Genre must be a non-empty array",
                    });
                }
                const artist = yield auth_service_1.default.registerArtist(email, password, firstName, lastName, artistName, genre, bio, socialMedia, recordLabel, yearsActive, avatarFile === null || avatarFile === void 0 ? void 0 : avatarFile.buffer, avatarFile === null || avatarFile === void 0 ? void 0 : avatarFile.mimetype);
                return response.status(201).json({
                    success: true,
                    message: "Artist registered successfully. Please verify your email.",
                    artist,
                });
            }
            catch (error) {
                if (error instanceof Error) {
                    if (error.message === "Email address is already registered") {
                        return response.status(400).json({
                            success: false,
                            message: error.message,
                        });
                    }
                    if (error.message.includes("Unable to send welcome email")) {
                        return response.status(500).json({
                            success: false,
                            message: error.message,
                        });
                    }
                    if (error.message.includes("Invalid genres")) {
                        return response.status(400).json({
                            success: false,
                            message: error.message,
                        });
                    }
                    if (error.message.includes("Artist name")) {
                        return response.status(400).json({
                            success: false,
                            message: error.message,
                        });
                    }
                }
                return next(error);
            }
        });
    }
    verifyArtist(request, response, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { userId } = request.params;
                const { verificationDocuments } = request.body;
                if (!verificationDocuments || !Array.isArray(verificationDocuments)) {
                    return response.status(400).json({
                        success: false,
                        message: "Verification documents array is required",
                    });
                }
                const artist = yield auth_service_1.default.verifyArtist(userId, verificationDocuments);
                return response.status(200).json({
                    success: true,
                    message: "Artist verified successfully",
                    artist,
                });
            }
            catch (error) {
                if (error instanceof Error) {
                    if (error.message.includes("not found")) {
                        return response.status(404).json({
                            success: false,
                            message: error.message,
                        });
                    }
                    if (error.message.includes("not an artist")) {
                        return response.status(400).json({
                            success: false,
                            message: error.message,
                        });
                    }
                }
                return next(error);
            }
        });
    }
    updateArtistProfile(request, response, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { userId } = request.params;
                const updates = request.body;
                // Validate that the authenticated user is updating their own profile
                if (request.userId !== userId) {
                    return response.status(403).json({
                        success: false,
                        message: "You can only update your own artist profile",
                    });
                }
                const artist = yield auth_service_1.default.updateArtistProfile(userId, updates);
                return response.status(200).json({
                    success: true,
                    message: "Artist profile updated successfully",
                    artist,
                });
            }
            catch (error) {
                if (error instanceof Error) {
                    if (error.message.includes("not found")) {
                        return response.status(404).json({
                            success: false,
                            message: error.message,
                        });
                    }
                    if (error.message.includes("not an artist")) {
                        return response.status(400).json({
                            success: false,
                            message: error.message,
                        });
                    }
                    if (error.message.includes("Artist name") ||
                        error.message.includes("genre")) {
                        return response.status(400).json({
                            success: false,
                            message: error.message,
                        });
                    }
                }
                return next(error);
            }
        });
    }
    getUserNameAndAge(request, response, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = request.userId;
                if (!userId) {
                    return response.status(401).json({
                        success: false,
                        message: "Unauthorized: User ID missing",
                    });
                }
                const userInfo = yield auth_service_1.default.getUserNameAndAge(userId);
                return response.status(200).json({
                    success: true,
                    user: userInfo,
                });
            }
            catch (error) {
                if (error instanceof Error && error.message === "User not found") {
                    return response.status(404).json({
                        success: false,
                        message: error.message,
                    });
                }
                return next(error);
            }
        });
    }
    getUserProfilePicture(request, response, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = request.userId;
                if (!userId) {
                    return response.status(401).json({
                        success: false,
                        message: "Unauthorized: User ID missing",
                    });
                }
                const profilePicture = yield auth_service_1.default.getUserProfilePicture(userId);
                return response.status(200).json({
                    success: true,
                    profilePicture,
                });
            }
            catch (error) {
                if (error instanceof Error && error.message === "User not found") {
                    return response.status(404).json({
                        success: false,
                        message: error.message,
                    });
                }
                return next(error);
            }
        });
    }
    refreshToken(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                // Get refresh token from cookie (preferred) or request body
                const refreshTokenString = ((_a = req.cookies) === null || _a === void 0 ? void 0 : _a.refreshToken) || ((_b = req.body) === null || _b === void 0 ? void 0 : _b.refreshToken);
                if (!refreshTokenString) {
                    res.status(400).json({
                        success: false,
                        message: "Refresh token is required",
                    });
                    return;
                }
                // Refresh the token
                const result = yield auth_service_1.default.refreshToken(refreshTokenString);
                res.json({
                    success: true,
                    message: "Token refreshed successfully",
                    data: {
                        token: result.accessToken,
                        accessToken: result.accessToken,
                        user: result.user,
                    },
                });
            }
            catch (error) {
                console.error("Token refresh error:", error);
                // Clear invalid refresh token cookie
                res.clearCookie("refreshToken", {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
                    path: "/",
                });
                res.status(401).json({
                    success: false,
                    message: error.message || "Invalid or expired refresh token",
                });
            }
        });
    }
}
exports.default = new AuthController();
