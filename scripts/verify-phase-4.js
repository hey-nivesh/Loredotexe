#!/usr/bin/env node
/**
 * Verification Suite for Loredotexe Phase 4 Requirements.
 * Validates Storyboard Generation, Visual Bibles, Canonical Scenes, Continuity Engine, and Model Independence.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDatabaseConnection, runMigrations, closeDatabase } from '../src/db/connection.js';
import { ProjectService } from '../src/projects/project.service.js';
import {
  StoryboardService,
  StoryboardRepository,
  ScriptInputAdapter,
  VisualBeatExtractor,
  CharacterBibleGenerator,
  LocationBibleGenerator,
  WorldBibleGenerator,
  PropBibleGenerator,
  StyleBibleGenerator,
  ScenePlanner,
  ContinuityStateManager,
  ContinuityValidator,
  ReferenceManager,
  SceneCompiler,
  VideoModelAdapter,
  validateStoryboardPackage,
  validateCanonicalScene
} from '../src/storyboard/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sampleScript = JSON.parse(
  readFileSync(resolve(__dirname, '../fixtures/phase-4/sample-script.json'), 'utf-8')
);

console.log('===============================================================');
console.log('         Loredotexe — Phase 4 Verification Suite              ');
console.log('===============================================================');
console.log('');

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function runCheck(name, fn) {
  totalChecks++;
  try {
    fn();
    console.log(` [PASS] ${name}`);
    passedChecks++;
  } catch (err) {
    console.error(` [FAIL] ${name}`);
    console.error(`        Error: ${err.message}`);
    failedChecks++;
  }
}

const db = createDatabaseConnection(':memory:');
runMigrations(db);

const projectService = new ProjectService(db);
const storyboardService = new StoryboardService(db);

console.log('--- 1. Script Ingestion & Entity Normalization ---');

runCheck('ScriptInputAdapter adapts Phase 3 script and extracts characters, locations, and props', () => {
  const adapter = new ScriptInputAdapter();
  const adapted = adapter.adapt(sampleScript);
  assert.equal(adapted.projectId, sampleScript.project_id);
  assert.equal(adapted.topic, sampleScript.topic);
  assert.ok(adapted.chapters.length >= 7);
  assert.ok(adapted.entities.characters.length > 0);
  assert.ok(adapted.entities.locations.length > 0);
  assert.ok(adapted.entities.props.length > 0);
});

console.log('\n--- 2. Visual Beat Extraction ---');

runCheck('VisualBeatExtractor segments narration into bounded visual beats (4.0s - 10.0s)', () => {
  const adapter = new ScriptInputAdapter();
  const extractor = new VisualBeatExtractor();
  const adapted = adapter.adapt(sampleScript);
  const beats = extractor.extractBeats(adapted);

  assert.ok(beats.length >= 10, `Expected at least 10 beats, got ${beats.length}`);
  for (const b of beats) {
    assert.ok(b.duration_seconds >= 4.0 && b.duration_seconds <= 10.0, `Beat duration out of bounds: ${b.duration_seconds}`);
    assert.ok(b.visual_intent.length > 5);
  }
});

console.log('\n--- 3. Visual Bible Generators ---');

runCheck('Character, Location, World, Prop, and Style bibles generate stable deterministic IDs', () => {
  const adapter = new ScriptInputAdapter();
  const adapted = adapter.adapt(sampleScript);

  const charBible = new CharacterBibleGenerator().generateCharacterBible(adapted);
  const locBible = new LocationBibleGenerator().generateLocationBible(adapted);
  const worldBible = new WorldBibleGenerator().generateWorldBible(adapted);
  const propBible = new PropBibleGenerator().generatePropBible(adapted);
  const styleBible = new StyleBibleGenerator().generateStyleBible(adapted);

  assert.equal(charBible[0].character_id, 'CHAR_001');
  assert.equal(charBible[1].character_id, 'CHAR_002');
  assert.equal(locBible[0].location_id, 'LOC_001');
  assert.equal(locBible[1].location_id, 'LOC_002');
  assert.equal(worldBible.world_id, 'WORLD_001');
  assert.equal(propBible[0].prop_id, 'PROP_001');
  assert.equal(propBible[1].prop_id, 'PROP_002');
  assert.equal(styleBible.style_id, 'STYLE_001');
});

console.log('\n--- 4. Scene Planning & Continuity Graph ---');

runCheck('ScenePlanner generates continuous canonical scenes with linked sequence graph', () => {
  const adapter = new ScriptInputAdapter();
  const adapted = adapter.adapt(sampleScript);
  const beats = new VisualBeatExtractor().extractBeats(adapted);
  const bibles = {
    characterBible: new CharacterBibleGenerator().generateCharacterBible(adapted),
    locationBible: new LocationBibleGenerator().generateLocationBible(adapted),
    worldBible: new WorldBibleGenerator().generateWorldBible(adapted),
    propBible: new PropBibleGenerator().generatePropBible(adapted),
    styleBible: new StyleBibleGenerator().generateStyleBible(adapted)
  };

  const planner = new ScenePlanner();
  const scenes = planner.planScenes(beats, bibles);

  assert.ok(scenes.length >= 10);
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    assert.equal(s.sequence, i + 1);
    assert.ok(s.duration_seconds >= 4.0 && s.duration_seconds <= 10.0);
    assert.equal(s.continuity.previous_scene_id, i > 0 ? scenes[i - 1].scene_id : null);
    assert.equal(s.continuity.next_scene_id, i < scenes.length - 1 ? scenes[i + 1].scene_id : null);
  }
});

console.log('\n--- 5. Deterministic Continuity Validation ---');

runCheck('ContinuityValidator validates clean package and catches broken references', () => {
  const standaloneService = new StoryboardService();
  const validator = new ContinuityValidator();
  const { storyboardPackage } = standaloneService.generateStoryboard({ scriptPackage: sampleScript });

  const cleanReport = validator.validateStoryboard(storyboardPackage);
  assert.equal(cleanReport.valid, true);
  assert.equal(cleanReport.summary.total_errors, 0);

  // Test mutation catching
  const brokenPkg = JSON.parse(JSON.stringify(storyboardPackage));
  brokenPkg.scenes[0].characters[0].character_id = 'UNKNOWN_CHAR_999';
  const brokenReport = validator.validateStoryboard(brokenPkg);
  assert.equal(brokenReport.valid, false);
  assert.ok(brokenReport.summary.total_errors > 0);
});

console.log('\n--- 6. Model-Independent Video Adapter Handshake ---');

runCheck('VideoModelAdapter converts canonical scenes to Wan2.1, AnimateDiff, and ComfyUI targets', () => {
  const standaloneService = new StoryboardService();
  const { storyboardPackage } = standaloneService.generateStoryboard({ scriptPackage: sampleScript });
  const firstScene = storyboardPackage.scenes[0];

  const wan = VideoModelAdapter.adaptToWan21(firstScene);
  const anim = VideoModelAdapter.adaptToAnimateDiff(firstScene);
  const comfy = VideoModelAdapter.adaptToComfyUI(firstScene);

  assert.ok(wan.prompt && wan.negative_prompt && wan.num_frames > 0);
  assert.ok(anim.positive_prompt && anim.motion_module);
  assert.ok(comfy.prompt && comfy.extra_data.scene_id === firstScene.scene_id);
});

console.log('\n--- 7. SQLite Storage, Audit Revisions & End-to-End Execution ---');

runCheck('End-to-End StoryboardService creates project, generates package, audits revisions in SQLite', () => {
  const project = projectService.createProject({
    title: sampleScript.topic,
    topic: sampleScript.topic,
    category: 'space'
  }, 'verify-p4-key-001');

  const result = storyboardService.generateStoryboard({
    scriptPackage: sampleScript,
    projectId: project.id,
    storyboardVersion: 1
  });

  assert.equal(result.success, true);
  assert.ok(result.storyboardPackage.id);
  assert.equal(result.storyboardPackage.project_id, project.id);

  // Verify formal schema compliance
  validateStoryboardPackage(result.storyboardPackage);

  // Verify DB retrieval
  const activeRecord = storyboardService.getStoryboardByProjectId(project.id);
  assert.ok(activeRecord);
  assert.equal(activeRecord.storyboardPackage.topic, sampleScript.topic);

  // Verify revision log
  const revisions = storyboardService.listStoryboardRevisions(project.id);
  assert.equal(revisions.length, 1);
  assert.equal(revisions[0].storyboard_version, 1);
});

closeDatabase(db);

console.log('');
console.log('===============================================================');
console.log(` Results: ${passedChecks}/${totalChecks} checks passed.`);
if (failedChecks > 0) {
  console.log(` Phase 4 Verification: ${failedChecks} CHECKS FAILED`);
  process.exit(1);
} else {
  console.log(' Phase 4 Verification: ALL CHECKS PASSED');
  console.log('===============================================================');
  console.log('');
}
