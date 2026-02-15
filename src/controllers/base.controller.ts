import { Request, Response } from "express";
import { Types, Model } from "mongoose";
import ResponseUtil from "../utils/response.util";
import ValidationUtil from "../utils/validation.util";
import ControllerUtil from "../utils/controller.util";
import QueryUtil from "../utils/query.util";
import logger from "../utils/logger";

/**
 * Base Controller Class
 * Provides common controller methods to reduce code duplication
 * Implements DRY principles
 */
export class BaseController {
  /**
   * Generic CRUD operations that can be reused
   */

  /**
   * Get list of resources with pagination
   */
  protected static async getList<T>(
    req: Request,
    res: Response,
    model: Model<T>,
    options: {
      filters?: any;
      populate?: string | any[];
      select?: string;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
      searchFields?: string[];
      searchTerm?: string;
      defaultSort?: Record<string, 1 | -1>;
    } = {}
  ): Promise<void> {
    try {
      const { page, limit, skip } = ControllerUtil.getPagination(req);
      const {
        filters = {},
        populate,
        select,
        sortBy = "createdAt",
        sortOrder = "desc",
        searchFields = [],
        searchTerm = req.query.search as string,
        defaultSort = { createdAt: -1 },
      } = options;

      // Build query
      const queryFilters: any = { ...filters };

      // Add text search if provided
      if (searchTerm && searchFields.length > 0) {
        const searchQuery = QueryUtil.buildTextSearch(searchTerm, searchFields);
        Object.assign(queryFilters, searchQuery);
      }

      // Build sort
      const sort = sortBy ? QueryUtil.buildSort(sortBy, sortOrder) : defaultSort;

      // Execute paginated query
      const result = await QueryUtil.executePaginatedQuery(model, queryFilters, {
        skip,
        limit,
        sort,
        populate,
        select,
      });

      ResponseUtil.paginated(res, result.data, result, "Data retrieved successfully");
    } catch (error: any) {
      ControllerUtil.handleServiceError(res, error, "Failed to retrieve data");
    }
  }

  /**
   * Get single resource by ID
   */
  protected static async getById<T>(
    req: Request,
    res: Response,
    model: Model<T>,
    options: {
      idParam?: string;
      populate?: string | any[];
      select?: string;
      notFoundMessage?: string;
    } = {}
  ): Promise<void> {
    try {
      const {
        idParam = "id",
        populate,
        select,
        notFoundMessage = "Resource not found",
      } = options;

      const id = ControllerUtil.validateAndConvertObjectId(res, req.params[idParam]);
      if (!id) return;

      const query: any = model.findById(id);
      if (select) query.select(select);
      if (populate) query.populate(populate);

      const resource = await query;

      if (!resource) {
        ResponseUtil.notFound(res, notFoundMessage);
        return;
      }

      ResponseUtil.success(res, resource, "Resource retrieved successfully");
    } catch (error: any) {
      ControllerUtil.handleServiceError(res, error, "Failed to retrieve resource");
    }
  }

  /**
   * Create resource
   */
  protected static async create<T>(
    req: Request,
    res: Response,
    model: Model<T>,
    options: {
      data?: Partial<T>;
      beforeSave?: (data: Partial<T>) => Promise<Partial<T>>;
      afterSave?: (resource: T) => Promise<void>;
      populate?: string | any[];
      successMessage?: string;
    } = {}
  ): Promise<void> {
    try {
      const {
        data = req.body,
        beforeSave,
        afterSave,
        populate,
        successMessage = "Resource created successfully",
      } = options;

      let resourceData = { ...data };

      // Run before save hook
      if (beforeSave) {
        resourceData = await beforeSave(resourceData);
      }

      // Create resource
      const resource = await model.create([resourceData]);

      // Populate if needed
      let populatedResource: any = resource[0];
      if (populate) {
        populatedResource = await model.findById(resource[0]._id).populate(populate);
      }

      // Run after save hook
      if (afterSave) {
        await afterSave(populatedResource);
      }

      ResponseUtil.created(res, populatedResource, successMessage);
    } catch (error: any) {
      ControllerUtil.handleServiceError(res, error, "Failed to create resource");
    }
  }

