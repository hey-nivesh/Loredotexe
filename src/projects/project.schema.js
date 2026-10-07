/**
 * Project Schema, Status Definitions, and Input Validators.
 */

import { ValidationError } from '../errors/app-errors.js';

export const PROJECT_STATUS = Object.freeze({
  CREATED: 'CREATED',
  PLANNING: 'PLANNING',
  PLANNED: 'PLANNED',
  GENERATING: 'GENERATING',
  MEDIA_GENERATING: 'MEDIA_GENERATING',
  MEDIA_READY: 'MEDIA_READY',
  AUDIO_GENERATING: 'AUDIO_GENERATING',
  ASSEMBLING: 'ASSEMBLING',
  VIDEO_READY: 'VIDEO_READY',
  REVIEW_READY: 'REVIEW_READY',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  PUBLISHING: 'PUBLISHING',
  PUBLISHED: 'PUBLISHED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
});

export const ALL_PROJECT_STATUSES = Object.freeze(Object.values(PROJECT_STATUS));

export const DEFAULT_CHANNEL_NAME = 'The 10min Explosion';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates that a string is a valid UUID format.
 * @param {string} id
 * @param {string} [fieldName='id']
 * @returns {string}
 */
export function validateUuid(id, fieldName = 'id') {
  if (!id || typeof id !== 'string' || !UUID_REGEX.test(id.trim())) {
    throw new ValidationError(`Invalid ${fieldName}: must be a valid UUID v4 format.`, { [fieldName]: id });
  }
  return id.trim();
}

/**
 * Validates project creation input.
 * @param {unknown} input
 * @returns {{ title: string, topic: string, channelName: string, metadata: object }}
 */
export function validateProjectInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ValidationError('Project input must be a non-empty JSON object.');
  }

  const { title, topic, channelName, channel_name, metadata } = input;

  if (typeof title !== 'string' || !title.trim()) {
    throw new ValidationError('Project title is required and cannot be blank.', { field: 'title' });
  }

  const trimmedTitle = title.trim();
  if (trimmedTitle.length < 3 || trimmedTitle.length > 200) {
    throw new ValidationError('Project title must be between 3 and 200 characters.', {
      field: 'title',
      length: trimmedTitle.length
    });
  }

  if (typeof topic !== 'string' || !topic.trim()) {
    throw new ValidationError('Project topic is required and cannot be blank.', { field: 'topic' });
  }

  const trimmedTopic = topic.trim();
  if (trimmedTopic.length < 2 || trimmedTopic.length > 500) {
    throw new ValidationError('Project topic must be between 2 and 500 characters.', {
      field: 'topic',
      length: trimmedTopic.length
    });
  }

  let finalChannel = DEFAULT_CHANNEL_NAME;
  const rawChannel = channelName || channel_name;
  if (rawChannel !== undefined && rawChannel !== null) {
    if (typeof rawChannel !== 'string' || !rawChannel.trim()) {
      throw new ValidationError('channelName must be a valid non-empty string when provided.', { field: 'channelName' });
    }
    finalChannel = rawChannel.trim();
  }

  let finalMetadata = {};
  if (metadata !== undefined && metadata !== null) {
    if (typeof metadata !== 'object' || Array.isArray(metadata)) {
      throw new ValidationError('metadata must be a key-value object when provided.', { field: 'metadata' });
    }
    finalMetadata = metadata;
  }

  return {
    title: trimmedTitle,
    topic: trimmedTopic,
    channelName: finalChannel,
    metadata: finalMetadata
  };
}

/**
 * Validates an idempotency key string.
 * @param {unknown} key
 * @returns {string|null}
 */
export function validateIdempotencyKey(key) {
  if (key === undefined || key === null) {
    return null;
  }
  if (typeof key !== 'string' || !key.trim()) {
    throw new ValidationError('Idempotency key must be a non-empty string when provided.', { field: 'idempotencyKey' });
  }
  const trimmed = key.trim();
  if (trimmed.length > 128) {
    throw new ValidationError('Idempotency key cannot exceed 128 characters.', { field: 'idempotencyKey' });
  }
  return trimmed;
}
