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
exports.getUserAnalytics = exports.getUserVideos = exports.getUserMedia = exports.getUserPosts = exports.completeUserProfile = exports.getUserStats = exports.deleteUser = exports.updateUserProfile = exports.updateMyProfile = exports.getUserById = exports.getAllUsers = exports.getCurrentUser = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const user_service_1 = __importDefault(require("../service/user.service"));
const media_model_1 = require("../models/media.model");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * @swagger
 * components:
 *   schemas:
 *     UserProfile:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: User's unique identifier
 *         firstName:
 *           type: string
 *           description: User's first name
 *         lastName:
 *           type: string
 *           description: User's last name
 *         email:
 *           type: string
 *           format: email
 *           description: User's email address
 *         avatar:
 *           type: string
 *           description: User's avatar URL
 *         avatarUpload:
 *           type: string
 *           description: User's uploaded avatar URL
 *         section:
 *           type: string
 *           enum: [kids, adults]
 *           description: User's section (kids or adults)
 *         role:
 *           type: string
 *           enum: [learner, parent, educator, moderator, admin, content_creator, vendor, church_admin, artist]
 *           description: User's role in the platform
 *         isProfileComplete:
 *           type: boolean
 *           description: Whether the user's profile is complete
 *         isEmailVerified:
 *           type: boolean
 *           description: Whether the user's email is verified
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: User creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: User last update timestamp
 *     UserListResponse:
 *       type: object
 *       properties:
 *         users:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/UserProfile'
 *         total:
 *           type: number
 *           description: Total number of users
 *         page:
 *           type: number
 *           description: Current page number
 *         limit:
 *           type: number
 *           description: Number of users per page
 *         totalPages:
 *           type: number
 *           description: Total number of pages
 *     UserStats:
 *       type: object
 *       properties:
 *         totalUsers:
 *           type: number
 *           description: Total number of users
 *         verifiedUsers:
 *           type: number
 *           description: Number of verified users
 *         completeProfiles:
 *           type: number
 *           description: Number of users with complete profiles
 *         usersByRole:
 *           type: object
 *           description: Users grouped by role
 *         usersBySection:
 *           type: object
 *           description: Users grouped by section
 */
/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Get current user profile
 *     description: Retrieve the profile information of the currently authenticated user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/UserProfile'
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
const getCurrentUser = (request, response, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = request.userId; // populated by verifyToken middleware
        if (!userId) {
            logger_1.default.warn("Unauthorized access attempt - missing user ID", {
                ip: request.ip,
                userAgent: request.get("User-Agent"),
            });
            response.status(401).json({
                success: false,
                message: "Unauthorized: User ID missing",
            });
            return;
        }
        const user = yield user_service_1.default.getCurrentUser(userId);
        logger_1.default.info("Current user profile retrieved", { userId });
        response.status(200).json({
            success: true,
            data: user, // This will match your frontend expectation: data.firstName etc.
        });
    }
    catch (error) {
        logger_1.default.error("Error getting current user", {
            error: error.message,
            userId: request.userId,
        });
        next(error);
    }
});
exports.getCurrentUser = getCurrentUser;
/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users with pagination and filtering
 *     description: Retrieve a paginated list of users with optional filtering and search capabilities
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of users per page (max 100)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for filtering users by name or email
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [learner, parent, educator, moderator, admin, content_creator, vendor, church_admin, artist]
 *         description: Filter users by role
 *       - in: query
 *         name: section
 *         schema:
 *           type: string
 *           enum: [kids, adults]
 *         description: Filter users by section
 *       - in: query
 *         name: isProfileComplete
 *         schema:
 *           type: boolean
 *         description: Filter users by profile completion status
 *       - in: query
 *         name: isEmailVerified
 *         schema:
 *           type: boolean
 *         description: Filter users by email verification status
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/UserListResponse'
 *       401:
 *         description: Unauthorized - User not authenticated
 *       500:
 *         description: Internal server error
 */
