import mongoose, { Schema, Document } from "mongoose";

type GroupVisibility = "public" | "private";

export interface IGroupMembership {
  userId: mongoose.Types.ObjectId;
  role: "admin" | "member"; // Admin role for owner, member for others
  joinedAt: Date;
}

export interface IGroup {
  name: string;
  description?: string;
  profileImageUrl?: string; // Group profile image URL
  visibility: GroupVisibility;
  ownerId: mongoose.Types.ObjectId;
  members: IGroupMembership[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IGroupDocument extends IGroup, Document {}

const groupSchema = new Schema<IGroupDocument>(
  {
    name: { 
      type: String, 
      required: true,
      minlength: 3,
      maxlength: 100,
    },
    description: { 
      type: String, 
      default: "",
      maxlength: 500,
    },
    profileImageUrl: { type: String },
    visibility: { 
      type: String, 
      enum: ["public", "private"], 
      default: "public" 
    },
    ownerId: { 
      type: Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },
    members: [
      {
        userId: { 
          type: Schema.Types.ObjectId, 
          ref: "User", 
          required: true 
        },
        role: { 
          type: String, 
          enum: ["admin", "member"], 
          default: "member" 
        },
        joinedAt: { 
          type: Date, 
          default: Date.now 
        },
      },
    ],
  },
  { timestamps: true }
);

// Set owner as admin when member is added
groupSchema.pre("save", function(next) {
  if (this.isNew || this.isModified("members")) {
    this.members.forEach((member: any) => {
      if (String(member.userId) === String(this.ownerId)) {
        member.role = "admin";
      }
    });
  }
  next();
});

groupSchema.index({ name: 1 });
groupSchema.index({ visibility: 1 });
groupSchema.index({ ownerId: 1, createdAt: -1 });
groupSchema.index({ "members.userId": 1 });

export const Group =
  mongoose.models.Group || mongoose.model<IGroupDocument>("Group", groupSchema);



