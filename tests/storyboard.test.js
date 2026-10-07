/**
 * Automated Tests: Phase 4 Storyboard + Character/World/Continuity Engine.
 */

import test from 'node:test';
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
  validateCanonicalScene,
  StoryboardValidationError,
  ContinuityValidationError,
  ScriptInputError
} from '../src/storyboard/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sampleScript = JSON.parse(
  readFileSync(resolve(__dirname, '../fixtures/phase-4/sample-script.json'), 'utf-8')
);

function getFreshDb() {
  const db = createDatabaseConnection(':memory:');
  runMigrations(db);
  return db;
}

test('1. ScriptInputAdapter extracts entities, locations, props, and beats from valid script', () => {
  const adapter = new ScriptInputAdapter();
  const normalized = adapter.adaptScript(sampleScript);

  assert.equal(normalized.project_id, sampleScript.project_id);
  assert.equal(normalized.topic, sampleScript.topic);
  assert.ok(normalized.chapters.length >= 7);
  assert.ok(normalized.entities.characters.length >= 1);
  assert.ok(normalized.entities.locations.length >= 1);
  assert.ok(normalized.entities.props.length >= 1);

  // Throws on missing or invalid script
  assert.throws(
    () => adapter.adaptScript(null),
    (err) => err instanceof ScriptInputError
  );
  assert.throws(
    () => adapter.adaptScript({ topic: 'No chapters' }),
    (err) => err instanceof ScriptInputError
  );
});

test('2. VisualBeatExtractor slices narration into rhythmic visual beats (4-10s)', () => {
  const extractor = new VisualBeatExtractor({ minDurationSeconds: 4.0, maxDurationSeconds: 10.0 });
  const chapter = sampleScript.chapters[0];
  const beats = extractor.extractBeatsFromChapter(chapter, 1);

  assert.ok(beats.length >= 2, `Expected at least 2 beats, got ${beats.length}`);
  for (const beat of beats) {
    assert.ok(beat.duration_seconds >= 4.0 && beat.duration_seconds <= 10.0, `Beat duration out of bounds: ${beat.duration_seconds}`);
    assert.ok(beat.visual_intent.length > 0);
    assert.ok(beat.spoken_text.length > 0);
  }
});

test('3. Bible generators produce deterministic stable IDs (CHAR_001, LOC_001, PROP_001, etc.)', () => {
  const charGen = new CharacterBibleGenerator();
  const locGen = new LocationBibleGenerator();
  const worldGen = new WorldBibleGenerator();
  const propGen = new PropBibleGenerator();
  const styleGen = new StyleBibleGenerator();

  const charBible = charGen.generate({ topic: sampleScript.topic, entities: { characters: ['NASA Flight Engineer', 'Interstellar Probe'] } });
  const locBible = locGen.generate({ topic: sampleScript.topic, entities: { locations: ['Mission Control Room', 'Deep Space Void'] } });
  const worldBible = worldGen.generate({ topic: sampleScript.topic });
  const propBible = propGen.generate({ topic: sampleScript.topic, entities: { props: ['1970s Memory Chip', 'Telemetry Screen'] } });
  const styleBible = styleGen.generate({ topic: sampleScript.topic });

  assert.ok(charBible.characters.length >= 2);
  assert.equal(charBible.characters[0].character_id, 'CHAR_001');
  assert.equal(charBible.characters[1].character_id, 'CHAR_002');
  assert.ok(charBible.characters[0].outfits[0].outfit_id.startsWith('OUTFIT_'));

  assert.ok(locBible.locations.length >= 2);
  assert.equal(locBible.locations[0].location_id, 'LOC_001');
  assert.equal(locBible.locations[1].location_id, 'LOC_002');

  assert.equal(worldBible.world_id, 'WORLD_001');
  assert.ok(propBible.props.length >= 2);
  assert.equal(propBible.props[0].prop_id, 'PROP_001');
  assert.equal(styleBible.style_id, 'STYLE_001');
});