const getAllUsers = (request, response, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { page = 1, limit = 10, search, role, section, isProfileComplete, isEmailVerified, } = request.query;
        // Parse and validate query parameters
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 10;
        // Build filters object
        const filters = {};
        if (search)
            filters.search = search;
        if (role)
            filters.role = role;
        if (section)
            filters.section = section;
        if (isProfileComplete !== undefined) {
            filters.isProfileComplete = isProfileComplete === "true";
        }
        if (isEmailVerified !== undefined) {
            filters.isEmailVerified = isEmailVerified === "true";
        }
        const result = yield user_service_1.default.getAllUsers(pageNum, limitNum, filters);
        logger_1.default.info("Users list retrieved", {
            requestedBy: request.userId,
            page: pageNum,
            limit: limitNum,
            total: result.total,
            filters: Object.keys(filters),
        });
        response.status(200).json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        logger_1.default.error("Error getting all users", {
            error: error.message,
            requestedBy: request.userId,
            query: request.query,
        });
        next(error);
    }
});
exports.getAllUsers = getAllUsers;
/**
 * @swagger
 * /api/users/{userId}:
 *   get:
 *     summary: Get user by ID
 *     description: Retrieve a specific user's profile by their ID
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User's unique identifier
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/UserProfile'
 *       400:
 *         description: Invalid user ID format
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
const getUserById = (request, response, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId } = request.params;
        if (!userId) {
            response.status(400).json({
                success: false,
                message: "User ID is required",
            });
            return;
        }
        const user = yield user_service_1.default.getUserById(userId);
        logger_1.default.info("User profile retrieved by ID", {
            requestedBy: request.userId,
            targetUserId: userId,
        });
        response.status(200).json({
            success: true,
            data: user,
        });
    }
    catch (error) {
        logger_1.default.error("Error getting user by ID", {
            error: error.message,
            requestedBy: request.userId,
            targetUserId: request.params.userId,
        });
        next(error);
    }
});
exports.getUserById = getUserById;
/**
 * @swagger
 * /api/users/{userId}:
 *   put:
 *     summary: Update user profile
 *     description: Update a user's profile information
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User's unique identifier
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 description: User's first name
 *               lastName:
 *                 type: string
 *                 description: User's last name
 *               section:
 *                 type: string
 *                 enum: [kids, adults]
 *                 description: User's section
 *               role:
 *                 type: string
 *                 enum: [learner, parent, educator, moderator, admin, content_creator, vendor, church_admin, artist]
 *                 description: User's role
 *     responses:
 *       200:
 *         description: User profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/UserProfile'
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * /api/users/me:
 *   patch:
 *     summary: Update current user profile
 *     description: Update the authenticated user's own profile information including bio
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 description: User's first name
 *               lastName:
 *                 type: string
 *                 description: User's last name
 *               bio:
 *                 type: string
 *                 maxLength: 500
 *                 description: User's bio (max 500 characters)
 *               section:
 *                 type: string
 *                 enum: [kids, adults]
 *                 description: User's section
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   $ref: '#/components/schemas/UserProfile'
 *                 message:
 *                   type: string
 *                   example: Profile updated successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized - User not authenticated
 *       500:
 *         description: Internal server error
 */
