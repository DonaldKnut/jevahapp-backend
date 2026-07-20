import mongoose, { Schema, Document } from "mongoose";

export interface IChurch {
  name: string;
  branchName?: string;
  denomination?: string;
  address?: string;
  state: string;
  lga?: string;
  location?: {
    lat: number;
    lng: number;
  };
  /** Public website (optional). */
  website?: string;
  /** Primary contact for outreach / admin email. */
  contactEmail?: string;
  contactPhone?: string;
  contactName?: string;
  /** How this church entered the catalog. */
  source?: "manual" | "outreach" | "bulk" | "import";
  /** Internal admin notes (not shown in public suggest). */
  adminNotes?: string;
  /**
   * When true, appears in onboarding / places suggest.
   * Defaults true so newly added churches are immediately selectable.
   */
  isListed?: boolean;
  createdByUser?: mongoose.Types.ObjectId;
  isVerified?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IChurchDocument extends IChurch, Document {}

const churchSchema = new Schema<IChurchDocument>(
  {
    name: { type: String, required: true },
    branchName: { type: String },
    denomination: { type: String },
    address: { type: String },
    state: { type: String, required: true },
    lga: { type: String },
    location: {
      lat: { type: Number },
      lng: { type: Number },
    },
    website: { type: String, trim: true },
    contactEmail: { type: String, trim: true, lowercase: true, index: true },
    contactPhone: { type: String, trim: true },
    contactName: { type: String, trim: true },
    source: {
      type: String,
      enum: ["manual", "outreach", "bulk", "import"],
      default: "manual",
    },
    adminNotes: { type: String, trim: true, maxlength: 2000 },
    isListed: { type: Boolean, default: true, index: true },
    createdByUser: { type: Schema.Types.ObjectId, ref: "User" },
    isVerified: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

churchSchema.index({ name: 1, state: 1 });
churchSchema.index({ name: "text", denomination: "text", address: "text" });

export const Church =
  mongoose.models.Church ||
  mongoose.model<IChurchDocument>("Church", churchSchema);