test('4. ScenePlanner creates continuous sequence with previous/next scene links and valid durations', () => {
  const adapter = new ScriptInputAdapter();
  const normalized = adapter.adaptScript(sampleScript);
  const charBible = new CharacterBibleGenerator().generate(normalized);
  const locBible = new LocationBibleGenerator().generate(normalized);
  const propBible = new PropBibleGenerator().generate(normalized);
  const styleBible = new StyleBibleGenerator().generate(normalized);

  const planner = new ScenePlanner({ minSceneDuration: 4.0, maxSceneDuration: 10.0 });
  const scenes = planner.planScenes(normalized, {
    characterBible: charBible,
    locationBible: locBible,
    propBible: propBible,
    styleBible: styleBible
  });

  assert.ok(scenes.length >= 10, `Expected at least 10 scenes, got ${scenes.length}`);
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    assert.equal(scene.sequence_index, i + 1);
    assert.ok(scene.duration_seconds >= 4.0 && scene.duration_seconds <= 10.0);
    assert.equal(scene.continuity.previous_scene_id, i > 0 ? scenes[i - 1].scene_id : null);
    assert.equal(scene.continuity.next_scene_id, i < scenes.length - 1 ? scenes[i + 1].scene_id : null);
  }
});

test('5. ContinuityValidator validates clean storyboard with zero blocking errors', () => {
  const service = new StoryboardService();
  const result = service.generateStoryboard({ scriptPackage: sampleScript });

  assert.equal(result.success, true);
  assert.equal(result.validationReport.valid, true);
  assert.equal(result.validationReport.summary.total_errors, 0);
  assert.ok(result.storyboardPackage.scenes.length > 0);
});

test('6. ContinuityValidator catches unknown character reference', () => {
  const service = new StoryboardService();
  const result = service.generateStoryboard({ scriptPackage: sampleScript });
  const pkg = JSON.parse(JSON.stringify(result.storyboardPackage));

  // Introduce unknown character ID
  pkg.scenes[0].characters.push({
    character_id: 'CHAR_999_UNKNOWN',
    name: 'Ghost Character',
    outfit_id: 'OUTFIT_001',
    screen_position: 'center',
    action: 'Standing'
  });

  const validator = new ContinuityValidator();
  const report = validator.validateStoryboard(pkg);

  assert.equal(report.valid, false);
  assert.ok(report.summary.total_errors > 0);
  const found = report.issues.some((iss) => iss.message.includes('CHAR_999_UNKNOWN'));
  assert.ok(found, 'Expected error for unknown character CHAR_999_UNKNOWN');
});

test('7. ContinuityValidator catches unknown location reference', () => {
  const service = new StoryboardService();
  const result = service.generateStoryboard({ scriptPackage: sampleScript });
  const pkg = JSON.parse(JSON.stringify(result.storyboardPackage));

  // Introduce unknown location ID
  pkg.scenes[0].location.location_id = 'LOC_999_UNKNOWN';

  const validator = new ContinuityValidator();
  const report = validator.validateStoryboard(pkg);

  assert.equal(report.valid, false);
  assert.ok(report.summary.total_errors > 0);
  const found = report.issues.some((iss) => iss.message.includes('LOC_999_UNKNOWN'));
  assert.ok(found, 'Expected error for unknown location LOC_999_UNKNOWN');
});

test('8. ContinuityValidator catches unknown prop reference', () => {
  const service = new StoryboardService();
  const result = service.generateStoryboard({ scriptPackage: sampleScript });
  const pkg = JSON.parse(JSON.stringify(result.storyboardPackage));

  // Introduce unknown prop ID
  pkg.scenes[0].props.push({
    prop_id: 'PROP_999_UNKNOWN',
    name: 'Alien Gadget'
  });

  const validator = new ContinuityValidator();
  const report = validator.validateStoryboard(pkg);

  assert.equal(report.valid, false);
  assert.ok(report.summary.total_errors > 0);
  const found = report.issues.some((iss) => iss.message.includes('PROP_999_UNKNOWN'));
  assert.ok(found, 'Expected error for unknown prop PROP_999_UNKNOWN');
});

