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
exports.suggestPlaces = suggestPlaces;
exports.getChurchById = getChurchById;
const places_service_1 = __importDefault(require("../service/places.service"));
const logger_1 = __importDefault(require("../utils/logger"));
function suggestPlaces(request, response) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const q = String(request.query.q || "").trim();
            if (q.length < 2) {
                response
                    .status(400)
                    .json({ success: false, message: "q must be at least 2 characters" });
                return;
            }
            const limit = Math.min(parseInt(String(request.query.limit || "10"), 10) || 10, 20);
            const radius = parseInt(String(request.query.radius || "50000"), 10) || 50000;
            const sourceParam = String(request.query.source || "combined");
            const source = sourceParam === "internal" || sourceParam === "mapbox"
                ? sourceParam
                : "combined";
            const churchId = request.query.churchId
                ? String(request.query.churchId)
                : null;
            const country = request.query.country
                ? String(request.query.country).toUpperCase()
                : null;
            let near = null;
            if (request.query.near) {
                const parts = String(request.query.near).split(",");
                if (parts.length === 2) {
                    const lat = parseFloat(parts[0]);
                    const lng = parseFloat(parts[1]);
                    if (isFinite(lat) && isFinite(lng)) {
                        near = { lat, lng };
                    }
                }
            }
            const { results } = yield places_service_1.default.suggest({
                q,
                near,
                radius,
                limit,
                source,
                country,
                churchId,
            });
            response.status(200).json({ success: true, source, results });
            return;
        }
        catch (error) {
            logger_1.default.error("places.suggest failed", { error: error === null || error === void 0 ? void 0 : error.message });
            response
                .status(500)
                .json({ success: false, message: "Internal server error" });
            return;
        }
    });
}
function getChurchById(request, response) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id } = request.params;
            const data = yield places_service_1.default.getChurchWithBranches(id);
            if (!data) {
                response
                    .status(404)
                    .json({ success: false, message: "Church not found" });
                return;
            }
            const { church, branches } = data;
            response
                .status(200)
                .json({ success: true, church: Object.assign(Object.assign({}, church.toObject()), { branches }) });
            return;
        }
        catch (error) {
            response
                .status(500)
                .json({ success: false, message: "Internal server error" });
            return;
        }
    });
}