  /**
   * Update resource
   */
  protected static async update<T>(
    req: Request,
    res: Response,
    model: Model<T>,
    options: {
      idParam?: string;
      data?: Partial<T>;
      beforeUpdate?: (existing: T, updates: Partial<T>) => Promise<Partial<T>>;
      afterUpdate?: (resource: T) => Promise<void>;
      populate?: string | any[];
      checkOwnership?: {
        userIdField: string;
        userId: string;
      };
      notFoundMessage?: string;
      successMessage?: string;
    } = {}
  ): Promise<void> {
    try {
      const {
        idParam = "id",
        data = req.body,
        beforeUpdate,
        afterUpdate,
        populate,
        checkOwnership,
        notFoundMessage = "Resource not found",
        successMessage = "Resource updated successfully",
      } = options;

      const id = ControllerUtil.validateAndConvertObjectId(res, req.params[idParam]);
      if (!id) return;

      // Find existing resource
      const existing = await model.findById(id);
      if (!existing) {
        ResponseUtil.notFound(res, notFoundMessage);
        return;
      }

      // Check ownership if specified
      if (checkOwnership) {
        const existingUserId = (existing as any)[checkOwnership.userIdField]?.toString();
        if (!(await ControllerUtil.checkOwnership(res, existingUserId, checkOwnership.userId, "resource"))) {
          return;
        }
      }

      // Prepare update data
      let updateData = { ...data };

      // Run before update hook
      if (beforeUpdate) {
        updateData = await beforeUpdate(existing, updateData);
      }

      // Update resource
      const updated = await model.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      });

      if (!updated) {
        ResponseUtil.notFound(res, notFoundMessage);
        return;
      }

      // Populate if needed
      let populatedResource: any = updated;
      if (populate) {
        populatedResource = await model.findById(id).populate(populate);
      }

      // Run after update hook
      if (afterUpdate) {
        await afterUpdate(populatedResource);
      }

      ResponseUtil.success(res, populatedResource, successMessage);
    } catch (error: any) {
      ControllerUtil.handleServiceError(res, error, "Failed to update resource");
    }
  }

  /**
   * Delete resource
   */
  protected static async delete<T>(
    req: Request,
    res: Response,
    model: Model<T>,
    options: {
      idParam?: string;
      checkOwnership?: {
        userIdField: string;
        userId: string;
      };
      softDelete?: boolean;
      beforeDelete?: (resource: T) => Promise<void>;
      afterDelete?: (resource: T) => Promise<void>;
      notFoundMessage?: string;
      successMessage?: string;
    } = {}
  ): Promise<void> {
    try {
      const {
        idParam = "id",
        checkOwnership,
        softDelete = false,
        beforeDelete,
        afterDelete,
        notFoundMessage = "Resource not found",
        successMessage = "Resource deleted successfully",
      } = options;

      const id = ControllerUtil.validateAndConvertObjectId(res, req.params[idParam]);
      if (!id) return;

      // Find resource
      const resource = await model.findById(id);
      if (!resource) {
        ResponseUtil.notFound(res, notFoundMessage);
        return;
      }

      // Check ownership if specified
      if (checkOwnership) {
        const resourceUserId = (resource as any)[checkOwnership.userIdField]?.toString();
        if (!(await ControllerUtil.checkOwnership(res, resourceUserId, checkOwnership.userId, "resource"))) {
          return;
        }
      }

      // Run before delete hook
      if (beforeDelete) {
        await beforeDelete(resource);
      }

      // Delete or soft delete
      if (softDelete) {
        await model.findByIdAndUpdate(id, { isDeleted: true, deletedAt: new Date() });
      } else {
        await model.findByIdAndDelete(id);
      }

      // Run after delete hook
      if (afterDelete) {
        await afterDelete(resource);
      }

      ResponseUtil.success(res, undefined, successMessage);
    } catch (error: any) {
      ControllerUtil.handleServiceError(res, error, "Failed to delete resource");
    }
  }
}

export default BaseController;


