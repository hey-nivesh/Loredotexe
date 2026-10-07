/**
 * Research Pipeline Error Types.
 */

import { AppError } from '../../errors/app-errors.js';

export class DiscoveryError extends AppError {
  constructor(message, details = {}) {
    super(message, 'DISCOVERY_ERROR', 502, true, details);
  }
}

export class SourceFetchError extends AppError {
  constructor(message, details = {}, isTransient = true) {
    super(message, 'SOURCE_FETCH_ERROR', 502, isTransient, details);
  }
}

export class ContentExtractionError extends AppError {
  constructor(message, details = {}) {
    super(message, 'CONTENT_EXTRACTION_ERROR', 422, false, details);
  }
}

export class VerificationError extends AppError {
  constructor(message, details = {}) {
    super(message, 'VERIFICATION_ERROR', 422, false, details);
  }
}

export class DossierValidationError extends AppError {
  constructor(message, details = {}) {
    super(message, 'DOSSIER_VALIDATION_ERROR', 400, false, details);
  }
}

export class ScoringError extends AppError {
  constructor(message, details = {}) {
    super(message, 'SCORING_ERROR', 400, false, details);
  }
}
