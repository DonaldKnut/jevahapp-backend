import mongoose, { Schema, Document } from "mongoose";

type GroupVisibility = "public" | "private";

export interface IGroupMembership {
  userId: mongoose.Types.ObjectId;
  joinedAt: Date;
}

export interface IGroup {
  name: string;
  description?: string;
  visibility: GroupVisibility;
  ownerId: mongoose.Types.ObjectId;
  members: IGroupMembership[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IGroupDocument extends IGroup, Document {}

const groupSchema = new Schema<IGroupDocument>(
  {
    name: { type: String, required: true },
    description: { type: String, default: "" },
    visibility: { type: String, enum: ["public", "private"], default: "public" },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    members: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

groupSchema.index({ name: 1 });
groupSchema.index({ visibility: 1 });
groupSchema.index({ ownerId: 1, createdAt: -1 });

export const Group =
  mongoose.models.Group || mongoose.model<IGroupDocument>("Group", groupSchema);



