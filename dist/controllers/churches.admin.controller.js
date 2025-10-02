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
exports.createChurch = createChurch;
exports.createBranch = createBranch;
exports.bulkUpsert = bulkUpsert;
exports.reindex = reindex;
const mongoose_1 = __importDefault(require("mongoose"));
const church_model_1 = require("../models/church.model");
const church_branch_model_1 = require("../models/church-branch.model");
const ngStates_1 = require("../constants/ngStates");
function createChurch(request, response) {
    return __awaiter(this, void 0, void 0, function* () {
        const { name, aliases, denomination, website, verified, popularityScore, address, state, lga, location, } = request.body || {};
        if (!name || !state) {
            response
                .status(400)
                .json({ success: false, message: "name and state are required" });
            return;
        }
        const doc = {
            name,
            denomination,
            address,
            state,
            lga,
            location,
            isVerified: Boolean(verified),
        };
        const created = yield church_model_1.Church.create(doc);
        response.status(201).json({ success: true, church: created });
        return;
    });
}
function createBranch(request, response) {
    return __awaiter(this, void 0, void 0, function* () {
        const { id } = request.params;
        if (!mongoose_1.default.isValidObjectId(id)) {
            response.status(400).json({ success: false, message: "invalid church id" });
            return;
        }
        const { name, code, address, state, lga, location, verified } = request.body || {};
        if (!name || !code || !state) {
            response
                .status(400)
                .json({ success: false, message: "name, code and state are required" });
            return;
        }
        const church = yield church_model_1.Church.findById(id);
        if (!church) {
            response.status(404).json({ success: false, message: "Church not found" });
            return;
        }
        const created = yield church_branch_model_1.ChurchBranch.create({
            churchId: church._id,
            name,
            code,
            address,
            state,
            lga,
            location,
            isVerified: Boolean(verified),
        });
        response.status(201).json({ success: true, branch: created });
        return;
    });
}
function bulkUpsert(request, response) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        const primary = Array.isArray((_a = request.body) === null || _a === void 0 ? void 0 : _a.churches)
            ? request.body.churches
            : [];
        const extras = Array.isArray((_b = request.body) === null || _b === void 0 ? void 0 : _b.moreChurches)
            ? request.body.moreChurches
            : [];
        const payload = [...primary, ...extras];
        if (payload.length === 0) {
            response.status(400).json({
                success: false,
                message: "Invalid bulk payload. Expected churches and/or moreChurches arrays",
            });
            return;
        }
        for (const c of payload) {
            const church = yield church_model_1.Church.findOneAndUpdate({ name: c.name, state: ((_d = (_c = c.branches) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.state) || c.state }, {
                name: c.name,
                denomination: c.denomination,
                address: ((_f = (_e = c.branches) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.addressLine1) || c.address,
                state: ((_h = (_g = c.branches) === null || _g === void 0 ? void 0 : _g[0]) === null || _h === void 0 ? void 0 : _h.state) || c.state,
                location: ((_k = (_j = c.branches) === null || _j === void 0 ? void 0 : _j[0]) === null || _k === void 0 ? void 0 : _k.location) || c.location,
                isVerified: Boolean(c.verified),
            }, { upsert: true, new: true });
            if (Array.isArray(c.branches)) {
                for (const b of c.branches) {
                    yield church_branch_model_1.ChurchBranch.findOneAndUpdate({
                        churchId: church._id,
                        name: b.name || b.city,
                    }, {
                        churchId: church._id,
                        name: b.name || b.city,
                        code: b.id ||
                            `${church._id}_${(b.name || b.city || "").replace(/\s+/g, "_").toLowerCase()}`,
                        address: b.addressLine1,
                        state: b.state || church.state,
                        location: b.location,
                        isVerified: Boolean((_l = b.verified) !== null && _l !== void 0 ? _l : c.verified),
                    }, { upsert: true, new: true });
                }
            }
            // Auto-generate state-wide branches if requested via flag
            if (request.query.generateStateBranches === "true") {
                for (const ns of ngStates_1.NG_STATES) {
                    // Skip if a branch already exists for this state
                    const existing = yield church_branch_model_1.ChurchBranch.findOne({
                        churchId: church._id,
                        state: ns.state,
                    });
                    if (existing)
                        continue;
                    const codeBase = `${church._id}_${ns.state.replace(/\s+/g, "_").toLowerCase()}`;
                    yield church_branch_model_1.ChurchBranch.findOneAndUpdate({ churchId: church._id, name: ns.capital }, {
                        churchId: church._id,
                        name: ns.capital,
                        code: codeBase,
                        address: ns.capital,
                        state: ns.state,
                        isVerified: Boolean(c.verified),
                    }, { upsert: true, new: true });
                }
            }
        }
        response.status(200).json({ success: true });
        return;
    });
}
function reindex(_request, response) {
    return __awaiter(this, void 0, void 0, function* () {
        // With Mongo, we rely on indexes. If we add Atlas Search later, trigger its pipelines here.
        response.status(200).json({ success: true, message: "Reindex queued" });
        return;
    });
}
