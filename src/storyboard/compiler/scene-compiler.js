/**
 * Model-Independent Scene Package Compiler
 * Compiles bibles, canonical scenes, continuity state, and reference manifests into a validated package.
 */

import { createHash, randomUUID } from 'node:crypto';
import { STORYBOARD_SCHEMA_VERSION, validateStoryboardPackage } from '../schema/storyboard-schema.js';

export class SceneCompiler {
  /**
   * Compiles the complete Phase 4 Storyboard Package.
   * @param {object} params
   * @returns {object} Canonical Storyboard Package
   */
  compile({
    projectId,
    scriptId,
    scriptVersion,
    storyboardVersion = 1,
    topic,
    visualStyle,
    characterBible,
    worldBible,
    locationBible,
    propBible,
    scenes,
    continuityState,
    referenceRequirements,
    validationReport
  }) {
    const packageId = randomUUID();
    const now = new Date().toISOString();

    // Compute deterministic content hash across scenes and bibles
    const contentHash = createHash('sha256')
      .update(JSON.stringify(scenes) + JSON.stringify(characterBible) + JSON.stringify(locationBible))
      .digest('hex');

    const storyboardPackage = {
      schema_version: STORYBOARD_SCHEMA_VERSION,
      id: packageId,
      storyboard_id: packageId,
      project_id: projectId,
      script_id: scriptId,
      script_version: scriptVersion,
      storyboard_version: storyboardVersion,
      topic,
      visual_style: visualStyle,
      character_bible: characterBible,
      world_bible: worldBible,
      location_bible: locationBible,
      prop_bible: propBible,
      bibles: {
        character_bible: characterBible,
        world_bible: worldBible,
        location_bible: locationBible,
        prop_bible: propBible,
        visual_style: visualStyle
      },
      scenes,
      total_scenes: scenes.length,
      continuity_state: continuityState,
      reference_requirements: referenceRequirements,
      reference_manifest: referenceRequirements,
      validation_report: validationReport,
      created_at: now,
      content_hash: contentHash
    };

    return validateStoryboardPackage(storyboardPackage);
  }
}

export const sceneCompiler = new SceneCompiler();
