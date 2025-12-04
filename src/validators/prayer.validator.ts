/**
 * Prayer Validation Utility
 * Validates prayer request data according to the Post a Prayer specification
 */

export interface PrayerValidationResult {
  valid: boolean;
  errors: string[];
  details?: {
    field?: string;
    message?: string;
    [key: string]: any;
  };
}

export interface PrayerData {
  prayerText?: string;
  content?: string; // For backward compatibility
  verse?: {
    text?: string;
    reference?: string;
  } | null;
  color?: string;
  shape?: string;
  anonymous?: boolean;
  media?: string[];
}

const VALID_SHAPES = ["rectangle", "circle", "scalloped", "square", "square2", "square3", "square4"];
const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

/**
 * Validate prayer data for creation
 */
export function validatePrayerData(data: PrayerData): PrayerValidationResult {
  const errors: string[] = [];
  const details: any = {};

  // Prayer text validation (required)
  const prayerText = data.prayerText || data.content; // Support both fields
  if (!prayerText) {
    errors.push("Prayer text is required");
    details.prayerText = "This field is required";
  } else {
    const trimmed = typeof prayerText === "string" ? prayerText.trim() : "";
    if (trimmed.length === 0) {
      errors.push("Prayer text cannot be empty");
      details.prayerText = "Prayer text cannot be empty";
    } else if (trimmed.length > 2000) {
      errors.push("Prayer text must be less than 2000 characters");
      details.prayerText = `Current length: ${trimmed.length}, Maximum: 2000`;
    }
  }

  // Color validation (required)
  if (!data.color) {
    errors.push("Color is required");
    details.color = "This field is required";
  } else if (!HEX_COLOR_REGEX.test(data.color)) {
    errors.push("Valid color is required. Must be a hex color code (e.g., #A16CE5)");
    details.color = "Invalid format. Expected: #RRGGBB or #RGB";
  }

  // Shape validation (required)
  if (!data.shape) {
    errors.push("Shape is required");
    details.shape = "This field is required";
  } else if (!VALID_SHAPES.includes(data.shape)) {
    errors.push(`Valid shape is required. Must be one of: ${VALID_SHAPES.join(", ")}`);
    details.shape = `Invalid value: ${data.shape}`;
  }

  // Verse validation (optional, but if provided must have at least one field)
  if (data.verse !== undefined && data.verse !== null) {
    if (typeof data.verse !== "object" || Array.isArray(data.verse)) {
      errors.push("Verse must be an object");
      details.verse = "Invalid type";
    } else {
      const verseText = data.verse.text?.trim() || null;
      const verseReference = data.verse.reference?.trim() || null;

      if (!verseText && !verseReference) {
        errors.push("If verse is provided, at least text or reference must be included");
        details.verse = "At least one field required";
      }

      if (verseText && verseText.length > 500) {
        errors.push("Verse text must be less than 500 characters");
        details.verseText = `Current length: ${verseText.length}, Maximum: 500`;
      }

      if (verseReference && verseReference.length > 50) {
        errors.push("Verse reference must be less than 50 characters");
        details.verseReference = `Current length: ${verseReference.length}, Maximum: 50`;
      }
    }
  }

  // Anonymous validation (optional boolean)
  if (data.anonymous !== undefined && typeof data.anonymous !== "boolean") {
    errors.push("Anonymous must be a boolean value");
    details.anonymous = "Invalid type";
  }

  return {
    valid: errors.length === 0,
    errors,
    details: errors.length > 0 ? details : undefined,
  };
}

/**
 * Validate prayer update data (all fields optional)
 */
export function validatePrayerUpdateData(data: Partial<PrayerData>): PrayerValidationResult {
  const errors: string[] = [];
  const details: any = {};

  // Prayer text validation (optional in update, but if provided must be valid)
  if (data.prayerText !== undefined || data.content !== undefined) {
    const prayerText = data.prayerText || data.content;
    if (!prayerText) {
      errors.push("Prayer text cannot be empty");
      details.prayerText = "Prayer text cannot be empty";
    } else {
      const trimmed = typeof prayerText === "string" ? prayerText.trim() : "";
      if (trimmed.length === 0) {
        errors.push("Prayer text cannot be empty");
        details.prayerText = "Prayer text cannot be empty";
      } else if (trimmed.length > 2000) {
        errors.push("Prayer text must be less than 2000 characters");
        details.prayerText = `Current length: ${trimmed.length}, Maximum: 2000`;
      }
    }
  }

  // Color validation (optional in update, but if provided must be valid)
  if (data.color !== undefined) {
    if (!data.color) {
      errors.push("Color cannot be empty");
      details.color = "Color cannot be empty";
    } else if (!HEX_COLOR_REGEX.test(data.color)) {
      errors.push("Valid color is required. Must be a hex color code (e.g., #A16CE5)");
      details.color = "Invalid format. Expected: #RRGGBB or #RGB";
    }
  }

  // Shape validation (optional in update, but if provided must be valid)
  if (data.shape !== undefined) {
    if (!data.shape) {
      errors.push("Shape cannot be empty");
      details.shape = "Shape cannot be empty";
    } else if (!VALID_SHAPES.includes(data.shape)) {
      errors.push(`Valid shape is required. Must be one of: ${VALID_SHAPES.join(", ")}`);
      details.shape = `Invalid value: ${data.shape}`;
    }
  }

  // Verse validation (optional in update)
  if (data.verse !== undefined) {
    if (data.verse === null) {
      // Null is allowed to remove verse
    } else if (typeof data.verse !== "object" || Array.isArray(data.verse)) {
      errors.push("Verse must be an object or null");
      details.verse = "Invalid type";
    } else {
      const verseText = data.verse.text?.trim() || null;
      const verseReference = data.verse.reference?.trim() || null;

      if (!verseText && !verseReference) {
        errors.push("If verse is provided, at least text or reference must be included");
        details.verse = "At least one field required";
      }

      if (verseText && verseText.length > 500) {
        errors.push("Verse text must be less than 500 characters");
        details.verseText = `Current length: ${verseText.length}, Maximum: 500`;
      }

      if (verseReference && verseReference.length > 50) {
        errors.push("Verse reference must be less than 50 characters");
        details.verseReference = `Current length: ${verseReference.length}, Maximum: 50`;
      }
    }
  }

  // Anonymous validation (optional boolean)
  if (data.anonymous !== undefined && typeof data.anonymous !== "boolean") {
    errors.push("Anonymous must be a boolean value");
    details.anonymous = "Invalid type";
  }

  return {
    valid: errors.length === 0,
    errors,
    details: errors.length > 0 ? details : undefined,
  };
}

