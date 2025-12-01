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
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryUtil = void 0;
const mongoose_1 = require("mongoose");
class QueryUtil {
    /**
     * Build pagination query options
     */
    static buildPagination(page, limit) {
        const skip = (page - 1) * limit;
        return { skip, limit };
    }
    /**
     * Build sort query options
     */
    static buildSort(sortBy, sortOrder = "asc") {
        return { [sortBy]: sortOrder === "desc" ? -1 : 1 };
    }
    /**
     * Build search query for text fields
     */
    static buildTextSearch(searchTerm, fields) {
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
    static buildDateRange(startDate, endDate, field = "createdAt") {
        const query = {};
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
    static buildArrayFilter(value, field) {
        if (!value)
            return {};
        const values = Array.isArray(value) ? value : [value];
        return { [field]: { $in: values } };
    }
    /**
     * Build combined query with pagination, sort, and filters
     */
    static buildQuery(filters = {}, pagination, sort) {
        const query = Object.assign({}, filters);
        const options = {};
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
    static executePaginatedQuery(model_1, query_1) {
        return __awaiter(this, arguments, void 0, function* (model, query, options = {}) {
            const { skip, limit, sort, populate, select } = options;
            const populateOptions = populate || [];
            let queryBuilder = model.find(query);
            if (select) {
                queryBuilder = queryBuilder.select(select);
            }
            if (populateOptions && populateOptions.length > 0) {
                queryBuilder = queryBuilder.populate(populateOptions);
            }
            const [data, total] = yield Promise.all([
                queryBuilder
                    .sort(sort || { createdAt: -1 })
                    .skip(skip || 0)
                    .limit(limit || 20),
                model.countDocuments(query),
            ]);
            const page = skip && limit ? Math.floor(skip / limit) + 1 : 1;
            const pages = limit ? Math.ceil(total / limit) : 1;
            return { data, total, page, limit: limit || 20, pages };
        });
    }
    /**
     * Build user filter (for user-specific resources)
     */
    static buildUserFilter(userId, field = "userId") {
        return { [field]: new mongoose_1.Types.ObjectId(userId) };
    }
    /**
     * Build active/visible filter
     */
    static buildActiveFilter(isActive = true, field = "isActive") {
        return { [field]: isActive };
    }
    /**
     * Build soft delete filter (exclude deleted)
     */
    static buildNotDeletedFilter(field = "isDeleted") {
        return { [field]: { $ne: true } };
    }
    /**
     * Combine multiple filters
     */
    static combineFilters(...filters) {
        return filters.reduce((combined, filter) => {
            return Object.assign(Object.assign({}, combined), filter);
        }, {});
    }
}
exports.QueryUtil = QueryUtil;
exports.default = QueryUtil;
