import { validationError } from "./authErrors";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizePersonName(
  value: unknown,
  field: "firstName" | "lastName"
): string {
  const name = String(value ?? "").trim();
  if (!name) {
    throw validationError("First name and last name are required.", {
      [field]: "This field is required.",
    });
  }
  if (name.length > 40) {
    throw validationError("Name must be 1–40 characters.", {
      [field]: "Must be 1–40 characters.",
    });
  }
  return name;
}

export function normalizeRegisterEmail(value: unknown): string {
  const email = String(value ?? "").trim();
  if (!email) {
    throw validationError("Email is required.", {
      email: "This field is required.",
    });
  }
  if (!EMAIL_RE.test(email)) {
    throw validationError("Please provide a valid email address.", {
      email: "Enter a valid email address.",
    });
  }
  return email.trim().toLowerCase();
}
