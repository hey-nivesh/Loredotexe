/**
 * Canonical Schemas and Validators for Phase 6 Audio & Video Assembly.
 */

import { ValidationError } from '../../errors/app-errors.js';

/**
 * Validates a Narration Segment.
 * @param {object} segment
 * @returns {object} Validated segment
 */
export function validateNarrationSegment(segment) {
  if (!segment || typeof segment !== 'object') {
    throw new ValidationError('Narration segment must be a non-null object.');
  }

  const { narration_id, scene_id, sequence, text } = segment;

  if (!narration_id || typeof narration_id !== 'string') {
    throw new ValidationError('narration_id is required and must be a string.', { segment });
  }

  if (!scene_id || typeof scene_id !== 'string') {
    throw new ValidationError('scene_id is required and must be a string.', { segment });
  }

  if (typeof sequence !== 'number' || sequence < 1) {
    throw new ValidationError('sequence must be a positive integer.', { segment });
  }

  if (typeof text !== 'string' || !text.trim()) {
    throw new ValidationError('text is required and cannot be empty.', { segment });
  }

  return {
    narration_id: narration_id.trim(),
    scene_id: scene_id.trim(),
    sequence,
    text: text.trim(),
    estimated_duration_seconds: segment.estimated_duration_seconds || 0.0,
    actual_duration_seconds: segment.actual_duration_seconds || 0.0,
    audio_path: segment.audio_path || null,
    status: segment.status || 'PENDING'
  };
}

/**
 * Validates a Master Narration Timeline.
 * @param {object} timeline
 * @returns {object} Validated timeline
 */
export function validateNarrationTimeline(timeline) {
  if (!timeline || typeof timeline !== 'object') {
    throw new ValidationError('Narration timeline must be a non-null object.');
  }

  if (!Array.isArray(timeline.segments) || timeline.segments.length === 0) {
    throw new ValidationError('Narration timeline must contain at least one segment.', { timeline });
  }

  const validatedSegments = timeline.segments.map((seg, idx) => {
    if (typeof seg.start_seconds !== 'number' || typeof seg.end_seconds !== 'number') {
      throw new ValidationError(`Timeline segment #${idx + 1} must specify start_seconds and end_seconds.`);
    }
    if (seg.end_seconds < seg.start_seconds) {
      throw new ValidationError(`Timeline segment #${idx + 1} end_seconds cannot precede start_seconds.`);
    }
    return {
      narration_id: seg.narration_id,
      scene_id: seg.scene_id,
      sequence: seg.sequence || idx + 1,
      text: seg.text || '',
      start_seconds: Math.round(seg.start_seconds * 1000) / 1000,
      end_seconds: Math.round(seg.end_seconds * 1000) / 1000,
      duration_seconds: Math.round((seg.end_seconds - seg.start_seconds) * 1000) / 1000,
      audio_path: seg.audio_path || null
    };
  });

  return {
    timeline_version: timeline.timeline_version || 1,
    total_duration_seconds: validatedSegments.reduce((acc, s) => Math.max(acc, s.end_seconds), 0),
    segments: validatedSegments
  };
}

/**
 * Validates Final Assembly Manifest.
 * @param {object} manifest
 * @returns {object}
 */
export function validateAssemblyManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    throw new ValidationError('Assembly manifest must be an object.');
  }
  if (!manifest.project_id) {
    throw new ValidationError('Assembly manifest must specify project_id.');
  }
  return manifest;
}
