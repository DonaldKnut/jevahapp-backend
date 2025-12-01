"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseUtil = void 0;
class ResponseUtil {
    /**
     * Send success response
     */
    static success(res, data, message = "Operation successful", statusCode = 200) {
        const response = Object.assign({ success: true, message }, (data !== undefined && { data }));
        res.status(statusCode).json(response);
    }
    /**
     * Send error response
     */
    static error(res, message = "An error occurred", statusCode = 500, error) {
        const response = Object.assign({ success: false, message }, (error && { error }));
        res.status(statusCode).json(response);
    }
    /**
     * Send unauthorized response
     */
    static unauthorized(res, message = "Unauthorized: User not authenticated") {
        this.error(res, message, 401);
    }
    /**
     * Send forbidden response
     */
    static forbidden(res, message = "Forbidden: You don't have permission to perform this action") {
        this.error(res, message, 403);
    }
    /**
     * Send not found response
     */
    static notFound(res, message = "Resource not found") {
        this.error(res, message, 404);
    }
    /**
     * Send bad request response
     */
    static badRequest(res, message = "Bad request", error) {
        this.error(res, message, 400, error);
    }
    /**
     * Send created response
     */
    static created(res, data, message = "Resource created successfully") {
        this.success(res, data, message, 201);
    }
    /**
     * Send paginated response
     */
    static paginated(res, data, pagination, message = "Data retrieved successfully") {
        const response = {
            success: true,
            message,
            data,
            pagination: Object.assign(Object.assign({}, pagination), { pages: Math.ceil(pagination.total / pagination.limit) }),
        };
        res.status(200).json(response);
    }
    /**
     * Send validation error response
     */
    static validationError(res, message, errors) {
        const response = Object.assign({ success: false, message }, (errors && { error: "Validation failed", data: { errors } }));
        res.status(400).json(response);
    }
    /**
     * Send server error response
     */
    static serverError(res, message = "Internal server error") {
        this.error(res, message, 500);
    }
}
exports.ResponseUtil = ResponseUtil;
exports.default = ResponseUtil;
