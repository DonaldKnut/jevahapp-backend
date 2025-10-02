"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const rateLimiter_1 = require("../middleware/rateLimiter");
const places_controller_1 = require("../controllers/places.controller");
const router = express_1.default.Router();
// Public suggestions (rate limited)
router.get("/places/suggest", rateLimiter_1.apiRateLimiter, places_controller_1.suggestPlaces);
// Public church detail
router.get("/churches/:id", rateLimiter_1.apiRateLimiter, places_controller_1.getChurchById);
exports.default = router;