const updateMyProfile = (request, response, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = request.userId;
        const updateData = request.body;
        if (!userId) {
            response.status(401).json({
                success: false,
                message: "Unauthorized: User ID missing",
            });
            return;
        }
        // Only allow specific fields to be updated
        const allowedFields = ['firstName', 'lastName', 'bio', 'section'];
        const filteredData = {};
        for (const field of allowedFields) {
            if (updateData[field] !== undefined) {
                filteredData[field] = updateData[field];
            }
        }
        const updatedUser = yield user_service_1.default.updateUserProfile(userId, filteredData);
        logger_1.default.info("Current user profile updated", {
            userId,
            updatedFields: Object.keys(filteredData),
        });
        response.status(200).json({
            success: true,
            user: updatedUser,
            message: "Profile updated successfully",
        });
    }
    catch (error) {
        logger_1.default.error("Error updating current user profile", {
            error: error.message,
            userId: request.userId,
            updateData: request.body,
        });
        if (error.message.includes("500 characters")) {
            response.status(400).json({
                success: false,
                error: error.message,
                code: "VALIDATION_ERROR",
            });
            return;
        }
        next(error);
    }
});
exports.updateMyProfile = updateMyProfile;
const updateUserProfile = (request, response, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId } = request.params;
        const updateData = request.body;
        if (!userId) {
            response.status(400).json({
                success: false,
                message: "User ID is required",
            });
            return;
        }
        const updatedUser = yield user_service_1.default.updateUserProfile(userId, updateData);
        logger_1.default.info("User profile updated", {
            requestedBy: request.userId,
            targetUserId: userId,
            updatedFields: Object.keys(updateData),
        });
        response.status(200).json({
            success: true,
            data: updatedUser,
        });
    }
    catch (error) {
        logger_1.default.error("Error updating user profile", {
            error: error.message,
            requestedBy: request.userId,
            targetUserId: request.params.userId,
            updateData: request.body,
        });
        next(error);
    }
});
exports.updateUserProfile = updateUserProfile;
/**
 * @swagger
 * /api/users/{userId}:
 *   delete:
 *     summary: Delete user account
 *     description: Permanently delete a user account
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User's unique identifier
 *     responses:
 *       200:
 *         description: User account deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: User account deleted successfully
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
const deleteUser = (request, response, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId } = request.params;
        if (!userId) {
            response.status(400).json({
                success: false,
                message: "User ID is required",
            });
            return;
        }
        const result = yield user_service_1.default.deleteUser(userId);
        logger_1.default.info("User account deleted", {
            requestedBy: request.userId,
            targetUserId: userId,
        });
        response.status(200).json({
            success: true,
            message: result.message,
        });
    }
    catch (error) {
        logger_1.default.error("Error deleting user", {
            error: error.message,
            requestedBy: request.userId,
            targetUserId: request.params.userId,
        });
        next(error);
    }
});
exports.deleteUser = deleteUser;
/**
 * @swagger
 * /api/users/stats:
 *   get:
 *     summary: Get user statistics
 *     description: Retrieve comprehensive statistics about users in the platform
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/UserStats'
 *       401:
 *         description: Unauthorized - User not authenticated
 *       500:
 *         description: Internal server error
 */
const getUserStats = (request, response, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const stats = yield user_service_1.default.getUserStats();
        logger_1.default.info("User statistics retrieved", {
            requestedBy: request.userId,
        });
        response.status(200).json({
            success: true,
            data: stats,
        });
    }
    catch (error) {
        logger_1.default.error("Error getting user statistics", {
            error: error.message,
            requestedBy: request.userId,
        });
        next(error);
    }
});
exports.getUserStats = getUserStats;
/**
 * @swagger
 * /api/users/profile/complete:
 *   post:
 *     summary: Complete user profile
 *     description: Complete the user's profile with additional information
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               age:
 *                 type: number
 *                 description: User's age
 *               isKid:
 *                 type: boolean
 *                 description: Whether the user is a child
 *               section:
 *                 type: string
 *                 enum: [kids, adults]
 *                 description: User's section
 *               role:
 *                 type: string
 *                 enum: [learner, parent, educator, moderator, admin, content_creator, vendor, church_admin, artist]
 *                 description: User's role
 *               location:
 *                 type: string
 *                 description: User's location
 *               hasConsentedToPrivacyPolicy:
 *                 type: boolean
 *                 description: Whether user has consented to privacy policy
 *               parentalControlEnabled:
 *                 type: boolean
 *                 description: Whether parental controls are enabled
 *               parentEmail:
 *                 type: string
 *                 format: email
 *                 description: Parent's email address
 *     responses:
 *       200:
 *         description: Profile completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Profile completed successfully
 *                 user:
 *                   $ref: '#/components/schemas/UserProfile'
 *       400:
 *         description: Invalid request data or missing required fields
 *       401:
 *         description: Unauthorized - User not authenticated
 *       500:
 *         description: Internal server error
 */
const completeUserProfile = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const { age, isKid, section, role, location, hasConsentedToPrivacyPolicy, parentalControlEnabled, parentEmail, } = req.body;
        // Make validation more flexible - only require basic fields
        if (hasConsentedToPrivacyPolicy === undefined) {
            res.status(400).json({
                success: false,
                message: "Privacy policy consent is required",
            });
            return;
        }
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "User ID is required",
            });
            return;
        }
        const user = yield user_service_1.default.updateUserProfile(userId, {
            age: age || 0,
            isKid: isKid || false,
            section: section || "adults",
            role: role || "learner",
            location,
            parentEmail,
            parentalControlEnabled: parentalControlEnabled || false,
            hasConsentedToPrivacyPolicy,
            isProfileComplete: true,
        });
        logger_1.default.info("User profile completed", {
            userId,
            completedFields: Object.keys(req.body),
        });
        res.status(200).json({
            success: true,
            message: "Profile completed successfully",
            user,
        });
    }
    catch (error) {
        logger_1.default.error("Error completing user profile", {
            error: error.message,
            userId: req.userId,
            profileData: req.body,
        });
        next(error);
    }
});
exports.completeUserProfile = completeUserProfile;
/**
 * @swagger
 * /api/users/{userId}/posts:
 *   get:
 *     summary: Get user's posts
 *     description: Retrieve paginated list of user's posts (ebooks, devotionals, sermons)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User's unique identifier
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Posts retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Can only view own posts
 */
