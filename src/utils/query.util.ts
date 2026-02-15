import { Types, FilterQuery, Model } from "mongoose";

/**
 * Query Utility
 * Implements DRY principle for common database query patterns
 */

export interface PaginationOptions {
  page: number;
  limit: number;
  skip: number;
}

export interface SortOptions {
  sortBy: string;
  sortOrder: "asc" | "desc";
}

export class QueryUtil {
  /**
   * Build pagination query options
   */
  static buildPagination(page: number, limit: number): { skip: number; limit: number } {
    const skip = (page - 1) * limit;
    return { skip, limit };
  }

  /**
   * Build sort query options
   */
  static buildSort(sortBy: string, sortOrder: "asc" | "desc" = "asc"): Record<string, 1 | -1> {
    return { [sortBy]: sortOrder === "desc" ? -1 : 1 };
  }

  /**
   * Build search query for text fields
   */
  static buildTextSearch(searchTerm: string | undefined, fields: string[]): FilterQuery<any> {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return {};
    }

    return {
      $or: fields.map(field => ({
        [field]: { $regex: searchTerm.trim(), $options: "i" },
      })),
    };
  }

  /**
   * Build date range query
   */
  static buildDateRange(
    startDate?: Date | string,
    endDate?: Date | string,
    field: string = "createdAt"
  ): FilterQuery<any> {
    const query: FilterQuery<any> = {};

    if (startDate || endDate) {
      query[field] = {};
      if (startDate) {
        query[field].$gte = typeof startDate === "string" ? new Date(startDate) : startDate;
      }
      if (endDate) {
        query[field].$lte = typeof endDate === "string" ? new Date(endDate) : endDate;
      }
    }

    return query;
  }

  /**
   * Build array filter (in array)
   */
  static buildArrayFilter(value: string | string[] | undefined, field: string): FilterQuery<any> {
    if (!value) return {};

    const values = Array.isArray(value) ? value : [value];
    return { [field]: { $in: values } };
  }

  /**
   * Build combined query with pagination, sort, and filters
   */
  static buildQuery<T>(
    filters: FilterQuery<T> = {},
    pagination?: PaginationOptions,
    sort?: SortOptions
  ): {
    query: FilterQuery<T>;
    options: {
      skip?: number;
      limit?: number;
      sort?: Record<string, 1 | -1>;
    };
  } {
    const query: FilterQuery<T> = { ...filters };
    const options: any = {};

    if (pagination) {
      options.skip = pagination.skip;
      options.limit = pagination.limit;
    }

    if (sort) {
      options.sort = this.buildSort(sort.sortBy, sort.sortOrder);
    }

    return { query, options };
  }

  /**
   * Execute paginated query
   */
  static async executePaginatedQuery<T>(
    model: Model<T>,
    query: FilterQuery<T>,
    options: {
      skip?: number;
      limit?: number;
      sort?: Record<string, 1 | -1>;
      populate?: string | any[];
      select?: string;
    } = {}
  ): Promise<{
    data: T[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  }> {
    const { skip, limit, sort, populate, select } = options;

    const populateOptions = populate || [];
    let queryBuilder: any = model.find(query);
    
    if (select) {
      queryBuilder = queryBuilder.select(select);
    }
    
    if (populateOptions && populateOptions.length > 0) {
      queryBuilder = queryBuilder.populate(populateOptions);
    }
    
    const [data, total] = await Promise.all([
      queryBuilder
        .sort(sort || { createdAt: -1 })
        .skip(skip || 0)
        .limit(limit || 20),
      model.countDocuments(query),
    ]);

    const page = skip && limit ? Math.floor(skip / limit) + 1 : 1;
    const pages = limit ? Math.ceil(total / limit) : 1;

    return { data, total, page, limit: limit || 20, pages };
  }

  /**
   * Build user filter (for user-specific resources)
   */
  static buildUserFilter(userId: string, field: string = "userId"): FilterQuery<any> {
    return { [field]: new Types.ObjectId(userId) };
  }

  /**
   * Build active/visible filter
   */
  static buildActiveFilter(isActive: boolean = true, field: string = "isActive"): FilterQuery<any> {
    return { [field]: isActive };
  }

  /**
   * Build soft delete filter (exclude deleted)
   */
  static buildNotDeletedFilter(field: string = "isDeleted"): FilterQuery<any> {
    return { [field]: { $ne: true } };
  }

  /**
   * Combine multiple filters
   */
  static combineFilters<T>(...filters: FilterQuery<T>[]): FilterQuery<T> {
    return filters.reduce((combined, filter) => {
      return { ...combined, ...filter };
    }, {} as FilterQuery<T>);
  }
}

export default QueryUtil;

