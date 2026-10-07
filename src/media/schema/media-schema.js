/**
 * Canonical Schema Definitions and Validators for Phase 5 Media Generation.
 */

import { MediaValidationError } from '../errors/media-errors.js';

export const MEDIA_SCHEMA_VERSION = '1.0.0';

export const ASSET_TYPES = Object.freeze({
  VIDEO: 'video',
  IMAGE: 'image',
  REFERENCE: 'reference'
});

export const JOB_STATUSES = Object.freeze({
  QUEUED: 'QUEUED',
  VALIDATING: 'VALIDATING',
  GENERATING: 'GENERATING',
  VALIDATING_OUTPUT: 'VALIDATING_OUTPUT',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  RETRYING: 'RETRYING'
});

export const ASSET_STATUSES = Object.freeze({
  VALID: 'VALID',
  INVALID: 'INVALID',
  CORRUPTED: 'CORRUPTED',
  PENDING: 'PENDING'
});

/**
 * Validates a structured Generation Request.
 * @param {object} req
 * @returns {object} Validated request
 */
export function validateGenerationRequest(req) {
  if (!req || typeof req !== 'object' || Array.isArray(req)) {
    throw new MediaValidationError('GenerationRequest must be a non-empty object.');
  }

  const required = [
    'scene_id',
    'prompt',
    'negative_prompt',
    'width',
    'height',
    'fps',
    'duration_seconds'
  ];

  for (const field of required) {
    if (req[field] === undefined || req[field] === null) {
      throw new MediaValidationError(`GenerationRequest missing required field: '${field}'.`, undefined, { field });
    }
  }

  if (typeof req.prompt !== 'string' || !req.prompt.trim()) {
    throw new MediaValidationError('GenerationRequest prompt must be a non-empty string.', undefined, { field: 'prompt' });
  }

  if (typeof req.duration_seconds !== 'number' || req.duration_seconds <= 0) {
    throw new MediaValidationError('GenerationRequest duration_seconds must be a positive number.', undefined, {
      duration_seconds: req.duration_seconds
    });
  }

  return {
    scene_id: req.scene_id,
    prompt: req.prompt.trim(),
    negative_prompt: req.negative_prompt || '',
    width: parseInt(req.width, 10) || 832,
    height: parseInt(req.height, 10) || 480,
    fps: parseInt(req.fps, 10) || 16,
    duration_seconds: parseFloat(req.duration_seconds),
    seed: req.seed !== undefined ? req.seed : null,
    reference_assets: Array.isArray(req.reference_assets) ? req.reference_assets : [],
    model_parameters: req.model_parameters && typeof req.model_parameters === 'object' ? req.model_parameters : {}
  };
}

/**
 * Validates a Media Asset Metadata object.
 * @param {object} meta
 * @returns {object} Validated metadata
 */
export function validateMediaAssetMetadata(meta) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    throw new MediaValidationError('MediaAssetMetadata must be a non-empty object.');
  }

  const required = [
    'asset_id',
    'project_id',
    'scene_id',
    'type',
    'provider',
    'model',
    'prompt_hash',
    'duration_seconds',
    'width',
    'height',
    'fps',
    'file_size_bytes',
    'created_at',
    'status'
  ];

  for (const field of required) {
    if (meta[field] === undefined || meta[field] === null) {
      throw new MediaValidationError(`MediaAssetMetadata missing required field: '${field}'.`, undefined, { field });
    }
  }

  return meta;
}

/**
 * Validates a Generation Manifest object.
 * @param {object} manifest
 * @returns {object}
 */
export function validateGenerationManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new MediaValidationError('GenerationManifest must be a non-empty object.');
  }

  const required = ['project_id', 'storyboard_version', 'generation_version', 'summary', 'assets'];
  for (const field of required) {
    if (manifest[field] === undefined || manifest[field] === null) {
      throw new MediaValidationError(`GenerationManifest missing required field: '${field}'.`, undefined, { field });
    }
  }

  return manifest;
}
