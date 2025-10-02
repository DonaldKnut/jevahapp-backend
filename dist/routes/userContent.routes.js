"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const rateLimiter_1 = require("../middleware/rateLimiter");
const userContent_controller_1 = require("../controllers/userContent.controller");
const router = express_1.default.Router();
router.get("/user/tabs", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, userContent_controller_1.getProfileTabs);
router.get("/user/photos", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, userContent_controller_1.getUserPhotos);
router.get("/user/posts", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, userContent_controller_1.getUserPosts);
router.get("/user/videos", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, userContent_controller_1.getUserVideos);
router.get("/user/audios", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, userContent_controller_1.getUserAudios);
router.get("/user/content/:id", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, userContent_controller_1.getUserContentById);
exports.default = router;
