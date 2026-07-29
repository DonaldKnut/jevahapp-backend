import mongoose, { Document, Schema } from "mongoose";

export interface IPlatformConfig extends Document {
  uploadsEnabled: boolean;
  registrationEnabled: boolean;
  liveStreamingEnabled: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  minAppVersion: {
    ios: string;
    android: string;
  };
  updatedAt: Date;
  updatedBy?: mongoose.Types.ObjectId;
}

const PlatformConfigSchema = new Schema<IPlatformConfig>(
  {
    uploadsEnabled: { type: Boolean, default: true },
    registrationEnabled: { type: Boolean, default: true },
    liveStreamingEnabled: { type: Boolean, default: true },
    maintenanceMode: { type: Boolean, default: false },
    maintenanceMessage: {
      type: String,
      default: "Jevah is briefly offline for maintenance. Back soon.",
    },
    minAppVersion: {
      ios: { type: String, default: "1.0.0" },
      android: { type: String, default: "1.0.0" },
    },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

/** Singleton document — always use getOrCreate, never create many */
export const PlatformConfig =
  mongoose.models.PlatformConfig ||
  mongoose.model<IPlatformConfig>("PlatformConfig", PlatformConfigSchema);
