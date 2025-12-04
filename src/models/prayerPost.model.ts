import mongoose, { Schema, Document } from "mongoose";

export interface IPrayerPost {
  content: string; // Keep for backward compatibility
  prayerText?: string; // Alias for content
  verse?: {
    text?: string | null;
    reference?: string | null;
  } | null;
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
    content: { type: String, required: true, trim: true, minlength: 1, maxlength: 2000 },
    prayerText: { 
      type: String, 
      trim: true, 
      minlength: 1, 
      maxlength: 2000 
    }, // Alias, will sync with content
    verse: {
      type: {
        text: { 
          type: String, 
          trim: true,
          maxlength: 500,
          default: null
        },
        reference: { 
          type: String, 
          trim: true,
          maxlength: 50,
          default: null
        },
      },
      default: null,
      _id: false
    },
    color: { 
      type: String, 
      required: true,
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
      required: true,
      default: "square",
      enum: ["rectangle", "circle", "scalloped", "square", "square2", "square3", "square4"]
    },
    anonymous: { type: Boolean, default: false },
    media: { type: [String], default: [] },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    likesCount: { type: Number, default: 0, min: 0 },
    commentsCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

// Sync prayerText with content and validate verse
prayerPostSchema.pre("save", function(next) {
  // Sync prayerText with content
  if (this.prayerText && !this.content) {
    this.content = this.prayerText;
  } else if (this.content && !this.prayerText) {
    this.prayerText = this.content;
  }
  
  // Validate verse: if verse object exists, at least one field must be present
  if (this.verse && !this.verse.text && !this.verse.reference) {
    return next(new Error("If verse is provided, at least text or reference must be included"));
  }
  
  // If verse is empty, set to null
  if (this.verse && !this.verse.text && !this.verse.reference) {
    this.verse = null;
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