const getUserPosts = (request, response, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId } = request.params;
        const currentUserId = request.userId;
        if (!currentUserId) {
            response.status(401).json({
                success: false,
                error: "Authentication required",
                code: "UNAUTHORIZED",
            });
            return;
        }
        // Authorization: Users can only view their own posts
        if (userId !== currentUserId.toString()) {
            response.status(403).json({
                success: false,
                error: "You can only view your own posts",
                code: "FORBIDDEN",
            });
            return;
        }
        const page = parseInt(request.query.page) || 1;
        const limit = parseInt(request.query.limit) || 20;
        const skip = (page - 1) * limit;
        // Only user's own uploads, exclude default/copyright-free content
        const query = {
            uploadedBy: new mongoose_1.default.Types.ObjectId(userId),
            contentType: { $in: ["ebook", "devotional", "sermon"] },
            isDefaultContent: { $ne: true }, // Exclude default/pre-populated content
        };
        const [posts, total] = yield Promise.all([
            media_model_1.Media.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            media_model_1.Media.countDocuments(query),
        ]);
        response.status(200).json({
            success: true,
            data: {
                posts: posts.map((post) => ({
                    _id: post._id,
                    userId: post.uploadedBy.toString(),
                    content: post.description || "",
                    media: [
                        {
                            _id: post._id,
                            url: post.fileUrl || post.thumbnailUrl,
                            type: "image",
                            thumbnail: post.thumbnailUrl || post.fileUrl,
                        },
                    ],
                    likesCount: post.likeCount || 0,
                    commentsCount: post.commentCount || 0,
                    sharesCount: post.shareCount || 0,
                    createdAt: post.createdAt,
                    updatedAt: post.updatedAt,
                })),
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                    hasMore: skip + posts.length < total,
                },
            },
        });
    }
    catch (error) {
        logger_1.default.error("Error fetching user posts", {
            error: error.message,
            userId: request.params.userId,
        });
        next(error);
    }
});
exports.getUserPosts = getUserPosts;
/**
 * @swagger
 * /api/users/{userId}/media:
 *   get:
 *     summary: Get user's media (images)
 *     description: Retrieve paginated list of user's uploaded images/photos
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User's unique identifier
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [image, video]
 *         description: Filter by media type
 *     responses:
 *       200:
 *         description: Media retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Can only view own media
 */
const getUserMedia = (request, response, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId } = request.params;
        const currentUserId = request.userId;
        if (!currentUserId) {
            response.status(401).json({
                success: false,
                error: "Authentication required",
                code: "UNAUTHORIZED",
            });
            return;
        }
        // Authorization: Users can only view their own media
        if (userId !== currentUserId.toString()) {
            response.status(403).json({
                success: false,
                error: "You can only view your own media",
                code: "FORBIDDEN",
            });
            return;
        }
        const page = parseInt(request.query.page) || 1;
        const limit = parseInt(request.query.limit) || 20;
        const skip = (page - 1) * limit;
        const type = request.query.type;
        // Only user's own uploads, exclude default/copyright-free content
        const query = {
            uploadedBy: new mongoose_1.default.Types.ObjectId(userId),
            isDefaultContent: { $ne: true }, // Exclude default/pre-populated content
        };
        // Filter by type if provided - note: adjust based on your actual content type mapping
        if (type === "image") {
            // You may need to adjust this based on how images are stored
            query.contentType = { $in: ["image"] };
        }
        else if (type === "video") {
            query.contentType = { $in: ["videos", "sermon", "live", "recording"] };
        }
        const [media, total] = yield Promise.all([
            media_model_1.Media.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            media_model_1.Media.countDocuments(query),
        ]);
        response.status(200).json({
            success: true,
            data: {
                media: media.map((item) => ({
                    _id: item._id,
                    userId: item.uploadedBy.toString(),
                    url: item.fileUrl || item.thumbnailUrl,
                    thumbnail: item.thumbnailUrl || item.fileUrl,
                    type: type === "video" ? "video" : "image",
                    width: item.width,
                    height: item.height,
                    size: item.fileSize,
                    createdAt: item.createdAt,
                })),
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                    hasMore: skip + media.length < total,
                },
            },
        });
    }
    catch (error) {
        logger_1.default.error("Error fetching user media", {
            error: error.message,
            userId: request.params.userId,
        });
        next(error);
    }
});
exports.getUserMedia = getUserMedia;
/**
 * @swagger
 * /api/users/{userId}/videos:
 *   get:
 *     summary: Get user's videos
 *     description: Retrieve paginated list of user's uploaded videos
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Videos retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Can only view own videos
 */
