"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationUtil = void 0;
const mongoose_1 = require("mongoose");
const response_util_1 = __importDefault(require("./response.util"));
/**
 * Validation Utility
 * Implements DRY principle for common validation patterns
 */
class ValidationUtil {
    /**
     * Validate MongoDB ObjectId
     */
    static isValidObjectId(id) {
        if (!id)
            return false;
        return mongoose_1.Types.ObjectId.isValid(id);
    }
    /**
     * Validate MongoDB ObjectId and return error if invalid
     */
    static validateObjectId(res, id, fieldName = "ID") {
        if (!this.isValidObjectId(id)) {
            response_util_1.default.badRequest(res, `Invalid ${fieldName}`);
            return false;
        }
        return true;
    }
    /**
     * Validate email format
     */
    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    /**
     * Validate email and return error if invalid
     */
    static validateEmail(res, email) {
        if (!email || !this.isValidEmail(email)) {
            response_util_1.default.badRequest(res, "Please provide a valid email address");
            return false;
        }
        return true;
    }
    /**
     * Validate required field
     */
    static validateRequired(res, value, fieldName, customMessage) {
        if (value === undefined || value === null || (typeof value === "string" && value.trim().length === 0)) {
            response_util_1.default.badRequest(res, customMessage || `${fieldName} is required`);
            return false;
        }
        return true;
    }
    /**
     * Validate string length
     */
    static validateLength(res, value, fieldName, minLength, maxLength) {
        if (!value) {
            response_util_1.default.badRequest(res, `${fieldName} is required`);
            return false;
        }
        if (minLength !== undefined && value.length < minLength) {
            response_util_1.default.badRequest(res, `${fieldName} must be at least ${minLength} characters`);
            return false;
        }
        if (maxLength !== undefined && value.length > maxLength) {
            response_util_1.default.badRequest(res, `${fieldName} must be at most ${maxLength} characters`);
            return false;
        }
        return true;
    }
    /**
     * Validate number range
     */
    static validateNumberRange(res, value, fieldName, min, max) {
        if (value === undefined || value === null || isNaN(value)) {
            response_util_1.default.badRequest(res, `${fieldName} must be a valid number`);
            return false;
        }
        if (min !== undefined && value < min) {
            response_util_1.default.badRequest(res, `${fieldName} must be at least ${min}`);
            return false;
        }
        if (max !== undefined && value > max) {
            response_util_1.default.badRequest(res, `${fieldName} must be at most ${max}`);
            return false;
        }
        return true;
    }
    /**
     * Validate array
     */
    static validateArray(res, value, fieldName, minItems, maxItems) {
        if (!Array.isArray(value)) {
            response_util_1.default.badRequest(res, `${fieldName} must be an array`);
            return false;
        }
        if (minItems !== undefined && value.length < minItems) {
            response_util_1.default.badRequest(res, `${fieldName} must contain at least ${minItems} items`);
            return false;
        }
        if (maxItems !== undefined && value.length > maxItems) {
            response_util_1.default.badRequest(res, `${fieldName} must contain at most ${maxItems} items`);
            return false;
        }
        return true;
    }
    /**
     * Validate enum value
     */
    static validateEnum(res, value, fieldName, allowedValues) {
        if (!value) {
            response_util_1.default.badRequest(res, `${fieldName} is required`);
            return false;
        }
        if (!allowedValues.includes(value)) {
            response_util_1.default.badRequest(res, `Invalid ${fieldName}. Must be one of: ${allowedValues.join(", ")}`);
            return false;
        }
        return true;
    }
    /**
     * Validate pagination parameters
     */
    static validatePagination(page, limit) {
        const pageNum = Math.max(1, parseInt(String(page || 1)) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(String(limit || 20)) || 20));
        return { page: pageNum, limit: limitNum };
    }
    /**
     * Validate user authentication
     */
    static validateAuthentication(res, userId) {
        if (!userId) {
            response_util_1.default.unauthorized(res);
            return false;
        }
        return true;
    }
    /**
     * Validate multiple fields at once
     */
    static validateFields(res, validations) {
        for (const validation of validations) {
            const { value, fieldName, required, type, minLength, maxLength, min, max, enumValues, customValidator } = validation;
            // Check required
            if (required && !this.validateRequired(res, value, fieldName)) {
                return false;
            }
            // Skip further validation if not required and value is empty
            if (!required && (value === undefined || value === null)) {
                continue;
            }
            // Type validation
            if (type) {
                switch (type) {
                    case "string":
                        if (typeof value !== "string") {
                            response_util_1.default.badRequest(res, `${fieldName} must be a string`);
                            return false;
                        }
                        if (minLength !== undefined || maxLength !== undefined) {
                            if (!this.validateLength(res, value, fieldName, minLength, maxLength)) {
                                return false;
                            }
                        }
                        break;
                    case "number":
                        if (typeof value !== "number" && isNaN(Number(value))) {
                            response_util_1.default.badRequest(res, `${fieldName} must be a number`);
                            return false;
                        }
                        if (min !== undefined || max !== undefined) {
                            if (!this.validateNumberRange(res, Number(value), fieldName, min, max)) {
                                return false;
                            }
                        }
                        break;
                    case "array":
                        if (!this.validateArray(res, value, fieldName)) {
                            return false;
                        }
                        break;
                    case "object":
                        if (typeof value !== "object" || Array.isArray(value)) {
                            response_util_1.default.badRequest(res, `${fieldName} must be an object`);
                            return false;
                        }
                        break;
                    case "email":
                        if (!this.validateEmail(res, value)) {
                            return false;
                        }
                        break;
                    case "objectId":
                        if (!this.validateObjectId(res, value, fieldName)) {
                            return false;
                        }
                        break;
                }
            }
            // Enum validation
            if (enumValues && value) {
                if (!this.validateEnum(res, value, fieldName, enumValues)) {
                    return false;
                }
            }
            // Custom validator
            if (customValidator) {
                const result = customValidator(value);
                if (!result.valid) {
                    response_util_1.default.badRequest(res, result.message || `Invalid ${fieldName}`);
                    return false;
                }
            }
        }
        return true;
    }
}
exports.ValidationUtil = ValidationUtil;
exports.default = ValidationUtil;
