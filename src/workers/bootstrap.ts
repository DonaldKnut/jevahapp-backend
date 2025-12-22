import mongoose from "mongoose";
import logger from "../utils/logger";
import { mongooseConfig } from "../config/database.config";

let isConnected = false;

export async function connectWorkerMongo(): Promise<void> {
  if (isConnected) return;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is required for worker process");
  }

  // Match server config (avoid buffering + reduce surprise memory usage)
  mongoose.set("bufferCommands", false);

  await mongoose.connect(uri, mongooseConfig as any);
  isConnected = true;

  logger.info("✅ Worker MongoDB connected", {
    maxPoolSize: mongooseConfig.maxPoolSize,
    minPoolSize: mongooseConfig.minPoolSize,
  });
}

