"use strict";
/**
 * Token Configuration
 *
 * Defines token expiration times for different authentication scenarios.
 * These values are used to control how long authentication tokens remain valid.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.JWT_ALGORITHM = exports.JWT_SECRET = exports.TOKEN_EXPIRATION = void 0;
exports.TOKEN_EXPIRATION = {
    /**
     * Long-lived token expiration for "Remember Me" enabled sessions
     * 30 days in seconds (30 * 24 * 60 * 60)
     */
    REMEMBER_ME: 30 * 24 * 60 * 60, // 30 days
    /**
     * Standard token expiration for regular sessions
     * 7 days in seconds (7 * 24 * 60 * 60)
     */
    STANDARD: 7 * 24 * 60 * 60, // 7 days
};
/**
 * JWT Secret from environment variables
 */
exports.JWT_SECRET = process.env.JWT_SECRET;
/**
 * JWT Algorithm to use for signing tokens
 */
exports.JWT_ALGORITHM = 'HS256';
/**
 * Validates that JWT_SECRET is defined
 */
if (!exports.JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined in environment variables");
}
