import { Types } from "mongoose";
import { Response } from "express";
import ResponseUtil from "./response.util";

/**
 * Validation Utility
 * Implements DRY principle for common validation patterns
 */

export class ValidationUtil {
  /**
   * Validate MongoDB ObjectId
   */
  static isValidObjectId(id: string | undefined | null): boolean {
    if (!id) return false;
    return Types.ObjectId.isValid(id);
  }

  /**
   * Validate MongoDB ObjectId and return error if invalid
   */
  static validateObjectId(res: Response, id: string | undefined | null, fieldName: string = "ID"): boolean {
    if (!this.isValidObjectId(id)) {
      ResponseUtil.badRequest(res, `Invalid ${fieldName}`);
      return false;
    }
    return true;
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate email and return error if invalid
   */
  static validateEmail(res: Response, email: string | undefined | null): boolean {
    if (!email || !this.isValidEmail(email)) {
      ResponseUtil.badRequest(res, "Please provide a valid email address");
      return false;
    }
    return true;
  }

  /**
   * Validate required field
   */
  static validateRequired<T>(
    res: Response,
    value: T | undefined | null,
    fieldName: string,
    customMessage?: string
  ): value is T {
    if (value === undefined || value === null || (typeof value === "string" && value.trim().length === 0)) {
      ResponseUtil.badRequest(
        res,
        customMessage || `${fieldName} is required`
      );
      return false;
    }
    return true;
  }

  /**
   * Validate string length
   */
  static validateLength(
    res: Response,
    value: string | undefined | null,
    fieldName: string,
    minLength?: number,
    maxLength?: number
  ): boolean {
    if (!value) {
      ResponseUtil.badRequest(res, `${fieldName} is required`);
      return false;
    }

    if (minLength !== undefined && value.length < minLength) {
      ResponseUtil.badRequest(res, `${fieldName} must be at least ${minLength} characters`);
      return false;
    }

    if (maxLength !== undefined && value.length > maxLength) {
      ResponseUtil.badRequest(res, `${fieldName} must be at most ${maxLength} characters`);
      return false;
    }

    return true;
  }

  /**
   * Validate number range
   */
  static validateNumberRange(
    res: Response,
    value: number | undefined | null,
    fieldName: string,
    min?: number,
    max?: number
  ): boolean {
    if (value === undefined || value === null || isNaN(value)) {
      ResponseUtil.badRequest(res, `${fieldName} must be a valid number`);
      return false;
    }

    if (min !== undefined && value < min) {
      ResponseUtil.badRequest(res, `${fieldName} must be at least ${min}`);
      return false;
    }

    if (max !== undefined && value > max) {
      ResponseUtil.badRequest(res, `${fieldName} must be at most ${max}`);
      return false;
    }

    return true;
  }

  /**
   * Validate array
   */
  static validateArray<T>(
    res: Response,
    value: T[] | undefined | null,
    fieldName: string,
    minItems?: number,
    maxItems?: number
  ): value is T[] {
    if (!Array.isArray(value)) {
      ResponseUtil.badRequest(res, `${fieldName} must be an array`);
      return false;
    }

    if (minItems !== undefined && value.length < minItems) {
      ResponseUtil.badRequest(res, `${fieldName} must contain at least ${minItems} items`);
      return false;
    }

    if (maxItems !== undefined && value.length > maxItems) {
      ResponseUtil.badRequest(res, `${fieldName} must contain at most ${maxItems} items`);
      return false;
    }

    return true;
  }

  /**
   * Validate enum value
   */
  static validateEnum<T extends string>(
    res: Response,
    value: string | undefined | null,
    fieldName: string,
    allowedValues: T[]
  ): value is T {
    if (!value) {
      ResponseUtil.badRequest(res, `${fieldName} is required`);
      return false;
    }

    if (!allowedValues.includes(value as T)) {
      ResponseUtil.badRequest(
        res,
        `Invalid ${fieldName}. Must be one of: ${allowedValues.join(", ")}`
      );
      return false;
    }

    return true;
  }

  /**
   * Validate pagination parameters
   */
  static validatePagination(
    page: string | number | undefined,
    limit: string | number | undefined
  ): { page: number; limit: number } {
    const pageNum = Math.max(1, parseInt(String(page || 1)) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit || 20)) || 20));
    return { page: pageNum, limit: limitNum };
  }

  /**
   * Validate user authentication
   */
  static validateAuthentication(res: Response, userId: string | undefined): userId is string {
    if (!userId) {
      ResponseUtil.unauthorized(res);
      return false;
    }
    return true;
  }

  /**
   * Validate multiple fields at once
   */
  static validateFields(
    res: Response,
    validations: Array<{
      value: any;
      fieldName: string;
      required?: boolean;
      type?: "string" | "number" | "array" | "object" | "email" | "objectId";
      minLength?: number;
      maxLength?: number;
      min?: number;
      max?: number;
      enumValues?: string[];
      customValidator?: (value: any) => { valid: boolean; message?: string };
    }>
  ): boolean {
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
              ResponseUtil.badRequest(res, `${fieldName} must be a string`);
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
              ResponseUtil.badRequest(res, `${fieldName} must be a number`);
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
              ResponseUtil.badRequest(res, `${fieldName} must be an object`);
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
        if (!this.validateEnum(res, value, fieldName, enumValues as any)) {
          return false;
        }
      }

      // Custom validator
      if (customValidator) {
        const result = customValidator(value);
        if (!result.valid) {
          ResponseUtil.badRequest(res, result.message || `Invalid ${fieldName}`);
          return false;
        }
      }
    }

    return true;
  }
}

export default ValidationUtil;


