import type { Response } from "express";

export type AuthErrorCode =
  | "VALIDATION_ERROR"
  | "WEAK_PASSWORD"
  | "EMAIL_TAKEN"
  | "REGISTRATION_DISABLED"
  | "BANNED"
  | "ALREADY_VERIFIED"
  | "INVALID_CODE"
  | "CODE_EXPIRED"
  | "RATE_LIMITED"
  | "EMAIL_NOT_VERIFIED"
  | "RESET_TOKEN_INVALID"
  | "AUTHENTICATION_REQUIRED";

export class AuthError extends Error {
  readonly code: AuthErrorCode;
  readonly status: number;
  readonly fields?: Record<string, string>;
  readonly extra?: Record<string, unknown>;

  constructor(
    code: AuthErrorCode,
    message: string,
    status: number,
    fields?: Record<string, string>,
    extra?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.status = status;
    this.fields = fields;
    this.extra = extra;
  }
}

export function validationError(
  message: string,
  fields: Record<string, string>
): AuthError {
  return new AuthError("VALIDATION_ERROR", message, 400, fields);
}

export function sendAuthError(res: Response, error: AuthError): Response {
  return res.status(error.status).json({
    success: false,
    code: error.code,
    message: error.message,
    ...(error.fields ? { fields: error.fields } : {}),
    ...(error.extra || {}),
  });
}

export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}
