"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const role_middleware_1 = require("../middleware/role.middleware");
const rateLimiter_1 = require("../middleware/rateLimiter");
const churches_admin_controller_1 = require("../controllers/churches.admin.controller");
const router = express_1.default.Router();
router.post("/churches", auth_middleware_1.verifyToken, role_middleware_1.requireAdmin, rateLimiter_1.apiRateLimiter, churches_admin_controller_1.createChurch);
router.post("/churches/:id/branches", auth_middleware_1.verifyToken, role_middleware_1.requireAdmin, rateLimiter_1.apiRateLimiter, churches_admin_controller_1.createBranch);
router.post("/churches/bulk", auth_middleware_1.verifyToken, role_middleware_1.requireAdmin, rateLimiter_1.apiRateLimiter, churches_admin_controller_1.bulkUpsert);
router.post("/churches/reindex", auth_middleware_1.verifyToken, role_middleware_1.requireAdmin, rateLimiter_1.apiRateLimiter, churches_admin_controller_1.reindex);
exports.default = router;
