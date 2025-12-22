"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsQueue = exports.mediaProcessingQueue = exports.QUEUE_NAMES = void 0;
const bullmq_1 = require("bullmq");
const queueConnection_1 = require("./queueConnection");
exports.QUEUE_NAMES = {
    MEDIA_PROCESSING: "media-processing",
    ANALYTICS: "analytics",
};
const connection = (0, queueConnection_1.createBullConnection)();
exports.mediaProcessingQueue = new bullmq_1.Queue(exports.QUEUE_NAMES.MEDIA_PROCESSING, { connection });
exports.analyticsQueue = new bullmq_1.Queue(exports.QUEUE_NAMES.ANALYTICS, {
    connection,
});
