/**
 * Phase 4 Storyboard & Continuity Engine Module Entry Point.
 */

export { StoryboardService } from './services/storyboard-service.js';
export { StoryboardRepository } from './services/storyboard-repository.js';
export { ScriptInputAdapter, scriptInputAdapter } from './adapters/script-input-adapter.js';
export { VisualBeatExtractor, visualBeatExtractor } from './extractors/visual-beat-extractor.js';
export { CharacterBibleGenerator, characterBibleGenerator } from './bibles/character-bible-generator.js';
export { LocationBibleGenerator, locationBibleGenerator } from './bibles/location-bible-generator.js';
export { WorldBibleGenerator, worldBibleGenerator } from './bibles/world-bible-generator.js';
export { PropBibleGenerator, propBibleGenerator } from './bibles/prop-bible-generator.js';
export { StyleBibleGenerator, styleBibleGenerator } from './bibles/style-bible-generator.js';
export { ScenePlanner, scenePlanner } from './planners/scene-planner.js';
export { ContinuityStateManager, continuityStateManager } from './continuity/continuity-state-manager.js';
export { ReferenceManager, referenceManager } from './references/reference-manager.js';
export { ContinuityValidator, continuityValidator } from './continuity/continuity-validator.js';
export { SceneCompiler, sceneCompiler } from './compiler/scene-compiler.js';
export { VideoModelAdapter } from './adapters/video-model-adapter.js';
export {
  STORYBOARD_SCHEMA_VERSION,
  VISUAL_TYPES,
  TRANSITION_TYPES,
  SHOT_TYPES,
  CAMERA_MOVEMENTS,
  validateStoryboardPackage,
  validateCanonicalScene
} from './schema/storyboard-schema.js';
export * from './errors/storyboard-errors.js';
