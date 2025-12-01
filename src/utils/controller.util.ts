import { Request, Response } from "express";
import { Types } from "mongoose";
import ResponseUtil from "./response.util";
import ValidationUtil from "./validation.util";
import logger from "./logger";

/**
 * Controller Utility
 * Implements DRY principle for common controller patterns
 */

export class ControllerUtil {
  /**
   * Wrapper for async controller functions with error handling
   * Reduces boilerplate try-catch blocks
   */
  static asyncHandler(
    handler: (req: Request, res: Response) => Promise<void>
  ) {
    return async (req: Request, res: Response, next: any) => {
      try {
        await handler(req, res);
      } catch (error: any) {
        logger.error("Controller error:", {
          error: error.message,
          stack: error.stack,
          method: req.method,
          url: req.originalUrl,
          userId: req.userId || "anonymous",
        });

        // Handle known error types
        if (error.message.includes("not found")) {
          ResponseUtil.notFound(res, error.message);
          return;
        }

        if (error.message.includes("Unauthorized") || error.message.includes("permission")) {
          ResponseUtil.forbidden(res, error.message);
          return;
        }

        if (error.message.includes("Invalid") || error.message.includes("required")) {
          ResponseUtil.badRequest(res, error.message);
          return;
        }

        // Default server error
        ResponseUtil.serverError(res, error.message || "An unexpected error occurred");
      }
    };
  }

  /**
   * Extract pagination parameters from request
   */
  static getPagination(req: Request): { page: number; limit: number; skip: number } {
    const { page, limit } = ValidationUtil.validatePagination(
      req.query.page as string,
      req.query.limit as string
    );
    const skip = (page - 1) * limit;
    return { page, limit, skip };
  }

  /**
   * Get authenticated user ID (with validation)
   */
  static getUserId(req: Request, res: Response): string | null {
    if (!req.userId) {
      ResponseUtil.unauthorized(res);
      return null;
    }
    return req.userId;
  }

  /**
   * Check if user is authenticated
   */
  static requireAuth(req: Request, res: Response): boolean {
    return ValidationUtil.validateAuthentication(res, req.userId);
  }

  /**
   * Check if user is admin
   */
  static requireAdmin(req: Request, res: Response): boolean {
    if (!this.requireAuth(req, res)) {
      return false;
    }

    const userRole = req.userRole || (req.user as any)?.role;
    if (userRole !== "admin") {
      ResponseUtil.forbidden(res, "Admin access required");
      return false;
    }

    return true;
  }

  /**
   * Validate and convert ObjectId
   */
  static validateAndConvertObjectId(
    res: Response,
    id: string | undefined,
    fieldName: string = "ID"
  ): Types.ObjectId | null {
    if (!ValidationUtil.validateObjectId(res, id, fieldName)) {
      return null;
    }
    return new Types.ObjectId(id!);
  }

  /**
   * Check resource ownership
   */
  static async checkOwnership(
    res: Response,
    resourceUserId: string | Types.ObjectId,
    currentUserId: string,
    resourceName: string = "resource"
  ): Promise<boolean> {
    const resourceUserIdString = resourceUserId instanceof Types.ObjectId
      ? resourceUserId.toString()
      : resourceUserId;

    if (resourceUserIdString !== currentUserId) {
      ResponseUtil.forbidden(res, `You can only modify your own ${resourceName}`);
      return false;
    }

    return true;
  }

  /**
   * Handle service errors consistently
   */
  static handleServiceError(res: Response, error: any, defaultMessage: string = "Operation failed"): void {
    logger.error("Service error:", error);

    if (error.message) {
      // Check for common error patterns
      if (error.message.includes("not found")) {
        ResponseUtil.notFound(res, error.message);
        return;
      }

      if (error.message.includes("already exists") || error.message.includes("already")) {
        ResponseUtil.badRequest(res, error.message);
        return;
      }

      if (error.message.includes("permission") || error.message.includes("unauthorized")) {
        ResponseUtil.forbidden(res, error.message);
        return;
      }

      if (error.message.includes("Invalid") || error.message.includes("required")) {
        ResponseUtil.badRequest(res, error.message);
        return;
      }
    }

    ResponseUtil.serverError(res, defaultMessage);
  }

  /**
   * Build paginated response
   */
  static paginatedResponse<T>(
    res: Response,
    data: T[],
    total: number,
    page: number,
    limit: number,
    message?: string
  ): void {
    ResponseUtil.paginated(res, data, { page, limit, total }, message);
  }

  /**
   * Extract query parameters with defaults
   */
  static getQueryParam<T>(
    req: Request,
    key: string,
    defaultValue: T,
    parser?: (value: any) => T
  ): T {
    const value = req.query[key];
    
    if (value === undefined || value === null) {
      return defaultValue;
    }

    if (parser) {
      return parser(value);
    }

    return value as T;
  }

  /**
   * Extract body parameter with validation
   */
  static getBodyParam<T>(
    res: Response,
    req: Request,
    key: string,
    required: boolean = false,
    defaultValue?: T,
    validator?: (value: any) => { valid: boolean; message?: string }
  ): T | undefined {
    const value = req.body[key];

    if (value === undefined || value === null) {
      if (required) {
        ResponseUtil.badRequest(res, `${key} is required`);
        return undefined;
      }
      return defaultValue;
    }

    if (validator) {
      const result = validator(value);
      if (!result.valid) {
        ResponseUtil.badRequest(res, result.message || `Invalid ${key}`);
        return undefined;
      }
    }

    return value as T;
  }
}

export default ControllerUtil;


