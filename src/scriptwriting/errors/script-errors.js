/**
 * Domain error definitions for Phase 3 Scriptwriting.
 */

import { AppError } from '../../errors/app-errors.js';

export class ScriptValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 'SCRIPT_VALIDATION_ERROR', 400, details);
  }
}

export class DossierIneligibleError extends AppError {
  constructor(message, details = null) {
    super(message, 'DOSSIER_INELIGIBLE_ERROR', 422, details);
  }
}

export class EditorialQaFailureError extends AppError {
  constructor(message, details = null) {
    super(message, 'EDITORIAL_QA_FAILURE', 422, details);
  }
}

export class FactualTraceabilityError extends AppError {
  constructor(message, details = null) {
    super(message, 'FACTUAL_TRACEABILITY_ERROR', 422, details);
  }
}

export class ScriptNotFoundError extends AppError {
  constructor(message, details = null) {
    super(message, 'SCRIPT_NOT_FOUND', 404, details);
  }
}
