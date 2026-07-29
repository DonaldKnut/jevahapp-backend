import mongoose, { Schema, Document } from "mongoose";

export interface IAdminEmailLog extends Document {
  adminId: mongoose.Types.ObjectId;
  subject: string;
  recipientCount: number;
  recipientsSample: string[];
  dryRun: boolean;
  sent: number;
  failed: number;
  meta?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const adminEmailLogSchema = new Schema<IAdminEmailLog>(
  {
    adminId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    subject: { type: String, required: true },
    recipientCount: { type: Number, default: 0 },
    recipientsSample: { type: [String], default: [] },
    dryRun: { type: Boolean, default: false },
    sent: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

adminEmailLogSchema.index({ createdAt: -1 });

export const AdminEmailLog =
  mongoose.models.AdminEmailLog ||
  mongoose.model<IAdminEmailLog>("AdminEmailLog", adminEmailLogSchema);
