/**
 * Domain error hierarchy.
 * Services throw these; the global error handler is the single point
 * that translates them into HTTP responses (Stage 1 convention).
 */
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;

  constructor(
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

/** 400 — malformed input (should normally be caught by Zod first). */
export class BadRequestError extends AppError {
  readonly statusCode = 400;
  readonly code = 'BAD_REQUEST';
}

/** 401 — missing or invalid credentials/token. */
export class UnauthorizedError extends AppError {
  readonly statusCode = 401;
  readonly code = 'UNAUTHORIZED';
}

/** 403 — authenticated but not allowed (role-based authorization). */
export class ForbiddenError extends AppError {
  readonly statusCode = 403;
  readonly code = 'FORBIDDEN';
}

/** 404 — resource does not exist (or is soft-deleted). */
export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = 'NOT_FOUND';
}

/** 409 — state conflict (e.g. vehicle not AVAILABLE, duplicate email). */
export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly code = 'CONFLICT';
}

/** 422 — business rule violation (RN-1..RN-22). */
export class BusinessRuleError extends AppError {
  readonly statusCode = 422;
  readonly code = 'BUSINESS_RULE_VIOLATION';

  constructor(
    message: string,
    /** Rule identifier from the functional document, e.g. "RN-5". */
    readonly rule?: string,
    details?: unknown,
  ) {
    super(message, details);
  }
}
