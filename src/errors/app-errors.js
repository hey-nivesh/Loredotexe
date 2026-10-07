/**
 * Application Error Hierarchy with stable error codes and retry classification.
 */

export class AppError extends Error {
  /**
   * @param {string} message - Sanitized error message
   * @param {string} code - Stable machine-readable error code
   * @param {number} statusCode - HTTP status code
   * @param {boolean} isTransient - Whether the error is retryable
   * @param {Record<string, unknown>} [details={}] - Additional sanitized context
   */
  constructor(message, code = 'INTERNAL_ERROR', statusCode = 500, isTransient = false, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isTransient = isTransient;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        statusCode: this.statusCode,
        isTransient: this.isTransient,
        details: this.details
      }
    };
  }
}

export class ValidationError extends AppError {
  constructor(message, details = {}) {
    super(message, 'VALIDATION_ERROR', 400, false, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message, details = {}) {
    super(message, 'NOT_FOUND', 404, false, details);
  }
}

export class InvalidStateTransitionError extends AppError {
  constructor(message, details = {}) {
    super(message, 'INVALID_STATE_TRANSITION', 409, false, details);
  }
}

export class VersionConflictError extends AppError {
  constructor(message, details = {}) {
    super(message, 'VERSION_CONFLICT', 409, false, details);
  }
}

export class IdempotencyConflictError extends AppError {
  constructor(message, details = {}) {
    super(message, 'IDEMPOTENCY_CONFLICT', 409, false, details);
  }
}

export class DatabaseError extends AppError {
  constructor(message, isTransient = true, details = {}) {
    super(message, 'DATABASE_ERROR', 500, isTransient, details);
  }
}

export class ConfigurationError extends AppError {
  constructor(message, details = {}) {
    super(message, 'CONFIGURATION_ERROR', 500, false, details);
  }
}
