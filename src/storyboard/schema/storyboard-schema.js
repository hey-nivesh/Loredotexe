/**
 * Canonical Storyboard & Scene JSON Schema Definitions and Validator.
 */

import { StoryboardValidationError } from '../errors/storyboard-errors.js';

export const STORYBOARD_SCHEMA_VERSION = '1.0.0';

export const VISUAL_TYPES = Object.freeze({
  CINEMATIC: 'cinematic',
  TALKING_CHARACTER: 'talking_character',
  ENVIRONMENT: 'environment',
  INFOGRAPHIC: 'infographic',
  DIAGRAM: 'diagram',
  TIMELINE: 'timeline',
  MAP: 'map',
  MEME_INSERT: 'meme_insert',
  REACTION: 'reaction',
  MONTAGE: 'montage',
  PRODUCT_DEMO: 'product_demo',
  SCREEN_MOCKUP: 'screen_mockup',
  ABSTRACT_VISUAL: 'abstract_visual',
  TRANSITION: 'transition'
});

export const TRANSITION_TYPES = Object.freeze({
  CUT: 'cut',
  FADE: 'fade',
  ZOOM: 'zoom',
  MATCH_CUT: 'match_cut',
  WHIP_PAN: 'whip_pan',
  GRAPHIC_TRANSITION: 'graphic_transition',
  MONTAGE: 'montage',
  CROSSFADE: 'crossfade'
});

export const SHOT_TYPES = Object.freeze({
  WIDE: 'wide',
  MEDIUM: 'medium',
  CLOSE_UP: 'close_up',
  EXTREME_CLOSE_UP: 'extreme_close_up',
  AERIAL: 'aerial',
  OVER_THE_SHOULDER: 'over_the_shoulder'
});

export const CAMERA_MOVEMENTS = Object.freeze({
  STATIC: 'static',
  SLOW_PUSH_IN: 'slow_push_in',
  PAN_LEFT: 'pan_left',
  PAN_RIGHT: 'pan_right',
  TRACKING: 'tracking',
  TILT_UP: 'tilt_up',
  WHIP_PAN: 'whip_pan'
});

/**
 * Validates a complete Phase 4 Storyboard Package against the canonical specification.
 * @param {object} pkg
 * @returns {object} Validated package
 */
export function validateStoryboardPackage(pkg) {
  if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) {
    throw new StoryboardValidationError('Storyboard package must be a non-empty object.');
  }

  const requiredFields = [
    'schema_version',
    'project_id',
    'script_id',
    'script_version',
    'storyboard_version',
    'topic',
    'visual_style',
    'character_bible',
    'world_bible',
    'location_bible',
    'prop_bible',
    'scenes',
    'continuity_state',
    'reference_requirements',
    'validation_report',
    'created_at',
    'content_hash'
  ];

  for (const field of requiredFields) {
    if (pkg[field] === undefined || pkg[field] === null) {
      throw new StoryboardValidationError(`Storyboard package is missing required field: '${field}'.`, { field });
    }
  }

  if (!Array.isArray(pkg.scenes) || pkg.scenes.length === 0) {
    throw new StoryboardValidationError('Storyboard must contain a non-empty array of scenes.', { field: 'scenes' });
  }

  // Validate each canonical scene
  const sceneIds = new Set();
  for (let i = 0; i < pkg.scenes.length; i++) {
    const scene = pkg.scenes[i];
    if (!scene || typeof scene !== 'object') {
      throw new StoryboardValidationError(`Scene at index ${i} is invalid.`);
    }

    const sceneRequired = [
      'scene_id',
      'sequence',
      'duration_seconds',
      'visual_type',
      'visual_purpose',
      'action',
      'camera',
      'lighting',
      'visual_prompt',
      'negative_prompt',
      'continuity'
    ];

    for (const sf of sceneRequired) {
      if (scene[sf] === undefined || scene[sf] === null) {
        throw new StoryboardValidationError(`Scene '${scene.scene_id || i}' is missing required field '${sf}'.`, {
          sceneIndex: i,
          field: sf
        });
      }
    }

    if (sceneIds.has(scene.scene_id)) {
      throw new StoryboardValidationError(`Duplicate scene_id '${scene.scene_id}' detected at index ${i}.`, {
        sceneId: scene.scene_id
      });
    }
    sceneIds.add(scene.scene_id);

    if (typeof scene.duration_seconds !== 'number' || scene.duration_seconds <= 0) {
      throw new StoryboardValidationError(`Scene '${scene.scene_id}' duration must be greater than 0.`, {
        sceneId: scene.scene_id,
        duration: scene.duration_seconds
      });
    }
  }

  return pkg;
}

/**
 * Validates a single canonical scene object.
 * @param {object} scene
 * @returns {object}
 */
export function validateCanonicalScene(scene) {
  if (!scene || typeof scene !== 'object') {
    throw new StoryboardValidationError('Canonical scene must be a non-empty object.');
  }

  const sceneRequired = [
    'scene_id',
    'sequence',
    'duration_seconds',
    'visual_type',
    'visual_purpose',
    'action',
    'camera',
    'lighting',
    'visual_prompt',
    'negative_prompt',
    'continuity'
  ];

  for (const sf of sceneRequired) {
    if (scene[sf] === undefined || scene[sf] === null) {
      throw new StoryboardValidationError(`Scene is missing required field '${sf}'.`, { field: sf });
    }
  }

  if (typeof scene.duration_seconds !== 'number' || scene.duration_seconds <= 0) {
    throw new StoryboardValidationError(`Scene '${scene.scene_id}' duration must be greater than 0.`, {
      sceneId: scene.scene_id,
      duration: scene.duration_seconds
    });
  }

  return scene;
}
