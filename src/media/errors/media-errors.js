/**
 * Error classes and error codes for Phase 5 Media Generation Engine.
 */

import { AppError } from '../../errors/app-errors.js';

export const MEDIA_ERROR_CODES = Object.freeze({
  GPU_NOT_FOUND: 'GPU_NOT_FOUND',
  CUDA_UNAVAILABLE: 'CUDA_UNAVAILABLE',
  INSUFFICIENT_VRAM: 'INSUFFICIENT_VRAM',
  INSUFFICIENT_RAM: 'INSUFFICIENT_RAM',
  INSUFFICIENT_DISK: 'INSUFFICIENT_DISK',
  PYTHON_VERSION_UNSUPPORTED: 'PYTHON_VERSION_UNSUPPORTED',
  MODEL_NOT_INSTALLED: 'MODEL_NOT_INSTALLED',
  MODEL_LOAD_FAILED: 'MODEL_LOAD_FAILED',
  GENERATION_FAILED: 'GENERATION_FAILED',
  OUTPUT_INVALID: 'OUTPUT_INVALID',
  OUTPUT_CORRUPTED: 'OUTPUT_CORRUPTED',
  INVALID_SCENE: 'INVALID_SCENE',
  INVALID_PROMPT: 'INVALID_PROMPT',
  TIMEOUT: 'TIMEOUT',
  RESOURCE_CONSTRAINT: 'RESOURCE_CONSTRAINT',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
});

export class MediaError extends AppError {
  constructor(message, code = MEDIA_ERROR_CODES.UNKNOWN_ERROR, isTransient = false, details = {}) {
    super(message, 500, code, isTransient, details);
    this.name = 'MediaError';
    this.mediaErrorCode = code;
  }
}

export class HardwareConstraintError extends MediaError {
  constructor(message, code = MEDIA_ERROR_CODES.RESOURCE_CONSTRAINT, details = {}) {
    super(message, code, false, details);
    this.name = 'HardwareConstraintError';
  }
}

export class ModelUnavailableError extends MediaError {
  constructor(message, code = MEDIA_ERROR_CODES.MODEL_NOT_INSTALLED, details = {}) {
    super(message, code, false, details);
    this.name = 'ModelUnavailableError';
  }
}

export class MediaValidationError extends MediaError {
  constructor(message, code = MEDIA_ERROR_CODES.OUTPUT_INVALID, details = {}) {
    super(message, code, false, details);
    this.name = 'MediaValidationError';
  }
}

export class GenerationTimeoutError extends MediaError {
  constructor(message, details = {}) {
    super(message, MEDIA_ERROR_CODES.TIMEOUT, true, details);
    this.name = 'GenerationTimeoutError';
  }
}

export class PythonEnvironmentError extends MediaError {
  constructor(message, details = {}) {
    super(message, MEDIA_ERROR_CODES.PYTHON_VERSION_UNSUPPORTED, false, details);
    this.name = 'PythonEnvironmentError';
  }
}
