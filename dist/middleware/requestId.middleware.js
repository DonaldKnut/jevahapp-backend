"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestIdMiddleware = requestIdMiddleware;
const crypto_1 = require("crypto");
/**
 * Attach a request ID to every request.
 * - Accepts upstream IDs (load balancer / CDN) if provided
 * - Adds `X-Request-Id` response header for client-side debugging
 */
function requestIdMiddleware(req, res, next) {
    const incoming = req.headers["x-request-id"] ||
        req.headers["cf-ray"] ||
        undefined;
    const requestId = incoming || (0, crypto_1.randomUUID)();
    req.requestId = requestId;
    res.setHeader("X-Request-Id", requestId);
    next();
}
