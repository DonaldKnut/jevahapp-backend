import { Response } from "express";

/**
 * Standardized API Response Utility
 * Implements DRY principle for consistent API responses across all controllers
 */

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export class ResponseUtil {
  /**
   * Send success response
   */
  static success<T>(
    res: Response,
    data?: T,
    message: string = "Operation successful",
    statusCode: number = 200
  ): void {
    const response: ApiResponse<T> = {
      success: true,
      message,
      ...(data !== undefined && { data }),
    };
    res.status(statusCode).json(response);
  }

  /**
   * Send error response
   */
  static error(
    res: Response,
    message: string = "An error occurred",
    statusCode: number = 500,
    error?: string
  ): void {
    const response: ApiResponse = {
      success: false,
      message,
      ...(error && { error }),
    };
    res.status(statusCode).json(response);
  }

  /**
   * Send unauthorized response
   */
  static unauthorized(res: Response, message: string = "Unauthorized: User not authenticated"): void {
    this.error(res, message, 401);
  }

  /**
   * Send forbidden response
   */
  static forbidden(res: Response, message: string = "Forbidden: You don't have permission to perform this action"): void {
    this.error(res, message, 403);
  }

  /**
   * Send not found response
   */
  static notFound(res: Response, message: string = "Resource not found"): void {
    this.error(res, message, 404);
  }

  /**
   * Send bad request response
   */
  static badRequest(res: Response, message: string = "Bad request", error?: string): void {
    this.error(res, message, 400, error);
  }

  /**
   * Send created response
   */
  static created<T>(res: Response, data: T, message: string = "Resource created successfully"): void {
    this.success(res, data, message, 201);
  }

  /**
   * Send paginated response
   */
  static paginated<T>(
    res: Response,
    data: T[],
    pagination: {
      page: number;
      limit: number;
      total: number;
    },
    message: string = "Data retrieved successfully"
  ): void {
    const response: ApiResponse<T[]> = {
      success: true,
      message,
      data,
      pagination: {
        ...pagination,
        pages: Math.ceil(pagination.total / pagination.limit),
      },
    };
    res.status(200).json(response);
  }

  /**
   * Send validation error response
   */
  static validationError(res: Response, message: string, errors?: Record<string, string[]>): void {
    const response: ApiResponse = {
      success: false,
      message,
      ...(errors && { error: "Validation failed", data: { errors } }),
    };
    res.status(400).json(response);
  }

  /**
   * Send server error response
   */
  static serverError(res: Response, message: string = "Internal server error"): void {
    this.error(res, message, 500);
  }
}

export default ResponseUtil;