const getUserVideos = (request, response, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId } = request.params;
        const currentUserId = request.userId;
        if (!currentUserId) {
            response.status(401).json({
                success: false,
                error: "Authentication required",
                code: "UNAUTHORIZED",
            });
            return;
        }
        // Authorization: Users can only view their own videos
        if (userId !== currentUserId.toString()) {
            response.status(403).json({
                success: false,
                error: "You can only view your own videos",
                code: "FORBIDDEN",
            });
            return;
        }
        const page = parseInt(request.query.page) || 1;
        const limit = parseInt(request.query.limit) || 20;
        const skip = (page - 1) * limit;
        // Only user's own uploads, exclude default/copyright-free content
        const query = {
            uploadedBy: new mongoose_1.default.Types.ObjectId(userId),
            contentType: { $in: ["videos", "sermon", "live", "recording"] },
            isDefaultContent: { $ne: true }, // Exclude default/pre-populated content
        };
        const [videos, total] = yield Promise.all([
            media_model_1.Media.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            media_model_1.Media.countDocuments(query),
        ]);
        response.status(200).json({
            success: true,
            data: {
                videos: videos.map((video) => ({
                    _id: video._id,
                    userId: video.uploadedBy.toString(),
                    url: video.fileUrl || video.playbackUrl || video.hlsUrl,
                    thumbnail: video.thumbnailUrl || video.fileUrl,
                    type: "video",
                    duration: video.duration,
                    width: video.width,
                    height: video.height,
                    size: video.fileSize,
                    title: video.title,
                    description: video.description,
                    viewsCount: video.viewCount || 0,
                    likesCount: video.likeCount || 0,
                    createdAt: video.createdAt,
                })),
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                    hasMore: skip + videos.length < total,
                },
            },
        });
    }
    catch (error) {
        logger_1.default.error("Error fetching user videos", {
            error: error.message,
            userId: request.params.userId,
        });
        next(error);
    }
});
exports.getUserVideos = getUserVideos;
/**
 * @swagger
 * /api/users/{userId}/analytics:
 *   get:
 *     summary: Get user analytics
 *     description: Retrieve aggregated analytics metrics for the user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Analytics retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Can only view own analytics
 */
