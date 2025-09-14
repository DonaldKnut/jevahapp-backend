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
exports.createBibleFact = exports.getBibleFactsStats = exports.getDailyBibleFact = exports.searchBibleFactsByTags = exports.getBibleFactsByDifficulty = exports.getBibleFactsByCategory = exports.getPersonalizedBibleFact = exports.getRandomBibleFact = void 0;
const bibleFacts_service_1 = __importDefault(require("../service/bibleFacts.service"));
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Get a random Bible fact
 */
const getRandomBibleFact = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const fact = yield bibleFacts_service_1.default.getRandomBibleFact();
        if (fact) {
            response.status(200).json({
                success: true,
                data: fact,
            });
        }
        else {
            response.status(404).json({
                success: false,
                message: "No Bible facts found",
            });
        }
    }
    catch (error) {
        logger_1.default.error("Get random Bible fact error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to get Bible fact",
        });
    }
});
exports.getRandomBibleFact = getRandomBibleFact;
/**
 * Get personalized Bible fact for user
 */
const getPersonalizedBibleFact = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = request.userId;
        if (!userId) {
            response.status(401).json({
                success: false,
                message: "User ID not found",
            });
            return;
        }
        const personalizedFact = yield bibleFacts_service_1.default.getPersonalizedBibleFact(userId);
        if (personalizedFact) {
            response.status(200).json({
                success: true,
                data: personalizedFact,
            });
        }
        else {
            response.status(404).json({
                success: false,
                message: "No personalized Bible fact found",
            });
        }
    }
    catch (error) {
        logger_1.default.error("Get personalized Bible fact error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to get personalized Bible fact",
        });
    }
});
exports.getPersonalizedBibleFact = getPersonalizedBibleFact;
/**
 * Get Bible facts by category
 */
const getBibleFactsByCategory = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { category } = request.params;
        const { limit = 10 } = request.query;
        const facts = yield bibleFacts_service_1.default.getBibleFactsByCategories([category], parseInt(limit));
        response.status(200).json({
            success: true,
            data: facts,
            count: facts.length,
        });
    }
    catch (error) {
        logger_1.default.error("Get Bible facts by category error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to get Bible facts by category",
        });
    }
});
exports.getBibleFactsByCategory = getBibleFactsByCategory;
/**
 * Get Bible facts by difficulty
 */
const getBibleFactsByDifficulty = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { difficulty } = request.params;
        const { limit = 10 } = request.query;
        if (!["beginner", "intermediate", "advanced"].includes(difficulty)) {
            response.status(400).json({
                success: false,
                message: "Invalid difficulty level",
            });
            return;
        }
        const facts = yield bibleFacts_service_1.default.getBibleFactsByDifficulty(difficulty, parseInt(limit));
        response.status(200).json({
            success: true,
            data: facts,
            count: facts.length,
        });
    }
    catch (error) {
        logger_1.default.error("Get Bible facts by difficulty error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to get Bible facts by difficulty",
        });
    }
});
exports.getBibleFactsByDifficulty = getBibleFactsByDifficulty;
/**
 * Search Bible facts by tags
 */
const searchBibleFactsByTags = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { tags } = request.query;
        const { limit = 10 } = request.query;
        if (!tags || typeof tags !== "string") {
            response.status(400).json({
                success: false,
                message: "Tags parameter is required",
            });
            return;
        }
        const tagArray = tags.split(",").map(tag => tag.trim());
        const facts = yield bibleFacts_service_1.default.searchBibleFactsByTags(tagArray, parseInt(limit));
        response.status(200).json({
            success: true,
            data: facts,
            count: facts.length,
        });
    }
    catch (error) {
        logger_1.default.error("Search Bible facts by tags error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to search Bible facts",
        });
    }
});
exports.searchBibleFactsByTags = searchBibleFactsByTags;
/**
 * Get daily Bible fact
 */
const getDailyBibleFact = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const fact = yield bibleFacts_service_1.default.getDailyBibleFact();
        if (fact) {
            response.status(200).json({
                success: true,
                data: fact,
            });
        }
        else {
            response.status(404).json({
                success: false,
                message: "No daily Bible fact found",
            });
        }
    }
    catch (error) {
        logger_1.default.error("Get daily Bible fact error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to get daily Bible fact",
        });
    }
});
exports.getDailyBibleFact = getDailyBibleFact;
/**
 * Get Bible facts statistics (Admin only)
 */
const getBibleFactsStats = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const stats = yield bibleFacts_service_1.default.getBibleFactStats();
        response.status(200).json({
            success: true,
            data: stats,
        });
    }
    catch (error) {
        logger_1.default.error("Get Bible facts stats error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to get Bible facts statistics",
        });
    }
});
exports.getBibleFactsStats = getBibleFactsStats;
/**
 * Create a new Bible fact (Admin only)
 */
const createBibleFact = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { title, fact, scripture, category, tags, difficulty } = request.body;
        if (!title || !fact || !scripture || !category) {
            response.status(400).json({
                success: false,
                message: "Title, fact, scripture, and category are required",
            });
            return;
        }
        const bibleFact = yield bibleFacts_service_1.default.createBibleFact({
            title,
            fact,
            scripture,
            category,
            tags: tags || [],
            difficulty: difficulty || "beginner",
        });
        response.status(201).json({
            success: true,
            data: bibleFact,
            message: "Bible fact created successfully",
        });
    }
    catch (error) {
        logger_1.default.error("Create Bible fact error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to create Bible fact",
        });
    }
});
exports.createBibleFact = createBibleFact;
