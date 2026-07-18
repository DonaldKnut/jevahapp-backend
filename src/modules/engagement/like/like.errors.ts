export class LikeOperationError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly data: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    statusCode: number,
    data: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "LikeOperationError";
    this.code = code;
    this.statusCode = statusCode;
    this.data = data;
  }
}

export function isLikeOperationError(error: unknown): error is LikeOperationError {
  return error instanceof LikeOperationError;
}
