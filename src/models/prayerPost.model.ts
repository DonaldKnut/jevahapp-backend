import mongoose, { Schema, Document } from "mongoose";

export interface IPrayerPost {
  content: string; // Keep for backward compatibility
  prayerText?: string; // Alias for content
  verse?: {
    text: string;
    reference: string;
  };
  color?: string; // Hex color code (e.g., "#A16CE5")
  shape?: string; // "rectangle" | "circle" | "scalloped" | "square" | "square2" | "square3" | "square4"
  anonymous?: boolean;
  media?: string[];
  authorId: mongoose.Types.ObjectId;
  likesCount?: number; // Denormalized count
  commentsCount?: number; // Denormalized count
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IPrayerPostDocument extends IPrayerPost, Document {}

const prayerPostSchema = new Schema<IPrayerPostDocument>(
  {
    content: { type: String, required: true },
    prayerText: { type: String }, // Alias, will sync with content
    verse: {
      text: { type: String },
      reference: { type: String },
    },
    color: { 
      type: String, 
      default: "#A16CE5",
      validate: {
        validator: function(v: string) {
          return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v);
        },
        message: "Color must be a valid hex color code"
      }
    },
    shape: { 
      type: String, 
      default: "square",
      enum: ["rectangle", "circle", "scalloped", "square", "square2", "square3", "square4"]
    },
    anonymous: { type: Boolean, default: false },
    media: { type: [String], default: [] },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    likesCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Sync prayerText with content
prayerPostSchema.pre("save", function(next) {
  if (this.prayerText && !this.content) {
    this.content = this.prayerText;
  } else if (this.content && !this.prayerText) {
    this.prayerText = this.content;
  }
  next();
});

prayerPostSchema.index({ createdAt: -1 });
prayerPostSchema.index({ authorId: 1, createdAt: -1 });
prayerPostSchema.index({ "verse.reference": 1 });
prayerPostSchema.index({ content: "text", "verse.text": "text" }); // Text search index

export const PrayerPost =
  mongoose.models.PrayerPost ||
  mongoose.model<IPrayerPostDocument>("PrayerPost", prayerPostSchema);



