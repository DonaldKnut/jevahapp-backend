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
exports.PlacesService = void 0;
const axios_1 = __importDefault(require("axios"));
const mongoose_1 = __importDefault(require("mongoose"));
const church_model_1 = require("../models/church.model");
const church_branch_model_1 = require("../models/church-branch.model");
function haversineMeters(a, b) {
    const R = 6371000; // meters
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;
    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const aa = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
    const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
    return R * c;
}
function proximityScore(distanceMeters, radiusMeters) {
    if (!isFinite(distanceMeters) || distanceMeters < 0)
        return 0;
    const d = Math.min(distanceMeters, radiusMeters);
    // Exponential decay inside radius
    const score = Math.exp(-3 * (d / Math.max(1, radiusMeters)));
    return Math.max(0, Math.min(1, score));
}
function textScore(name, q, aliases) {
    const nq = q.trim().toLowerCase();
    const n = (name || "").toLowerCase();
    if (n === nq)
        return 1;
    if (n.startsWith(nq))
        return 0.9;
    if (n.includes(nq))
        return 0.75;
    if (aliases && aliases.some(a => (a || "").toLowerCase().includes(nq)))
        return 0.7;
    // simple fuzzy: proportion of q chars that appear in order
    let idx = 0;
    for (const ch of n) {
        if (ch === nq[idx])
            idx += 1;
        if (idx === nq.length)
            break;
    }
    return (idx / Math.max(1, nq.length)) * 0.6;
}
function normalizeInternalBranch(branch, church, near, radius = 50000) {
    var _a, _b;
    const location = ((_a = branch === null || branch === void 0 ? void 0 : branch.location) === null || _a === void 0 ? void 0 : _a.lat) != null && ((_b = branch === null || branch === void 0 ? void 0 : branch.location) === null || _b === void 0 ? void 0 : _b.lng) != null
        ? { lat: branch.location.lat, lng: branch.location.lng }
        : null;
    const distance = near && location ? haversineMeters(near, location) : undefined;
    return {
        id: (branch._id || branch.id).toString(),
        type: "branch",
        name: branch.name,
        parentChurch: church
            ? { id: church._id.toString(), name: church.name }
            : undefined,
        address: {
            line1: branch.address,
            state: branch.state,
            // city/postal/country not in current schema
        },
        location: location || undefined,
        source: "internal",
        // base confidence will be set by caller; default minimal here
        confidence: 0.5,
        distanceMeters: distance,
        verified: Boolean(branch.isVerified),
    };
}
function normalizeInternalChurch(church, near, radius = 50000) {
    var _a, _b;
    const location = ((_a = church === null || church === void 0 ? void 0 : church.location) === null || _a === void 0 ? void 0 : _a.lat) != null && ((_b = church === null || church === void 0 ? void 0 : church.location) === null || _b === void 0 ? void 0 : _b.lng) != null
        ? { lat: church.location.lat, lng: church.location.lng }
        : null;
    const distance = near && location ? haversineMeters(near, location) : undefined;
    return {
        id: (church._id || church.id).toString(),
        type: "church",
        name: church.name,
        address: {
            line1: church.address,
            state: church.state,
        },
        location: location || undefined,
        source: "internal",
        confidence: 0.5,
        distanceMeters: distance,
        verified: Boolean(church.isVerified),
    };
}
function normalizeMapboxFeature(f, q, near, radius = 50000) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    const center = Array.isArray(f.center) && f.center.length === 2
        ? { lng: f.center[0], lat: f.center[1] }
        : null;
    const distance = near && center
        ? haversineMeters(near, { lat: center.lat, lng: center.lng })
        : undefined;
    const text = f.text || f.text_en || f.place_name || "";
    const ts = textScore(text, q);
    // Filter types/categories to church/place of worship
    const cats = ((_a = f.properties) === null || _a === void 0 ? void 0 : _a.category) || ((_b = f.properties) === null || _b === void 0 ? void 0 : _b.category_en) || "";
    const lcCats = String(cats).toLowerCase();
    const allowed = lcCats.includes("church") || lcCats.includes("place_of_worship");
    if (!allowed)
        return null;
    return {
        id: f.id,
        type: "branch",
        name: text,
        address: {
            line1: ((_c = f.properties) === null || _c === void 0 ? void 0 : _c.address) || f.address || undefined,
            city: (_e = (_d = f.context) === null || _d === void 0 ? void 0 : _d.find((c) => { var _a; return (_a = c.id) === null || _a === void 0 ? void 0 : _a.startsWith("place"); })) === null || _e === void 0 ? void 0 : _e.text,
            state: (_g = (_f = f.context) === null || _f === void 0 ? void 0 : _f.find((c) => { var _a; return (_a = c.id) === null || _a === void 0 ? void 0 : _a.startsWith("region"); })) === null || _g === void 0 ? void 0 : _g.text,
            postalCode: (_j = (_h = f.context) === null || _h === void 0 ? void 0 : _h.find((c) => { var _a; return (_a = c.id) === null || _a === void 0 ? void 0 : _a.startsWith("postcode"); })) === null || _j === void 0 ? void 0 : _j.text,
            countryCode: (_m = (_l = (_k = f.context) === null || _k === void 0 ? void 0 : _k.find((c) => { var _a; return (_a = c.id) === null || _a === void 0 ? void 0 : _a.startsWith("country"); })) === null || _l === void 0 ? void 0 : _l.short_code) === null || _m === void 0 ? void 0 : _m.toUpperCase(),
        },
        location: center ? { lat: center.lat, lng: center.lng } : undefined,
        source: "mapbox",
        confidence: ts,
        distanceMeters: distance,
        verified: false,
    };
}
function dedupeResults(results) {
    const seen = new Map();
    for (const r of results) {
        const key = `${r.name.toLowerCase()}|${r.address.line1 || ""}|${r.address.city || ""}|${r.address.state || ""}`;
        if (!seen.has(key)) {
            seen.set(key, r);
        }
        else {
            const existing = seen.get(key);
            // prefer internal over mapbox, or higher confidence
            if ((existing.source === "mapbox" && r.source === "internal") ||
                r.confidence > existing.confidence) {
                seen.set(key, r);
            }
        }
    }
    return Array.from(seen.values());
}
class PlacesService {
    static suggest(params) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            const q = params.q.trim();
            if (q.length < 2) {
                return { source: params.source || "combined", results: [] };
            }
            const near = params.near || null;
            const radius = (_a = params.radius) !== null && _a !== void 0 ? _a : 50000;
            const limit = Math.min(Math.max((_b = params.limit) !== null && _b !== void 0 ? _b : 10, 1), 20);
            const source = params.source || "combined";
            const churchId = params.churchId || null;
            // Internal search
            const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
            const branchFilter = { $or: [{ name: re }, { address: re }] };
            if (churchId && mongoose_1.default.isValidObjectId(churchId)) {
                branchFilter.churchId = new mongoose_1.default.Types.ObjectId(churchId);
            }
            const [branches, churches] = yield Promise.all([
                church_branch_model_1.ChurchBranch.find(branchFilter).limit(50),
                church_model_1.Church.find({
                    $or: [{ name: re }, { branchName: re }, { address: re }],
                }).limit(30),
            ]);
            const churchMap = new Map();
            churches.forEach(c => churchMap.set(c._id.toString(), c));
            const internal = [];
            for (const b of branches) {
                const c = churchMap.get((_c = b.churchId) === null || _c === void 0 ? void 0 : _c.toString());
                const normalized = normalizeInternalBranch(b, c, near, radius);
                const ts = textScore(`${normalized.name} ${(c === null || c === void 0 ? void 0 : c.name) || ""}`, q);
                const ps = near && normalized.location
                    ? proximityScore(normalized.distanceMeters || 0, radius)
                    : 0;
                const verifiedBoost = normalized.verified ? 0.15 : 0;
                normalized.confidence = 0.6 * ts + 0.3 * ps + 0.1 * verifiedBoost;
                internal.push(normalized);
            }
            for (const c of churches) {
                const normalized = normalizeInternalChurch(c, near, radius);
                const ts = textScore(normalized.name, q);
                const ps = near && normalized.location
                    ? proximityScore(normalized.distanceMeters || 0, radius)
                    : 0;
                const verifiedBoost = normalized.verified ? 0.15 : 0;
                normalized.confidence = 0.6 * ts + 0.3 * ps + 0.1 * verifiedBoost;
                internal.push(normalized);
            }
            let results = internal;
            // If combined/mapbox and not enough, fetch Mapbox
            if ((source === "combined" || source === "mapbox") &&
                internal.length < limit) {
                const remaining = limit - internal.length;
                const mapboxToken = process.env.MAPBOX_TOKEN;
                if (mapboxToken) {
                    try {
                        const paramsObj = {
                            access_token: mapboxToken,
                            limit: Math.min(remaining, 10),
                            types: "poi",
                        };
                        if (near)
                            paramsObj.proximity = `${near.lng},${near.lat}`;
                        if (params.country)
                            paramsObj.country = params.country;
                        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json`;
                        const resp = yield axios_1.default.get(url, {
                            params: paramsObj,
                            timeout: 7000,
                        });
                        const features = ((_d = resp.data) === null || _d === void 0 ? void 0 : _d.features) || [];
                        const normalized = features
                            .map(f => normalizeMapboxFeature(f, q, near, radius))
                            .filter((v) => Boolean(v));
                        results = results.concat(normalized);
                    }
                    catch (err) {
                        // swallow Mapbox errors, keep internal results
                    }
                }
            }
            // Dedupe and sort
            results = dedupeResults(results)
                .sort((a, b) => {
                // Prefer internal on ties, then higher confidence, then nearer
                if (a.confidence === b.confidence) {
                    if (a.source !== b.source)
                        return a.source === "internal" ? -1 : 1;
                    return ((a.distanceMeters || Infinity) - (b.distanceMeters || Infinity));
                }
                return b.confidence - a.confidence;
            })
                .slice(0, limit);
            return { source, results };
        });
    }
    static getChurchWithBranches(id) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!mongoose_1.default.isValidObjectId(id))
                return null;
            const church = yield church_model_1.Church.findById(id);
            if (!church)
                return null;
            const branches = yield church_branch_model_1.ChurchBranch.find({ churchId: church._id });
            return { church, branches };
        });
    }
}
exports.PlacesService = PlacesService;
exports.default = PlacesService;
