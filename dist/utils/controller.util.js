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
exports.ControllerUtil = void 0;
const mongoose_1 = require("mongoose");
const response_util_1 = __importDefault(require("./response.util"));
const validation_util_1 = __importDefault(require("./validation.util"));
const logger_1 = __importDefault(require("./logger"));
/**
 * Controller Utility
 * Implements DRY principle for common controller patterns
 */
class ControllerUtil {
    /**
     * Wrapper for async controller functions with error handling
     * Reduces boilerplate try-catch blocks
     */
    static asyncHandler(handler) {
        return (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            try {
                yield handler(req, res);
            }
            catch (error) {
                logger_1.default.error("Controller error:", {
                    error: error.message,
                    stack: error.stack,
                    method: req.method,
                    url: req.originalUrl,
                    userId: req.userId || "anonymous",
                });
                // Handle known error types
                if (error.message.includes("not found")) {
                    response_util_1.default.notFound(res, error.message);
                    return;
                }
                if (error.message.includes("Unauthorized") || error.message.includes("permission")) {
                    response_util_1.default.forbidden(res, error.message);
                    return;
                }
                if (error.message.includes("Invalid") || error.message.includes("required")) {
                    response_util_1.default.badRequest(res, error.message);
                    return;
                }
                // Default server error
                response_util_1.default.serverError(res, error.message || "An unexpected error occurred");
            }
        });
    }
    /**
     * Extract pagination parameters from request
     */
    static getPagination(req) {
        const { page, limit } = validation_util_1.default.validatePagination(req.query.page, req.query.limit);
        const skip = (page - 1) * limit;
        return { page, limit, skip };
    }
    /**
     * Get authenticated user ID (with validation)
     */
    static getUserId(req, res) {
        if (!req.userId) {
            response_util_1.default.unauthorized(res);
            return null;
        }
        return req.userId;
    }
    /**
     * Check if user is authenticated
     */
    static requireAuth(req, res) {
        return validation_util_1.default.validateAuthentication(res, req.userId);
    }
    /**
     * Check if user is admin
     */
    static requireAdmin(req, res) {
        var _a;
        if (!this.requireAuth(req, res)) {
            return false;
        }
        const userRole = req.userRole || ((_a = req.user) === null || _a === void 0 ? void 0 : _a.role);
        if (userRole !== "admin") {
            response_util_1.default.forbidden(res, "Admin access required");
            return false;
        }
        return true;
    }
    /**
     * Validate and convert ObjectId
     */
    static validateAndConvertObjectId(res, id, fieldName = "ID") {
        if (!validation_util_1.default.validateObjectId(res, id, fieldName)) {
            return null;
        }
        return new mongoose_1.Types.ObjectId(id);
    }
    /**
     * Check resource ownership
     */
    static checkOwnership(res_1, resourceUserId_1, currentUserId_1) {
        return __awaiter(this, arguments, void 0, function* (res, resourceUserId, currentUserId, resourceName = "resource") {
            const resourceUserIdString = resourceUserId instanceof mongoose_1.Types.ObjectId
                ? resourceUserId.toString()
                : resourceUserId;
            if (resourceUserIdString !== currentUserId) {
                response_util_1.default.forbidden(res, `You can only modify your own ${resourceName}`);
                return false;
            }
            return true;
        });
    }
    /**
     * Handle service errors consistently
     */
    static handleServiceError(res, error, defaultMessage = "Operation failed") {
        logger_1.default.error("Service error:", error);
        if (error.message) {
            // Check for common error patterns
            if (error.message.includes("not found")) {
                response_util_1.default.notFound(res, error.message);
                return;
            }
            if (error.message.includes("already exists") || error.message.includes("already")) {
                response_util_1.default.badRequest(res, error.message);
                return;
            }
            if (error.message.includes("permission") || error.message.includes("unauthorized")) {
                response_util_1.default.forbidden(res, error.message);
                return;
            }
            if (error.message.includes("Invalid") || error.message.includes("required")) {
                response_util_1.default.badRequest(res, error.message);
                return;
            }
        }
        response_util_1.default.serverError(res, defaultMessage);
    }
    /**
     * Build paginated response
     */
    static paginatedResponse(res, data, total, page, limit, message) {
        response_util_1.default.paginated(res, data, { page, limit, total }, message);
    }
    /**
     * Extract query parameters with defaults
     */
    static getQueryParam(req, key, defaultValue, parser) {
        const value = req.query[key];
        if (value === undefined || value === null) {
            return defaultValue;
        }
        if (parser) {
            return parser(value);
        }
        return value;
    }
    /**
     * Extract body parameter with validation
     */
    static getBodyParam(res, req, key, required = false, defaultValue, validator) {
        const value = req.body[key];
        if (value === undefined || value === null) {
            if (required) {
                response_util_1.default.badRequest(res, `${key} is required`);
                return undefined;
            }
            return defaultValue;
        }
        if (validator) {
            const result = validator(value);
            if (!result.valid) {
                response_util_1.default.badRequest(res, result.message || `Invalid ${key}`);
                return undefined;
            }
        }
        return value;
    }
}
exports.ControllerUtil = ControllerUtil;
exports.default = ControllerUtil;
