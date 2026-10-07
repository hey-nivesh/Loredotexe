/**
 * Storyboard Service
 * Master orchestrator for Phase 4 Storyboard, Character/World/Location Bibles, and Continuity Engine.
 */

import { scriptInputAdapter } from '../adapters/script-input-adapter.js';
import { visualBeatExtractor } from '../extractors/visual-beat-extractor.js';
import { characterBibleGenerator } from '../bibles/character-bible-generator.js';
import { locationBibleGenerator } from '../bibles/location-bible-generator.js';
import { worldBibleGenerator } from '../bibles/world-bible-generator.js';
import { propBibleGenerator } from '../bibles/prop-bible-generator.js';
import { styleBibleGenerator } from '../bibles/style-bible-generator.js';
import { scenePlanner } from '../planners/scene-planner.js';
import { continuityStateManager } from '../continuity/continuity-state-manager.js';
import { referenceManager } from '../references/reference-manager.js';
import { continuityValidator } from '../continuity/continuity-validator.js';
import { sceneCompiler } from '../compiler/scene-compiler.js';
import { StoryboardRepository } from './storyboard-repository.js';
import { logger } from '../../logging/logger.js';

export class StoryboardService {
  /**
   * @param {import('node:sqlite').DatabaseSync} db
   * @param {object} [config={}]
   */
  constructor(db, config = {}) {
    this.db = db;
    this.config = config;
    this.storyboardRepo = new StoryboardRepository(db);
    this.scriptInputAdapter = scriptInputAdapter;
    this.visualBeatExtractor = visualBeatExtractor;
    this.characterBibleGenerator = characterBibleGenerator;
    this.locationBibleGenerator = locationBibleGenerator;
    this.worldBibleGenerator = worldBibleGenerator;
    this.propBibleGenerator = propBibleGenerator;
    this.styleBibleGenerator = styleBibleGenerator;
    this.scenePlanner = scenePlanner;
    this.continuityStateManager = continuityStateManager;
    this.referenceManager = referenceManager;
    this.continuityValidator = continuityValidator;
    this.sceneCompiler = sceneCompiler;
  }

  /**
   * Generates a complete Phase 4 Storyboard Package from a Phase 3 Script.
   * @param {object} params
   * @param {object} [params.script] Phase 3 Script package
   * @param {object} [params.scriptPackage] Phase 3 Script package
   * @param {string} [params.projectId]
   * @param {number} [params.storyboardVersion=1]
   * @param {number} [params.scriptVersion]
   * @returns {object} Storyboard package and saved record metadata
   */
  generateStoryboard({ script, scriptPackage, projectId = null, storyboardVersion = 1, scriptVersion = null }) {
    logger.info('Starting Phase 4 Storyboard & Continuity Engine', { projectId, storyboardVersion });

    const rawInput = scriptPackage || script;

    // 1. Adapt and normalize Phase 3 script input
    const normalizedScript = this.scriptInputAdapter.adapt(rawInput);
    const finalProjectId = projectId || normalizedScript.projectId;
    const finalScriptVersion = scriptVersion || normalizedScript.scriptVersion || 1;

    // 2. Extract visual storytelling beats
    const visualBeats = this.visualBeatExtractor.extractBeats(normalizedScript);

    // 3. Generate stable visual Bibles
    const characterBible = this.characterBibleGenerator.generateCharacterBible(normalizedScript);
    const locationBible = this.locationBibleGenerator.generateLocationBible(normalizedScript);
    const worldBible = this.worldBibleGenerator.generateWorldBible(normalizedScript);
    const propBible = this.propBibleGenerator.generatePropBible(normalizedScript);
    const visualStyle = this.styleBibleGenerator.generateStyleBible(normalizedScript);

    // 4. Plan canonical model-independent scenes
    const scenes = this.scenePlanner.planScenes(visualBeats, {
      characterBible,
      locationBible,
      worldBible,
      propBible,
      styleBible: visualStyle
    });

    // 5. Build project-level continuity state
    const continuityState = this.continuityStateManager.buildState(scenes);

    // 6. Build reference requirement manifest
    const referenceRequirements = this.referenceManager.buildReferenceManifest(
      { characterBible, locationBible, propBible },
      scenes
    );

    // 7. Validate continuity rules deterministically
    const validationReport = this.continuityValidator.validateContinuity({
      scenes,
      characterBible,
      locationBible,
      propBible,
      targetDurationSeconds: normalizedScript.targetDurationSeconds
    });

    // 8. Compile and formally validate canonical package
    const storyboardPackage = this.sceneCompiler.compile({
      projectId: finalProjectId,
      scriptId: normalizedScript.scriptId,
      scriptVersion: finalScriptVersion,
      storyboardVersion,
      topic: normalizedScript.topic,
      visualStyle,
      characterBible,
      worldBible,
      locationBible,
      propBible,
      scenes,
      continuityState,
      referenceRequirements,
      validationReport
    });

    // 9. Persist package and record revision audit if DB is available
    let savedRecord = null;
    if (this.db) {
      savedRecord = this.storyboardRepo.saveStoryboard(storyboardPackage);
      this.storyboardRepo.recordRevision({
        storyboardId: storyboardPackage.id,
        projectId: finalProjectId,
        version: storyboardVersion,
        validationOutcome: validationReport.status,
        storyboardJson: storyboardPackage,
        contentHash: storyboardPackage.content_hash
      });
    }

    logger.info('Storyboard package generated and persisted successfully', {
      storyboardId: storyboardPackage.id,
      projectId: finalProjectId,
      sceneCount: scenes.length,
      duration: validationReport.stats.total_duration_seconds,
      validationStatus: validationReport.status
    });

    return {
      success: validationReport.valid,
      storyboard: storyboardPackage,
      storyboardPackage,
      savedRecord,
      validationReport
    };
  }

  /**
   * Retrieves the active storyboard for a project.
   * @param {string} projectId
   */
  getStoryboardByProjectId(projectId) {
    return this.storyboardRepo.findLatestByProjectId(projectId);
  }

  /**
   * Lists all storyboard revisions for a project.
   * @param {string} projectId
   */
  listStoryboardRevisions(projectId) {
    return this.storyboardRepo.listRevisionsByProjectId(projectId);
  }
}