const getUserAnalytics = (request, response, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { userId } = request.params;
        const currentUserId = request.userId;
        if (!currentUserId) {
            response.status(401).json({
                success: false,
                error: "Authentication required",
                code: "UNAUTHORIZED",
            });
            return;
        }
        // Authorization: Users can only view their own analytics
        if (userId !== currentUserId.toString()) {
            response.status(403).json({
                success: false,
                error: "You can only view your own analytics",
                code: "FORBIDDEN",
            });
            return;
        }
        const userIdObj = new mongoose_1.default.Types.ObjectId(userId);
        // Base query filter: Only user's own uploads, exclude default/copyright-free content
        const baseUserContentFilter = {
            uploadedBy: userIdObj,
            isDefaultContent: { $ne: true }, // Exclude default/pre-populated content
            isHidden: { $ne: true }, // Exclude hidden/rejected content
            moderationStatus: { $ne: "rejected" }, // Exclude rejected content
            // Note: isPublicDomain content uploaded by user should count, so we don't exclude it
            // Only admin-uploaded copyright-free content is excluded via uploadedBy filter
        };
        // Aggregate analytics data - ONLY user uploads, NOT copyright-free/default content
        const [totalPosts, publishedPosts, draftPosts, totalLikes, totalComments, totalShares, liveSessions, draftVideos,] = yield Promise.all([
            // Total posts (ebook, devotional, sermon) - user uploads only
            media_model_1.Media.countDocuments(Object.assign(Object.assign({}, baseUserContentFilter), { contentType: { $in: ["ebook", "devotional", "sermon"] } })),
            // Published posts (moderationStatus: "approved")
            media_model_1.Media.countDocuments(Object.assign(Object.assign({}, baseUserContentFilter), { contentType: { $in: ["ebook", "devotional", "sermon"] }, moderationStatus: "approved" })),
            // Draft posts (moderationStatus: "pending" or "under_review")
            media_model_1.Media.countDocuments(Object.assign(Object.assign({}, baseUserContentFilter), { contentType: { $in: ["ebook", "devotional", "sermon"] }, moderationStatus: { $in: ["pending", "under_review"] } })),
            // Total likes received (aggregate from Media) - user uploads only
            media_model_1.Media.aggregate([
                { $match: baseUserContentFilter },
                { $group: { _id: null, total: { $sum: "$likeCount" } } },
            ]).then((result) => { var _a; return ((_a = result[0]) === null || _a === void 0 ? void 0 : _a.total) || 0; }),
            // Total comments received - user uploads only
            media_model_1.Media.aggregate([
                { $match: baseUserContentFilter },
                { $group: { _id: null, total: { $sum: "$commentCount" } } },
            ]).then((result) => { var _a; return ((_a = result[0]) === null || _a === void 0 ? void 0 : _a.total) || 0; }),
            // Total shares received - user uploads only
            media_model_1.Media.aggregate([
                { $match: baseUserContentFilter },
                { $group: { _id: null, total: { $sum: "$shareCount" } } },
            ]).then((result) => { var _a; return ((_a = result[0]) === null || _a === void 0 ? void 0 : _a.total) || 0; }),
            // Live sessions count - user uploads only
            media_model_1.Media.countDocuments(Object.assign(Object.assign({}, baseUserContentFilter), { $or: [
                    { isLive: true },
                    { liveStreamStatus: "ended" },
                    { contentType: "live" },
                ] })),
            // Draft videos (moderationStatus: "pending" or "under_review")
            media_model_1.Media.countDocuments(Object.assign(Object.assign({}, baseUserContentFilter), { contentType: { $in: ["videos", "sermon", "live", "recording"] }, moderationStatus: { $in: ["pending", "under_review"] } })),
        ]);
        // Calculate live sessions total duration - user uploads only
        const liveSessionsData = yield media_model_1.Media.aggregate([
            {
                $match: Object.assign(Object.assign({}, baseUserContentFilter), { $or: [
                        { isLive: true },
                        { liveStreamStatus: "ended" },
                        { contentType: "live" },
                    ] }),
            },
            {
                $group: {
                    _id: null,
                    totalDuration: {
                        $sum: {
                            $cond: [
                                { $and: ["$actualStart", "$actualEnd"] },
                                {
                                    $divide: [
                                        { $subtract: ["$actualEnd", "$actualStart"] },
                                        1000,
                                    ],
                                },
                                0,
                            ],
                        },
                    },
                },
            },
        ]);
        const totalDuration = ((_a = liveSessionsData[0]) === null || _a === void 0 ? void 0 : _a.totalDuration) || 0;
        response.status(200).json({
            success: true,
            data: {
                posts: {
                    total: totalPosts,
                    published: publishedPosts,
                    drafts: draftPosts,
                },
                likes: {
                    total: totalLikes,
                    received: totalLikes,
                },
                liveSessions: {
                    total: liveSessions,
                    totalDuration: totalDuration,
                },
                comments: {
                    total: totalComments,
                    received: totalComments,
                },
                drafts: {
                    total: draftPosts + draftVideos,
                    posts: draftPosts,
                    videos: draftVideos,
                },
                shares: {
                    total: totalShares,
                    received: totalShares,
                },
            },
        });
    }
    catch (error) {
        logger_1.default.error("Error fetching user analytics", {
            error: error.message,
            userId: request.params.userId,
        });
        next(error);
    }
});
exports.getUserAnalytics = getUserAnalytics;