test('9. ContinuityValidator catches duplicate scene IDs', () => {
  const service = new StoryboardService();
  const result = service.generateStoryboard({ scriptPackage: sampleScript });
  const pkg = JSON.parse(JSON.stringify(result.storyboardPackage));

  // Duplicate scene ID
  pkg.scenes[1].scene_id = pkg.scenes[0].scene_id;

  const validator = new ContinuityValidator();
  const report = validator.validateStoryboard(pkg);

  assert.equal(report.valid, false);
  const found = report.issues.some((iss) => iss.message.includes('Duplicate scene_id'));
  assert.ok(found, 'Expected error for duplicate scene_id');
});

test('10. ContinuityValidator catches broken previous/next scene link', () => {
  const service = new StoryboardService();
  const result = service.generateStoryboard({ scriptPackage: sampleScript });
  const pkg = JSON.parse(JSON.stringify(result.storyboardPackage));

  // Break next link
  pkg.scenes[0].continuity.next_scene_id = 'SCENE_DOES_NOT_EXIST';

  const validator = new ContinuityValidator();
  const report = validator.validateStoryboard(pkg);

  assert.equal(report.valid, false);
  const found = report.issues.some((iss) => iss.message.includes('Broken link'));
  assert.ok(found, 'Expected error for broken link');
});

test('11. ContinuityValidator flags unannounced outfit change in continuous time as warning', () => {
  const service = new StoryboardService();
  const result = service.generateStoryboard({ scriptPackage: sampleScript });
  const pkg = JSON.parse(JSON.stringify(result.storyboardPackage));

  const charList = Array.isArray(pkg.bibles.character_bible)
    ? pkg.bibles.character_bible
    : (pkg.bibles.character_bible?.characters || pkg.character_bible || []);

  if (pkg.scenes.length >= 2 && charList.length > 0) {
    const charId = charList[0].character_id;
    // Put same character in scene 0 and scene 1, but change outfit while time is continuous
    pkg.scenes[0].characters = [{ character_id: charId, name: 'Eng', outfit_id: 'OUTFIT_001', screen_position: 'center' }];
    pkg.scenes[1].characters = [{ character_id: charId, name: 'Eng', outfit_id: 'OUTFIT_002', screen_position: 'center' }];
    pkg.scenes[0].continuity.time_of_day = 'night';
    pkg.scenes[1].continuity.time_of_day = 'night';

    const validator = new ContinuityValidator();
    const report = validator.validateStoryboard(pkg);

    const foundWarn = report.issues.some((iss) => iss.message.includes('Outfit changed from') || iss.type === 'OUTFIT_CHANGE');
    assert.ok(foundWarn, 'Expected warning for sudden outfit change');
  }
});

test('12. Scene duration bounds (4.0s - 10.0s) enforced by validator and schema', () => {
  const service = new StoryboardService();
  const result = service.generateStoryboard({ scriptPackage: sampleScript });
  const pkg = JSON.parse(JSON.stringify(result.storyboardPackage));

  pkg.scenes[0].duration_seconds = 2.0; // Too short

  const validator = new ContinuityValidator();
  const report = validator.validateStoryboard(pkg);

  assert.equal(report.valid, false);
  const found = report.issues.some((iss) => iss.message.includes('Duration 2s out of allowed bounds'));
  assert.ok(found, 'Expected error for duration out of bounds');
});

test('13. ReferenceManager generates prioritized manifest and tracks asset dependencies', () => {
  const service = new StoryboardService();
  const result = service.generateStoryboard({ scriptPackage: sampleScript });
  const manifest = result.storyboardPackage.reference_manifest;

  assert.ok(manifest.total_requirements > 0);
  assert.ok(manifest.requirements.length > 0);
  const charReq = manifest.requirements.find((r) => r.asset_type === 'character_turnaround');
  assert.ok(charReq);
  assert.ok(['HIGH', 'CRITICAL', 'MEDIUM', 'LOW'].includes(charReq.priority));
});

