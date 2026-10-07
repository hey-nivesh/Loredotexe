/**
 * Domain error definitions for Phase 4 Storyboard & Continuity Engine.
 */

import { AppError } from '../../errors/app-errors.js';

export class StoryboardValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 'STORYBOARD_VALIDATION_ERROR', 400, details);
  }
}

export class ContinuityValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 'CONTINUITY_VALIDATION_ERROR', 422, details);
  }
}

export class ScriptInputError extends AppError {
  constructor(message, details = null) {
    super(message, 'SCRIPT_INPUT_ERROR', 422, details);
  }
}

export class StoryboardNotFoundError extends AppError {
  constructor(message, details = null) {
    super(message, 'STORYBOARD_NOT_FOUND', 404, details);
  }
}
