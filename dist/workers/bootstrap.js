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
exports.connectWorkerMongo = connectWorkerMongo;
const mongoose_1 = __importDefault(require("mongoose"));
const logger_1 = __importDefault(require("../utils/logger"));
const database_config_1 = require("../config/database.config");
let isConnected = false;
function connectWorkerMongo() {
    return __awaiter(this, void 0, void 0, function* () {
        if (isConnected)
            return;
        const uri = process.env.MONGODB_URI;
        if (!uri) {
            throw new Error("MONGODB_URI is required for worker process");
        }
        // Match server config (avoid buffering + reduce surprise memory usage)
        mongoose_1.default.set("bufferCommands", false);
        yield mongoose_1.default.connect(uri, database_config_1.mongooseConfig);
        isConnected = true;
        logger_1.default.info("✅ Worker MongoDB connected", {
            maxPoolSize: database_config_1.mongooseConfig.maxPoolSize,
            minPoolSize: database_config_1.mongooseConfig.minPoolSize,
        });
    });
}