test('14. VideoModelAdapter generates prompts for Wan, AnimateDiff, and ComfyUI workflows', () => {
  const service = new StoryboardService();
  const result = service.generateStoryboard({ scriptPackage: sampleScript });
  const scene = result.storyboardPackage.scenes[0];

  const wanPayload = VideoModelAdapter.adaptToWan21(scene);
  assert.ok(wanPayload.prompt.length > 0);
  assert.ok(wanPayload.negative_prompt.length > 0);
  assert.equal(wanPayload.num_frames, Math.round(scene.duration_seconds * 24));

  const animPayload = VideoModelAdapter.adaptToAnimateDiff(scene);
  assert.ok(animPayload.positive_prompt.length > 0);
  assert.ok(animPayload.motion_module.length > 0);

  const comfyPayload = VideoModelAdapter.adaptToComfyUI(scene);
  assert.ok(comfyPayload.prompt);
  assert.ok(comfyPayload.extra_data.scene_id === scene.scene_id);
});

test('15. StoryboardRepository stores, retrieves, and versions storyboards in SQLite', () => {
  const db = getFreshDb();
  const projectService = new ProjectService(db);
  const repo = new StoryboardRepository(db);

  const project = projectService.createProject({
    title: sampleScript.topic,
    topic: sampleScript.topic,
    category: 'space'
  }, 'repo-test-key-001');

  const service = new StoryboardService(db);
  const { storyboardPackage, validationReport } = service.generateStoryboard({
    scriptPackage: sampleScript,
    projectId: project.id
  });

  const saved = repo.saveStoryboard(storyboardPackage);
  assert.equal(saved.storyboardVersion, 1);
  assert.equal(saved.projectId, project.id);

  const retrieved = repo.findLatestByProjectId(project.id);
  assert.ok(retrieved);
  assert.equal(retrieved.storyboardPackage.topic, sampleScript.topic);
  assert.equal(retrieved.storyboardPackage.scenes.length, storyboardPackage.scenes.length);

  // Version 2 increment
  storyboardPackage.storyboard_version = 2;
  const savedV2 = repo.saveStoryboard(storyboardPackage);
  assert.equal(savedV2.storyboardVersion, 2);

  repo.recordRevision({
    storyboardId: storyboardPackage.id,
    projectId: project.id,
    version: 2,
    validationOutcome: validationReport.status,
    storyboardJson: storyboardPackage,
    contentHash: storyboardPackage.content_hash
  });

  const history = repo.listRevisionsByProjectId(project.id);
  assert.ok(history.length >= 2);

  closeDatabase(db);
});

test('16. StoryboardService end-to-end creates project records and completes workflow with transitions', () => {
  const db = getFreshDb();
  const projectService = new ProjectService(db);
  const storyboardService = new StoryboardService(db);

  const project = projectService.createProject({
    title: sampleScript.topic,
    topic: sampleScript.topic,
    category: 'space'
  }, 'storyboard-test-key-001');

  // Transition through Phase 1 states
  projectService.transitionProject(project.id, 'PLANNING', 1);
  projectService.transitionProject(project.id, 'PLANNED', 2);
  projectService.transitionProject(project.id, 'GENERATING', 3);

  const result = storyboardService.generateStoryboard({
    scriptPackage: sampleScript,
    projectId: project.id,
    scriptVersion: 1
  });

  assert.equal(result.success, true);
  assert.equal(result.validationReport.valid, true);

  // Transition to REVIEW_READY
  const updatedProject = projectService.transitionProject(project.id, 'REVIEW_READY', 4, {
    storyboard_id: result.storyboardPackage.storyboard_id,
    scene_count: result.storyboardPackage.total_scenes
  });

  assert.equal(updatedProject.status, 'REVIEW_READY');
  assert.equal(updatedProject.version, 5);

  closeDatabase(db);
});

test('17. Canonical scene schema validation rejects malformed scene structures', () => {
  assert.throws(
    () => validateCanonicalScene({ scene_id: 'invalid' }),
    (err) => err instanceof StoryboardValidationError
  );

  assert.throws(
    () => validateStoryboardPackage({ schema_version: '1.0.0' }),
    (err) => err instanceof StoryboardValidationError
  );
});
