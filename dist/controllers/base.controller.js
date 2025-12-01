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
exports.BaseController = void 0;
const response_util_1 = __importDefault(require("../utils/response.util"));
const controller_util_1 = __importDefault(require("../utils/controller.util"));
const query_util_1 = __importDefault(require("../utils/query.util"));
/**
 * Base Controller Class
 * Provides common controller methods to reduce code duplication
 * Implements DRY principles
 */
class BaseController {
    /**
     * Generic CRUD operations that can be reused
     */
    /**
     * Get list of resources with pagination
     */
    static getList(req_1, res_1, model_1) {
        return __awaiter(this, arguments, void 0, function* (req, res, model, options = {}) {
            try {
                const { page, limit, skip } = controller_util_1.default.getPagination(req);
                const { filters = {}, populate, select, sortBy = "createdAt", sortOrder = "desc", searchFields = [], searchTerm = req.query.search, defaultSort = { createdAt: -1 }, } = options;
                // Build query
                const queryFilters = Object.assign({}, filters);
                // Add text search if provided
                if (searchTerm && searchFields.length > 0) {
                    const searchQuery = query_util_1.default.buildTextSearch(searchTerm, searchFields);
                    Object.assign(queryFilters, searchQuery);
                }
                // Build sort
                const sort = sortBy ? query_util_1.default.buildSort(sortBy, sortOrder) : defaultSort;
                // Execute paginated query
                const result = yield query_util_1.default.executePaginatedQuery(model, queryFilters, {
                    skip,
                    limit,
                    sort,
                    populate,
                    select,
                });
                response_util_1.default.paginated(res, result.data, result, "Data retrieved successfully");
            }
            catch (error) {
                controller_util_1.default.handleServiceError(res, error, "Failed to retrieve data");
            }
        });
    }
    /**
     * Get single resource by ID
     */
    static getById(req_1, res_1, model_1) {
        return __awaiter(this, arguments, void 0, function* (req, res, model, options = {}) {
            try {
                const { idParam = "id", populate, select, notFoundMessage = "Resource not found", } = options;
                const id = controller_util_1.default.validateAndConvertObjectId(res, req.params[idParam]);
                if (!id)
                    return;
                const query = model.findById(id);
                if (select)
                    query.select(select);
                if (populate)
                    query.populate(populate);
                const resource = yield query;
                if (!resource) {
                    response_util_1.default.notFound(res, notFoundMessage);
                    return;
                }
                response_util_1.default.success(res, resource, "Resource retrieved successfully");
            }
            catch (error) {
                controller_util_1.default.handleServiceError(res, error, "Failed to retrieve resource");
            }
        });
    }
    /**
     * Create resource
     */
    static create(req_1, res_1, model_1) {
        return __awaiter(this, arguments, void 0, function* (req, res, model, options = {}) {
            try {
                const { data = req.body, beforeSave, afterSave, populate, successMessage = "Resource created successfully", } = options;
                let resourceData = Object.assign({}, data);
                // Run before save hook
                if (beforeSave) {
                    resourceData = yield beforeSave(resourceData);
                }
                // Create resource
                const resource = yield model.create([resourceData]);
                // Populate if needed
                let populatedResource = resource[0];
                if (populate) {
                    populatedResource = yield model.findById(resource[0]._id).populate(populate);
                }
                // Run after save hook
                if (afterSave) {
                    yield afterSave(populatedResource);
                }
                response_util_1.default.created(res, populatedResource, successMessage);
            }
            catch (error) {
                controller_util_1.default.handleServiceError(res, error, "Failed to create resource");
            }
        });
    }
    /**
     * Update resource
     */
    static update(req_1, res_1, model_1) {
        return __awaiter(this, arguments, void 0, function* (req, res, model, options = {}) {
            var _a;
            try {
                const { idParam = "id", data = req.body, beforeUpdate, afterUpdate, populate, checkOwnership, notFoundMessage = "Resource not found", successMessage = "Resource updated successfully", } = options;
                const id = controller_util_1.default.validateAndConvertObjectId(res, req.params[idParam]);
                if (!id)
                    return;
                // Find existing resource
                const existing = yield model.findById(id);
                if (!existing) {
                    response_util_1.default.notFound(res, notFoundMessage);
                    return;
                }
                // Check ownership if specified
                if (checkOwnership) {
                    const existingUserId = (_a = existing[checkOwnership.userIdField]) === null || _a === void 0 ? void 0 : _a.toString();
                    if (!(yield controller_util_1.default.checkOwnership(res, existingUserId, checkOwnership.userId, "resource"))) {
                        return;
                    }
                }
                // Prepare update data
                let updateData = Object.assign({}, data);
                // Run before update hook
                if (beforeUpdate) {
                    updateData = yield beforeUpdate(existing, updateData);
                }
                // Update resource
                const updated = yield model.findByIdAndUpdate(id, updateData, {
                    new: true,
                    runValidators: true,
                });
                if (!updated) {
                    response_util_1.default.notFound(res, notFoundMessage);
                    return;
                }
                // Populate if needed
                let populatedResource = updated;
                if (populate) {
                    populatedResource = yield model.findById(id).populate(populate);
                }
                // Run after update hook
                if (afterUpdate) {
                    yield afterUpdate(populatedResource);
                }
                response_util_1.default.success(res, populatedResource, successMessage);
            }
            catch (error) {
                controller_util_1.default.handleServiceError(res, error, "Failed to update resource");
            }
        });
    }
    /**
     * Delete resource
     */
    static delete(req_1, res_1, model_1) {
        return __awaiter(this, arguments, void 0, function* (req, res, model, options = {}) {
            var _a;
            try {
                const { idParam = "id", checkOwnership, softDelete = false, beforeDelete, afterDelete, notFoundMessage = "Resource not found", successMessage = "Resource deleted successfully", } = options;
                const id = controller_util_1.default.validateAndConvertObjectId(res, req.params[idParam]);
                if (!id)
                    return;
                // Find resource
                const resource = yield model.findById(id);
                if (!resource) {
                    response_util_1.default.notFound(res, notFoundMessage);
                    return;
                }
                // Check ownership if specified
                if (checkOwnership) {
                    const resourceUserId = (_a = resource[checkOwnership.userIdField]) === null || _a === void 0 ? void 0 : _a.toString();
                    if (!(yield controller_util_1.default.checkOwnership(res, resourceUserId, checkOwnership.userId, "resource"))) {
                        return;
                    }
                }
                // Run before delete hook
                if (beforeDelete) {
                    yield beforeDelete(resource);
                }
                // Delete or soft delete
                if (softDelete) {
                    yield model.findByIdAndUpdate(id, { isDeleted: true, deletedAt: new Date() });
                }
                else {
                    yield model.findByIdAndDelete(id);
                }
                // Run after delete hook
                if (afterDelete) {
                    yield afterDelete(resource);
                }
                response_util_1.default.success(res, undefined, successMessage);
            }
            catch (error) {
                controller_util_1.default.handleServiceError(res, error, "Failed to delete resource");
            }
        });
    }
}
exports.BaseController = BaseController;
exports.default = BaseController;
