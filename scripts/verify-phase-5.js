#!/usr/bin/env node
/**
 * Verification Suite for Loredotexe Phase 5 Requirements.
 * Validates Media Generation Engine, Hardware Detection, Mock & Dry-Run Modes,
 * VideoModelAdapter, Queue, Validation, and Idempotent Manifest Assembly.
 */

import assert from 'node:assert/strict';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDatabaseConnection, runMigrations } from '../src/db/connection.js';
import { ProjectService } from '../src/projects/project.service.js';
import {
  MediaService,
  HardwareDetector,
  HardwareReportService,
  ModelCapabilityRegistry,
  MODEL_SUPPORT_STATUS,
  MockVideoModelAdapter,
  Wan21VideoAdapter,
  LightweightLocalVideoAdapter,
  AdapterRegistry,
  ScenePromptCompiler,
  ReferenceAssetRegistry,
  MediaValidator,
  GenerationQueue,
  MediaGenerationPlanner,
  MediaRepository,
  AssetRegistry,
  MEDIA_ERROR_CODES,
  validateGenerationRequest
} from '../src/media/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sampleStoryboard = JSON.parse(
  readFileSync(resolve(__dirname, '../fixtures/phase-5/sample-storyboard.json'), 'utf-8')
);

console.log('===============================================================');
console.log('         Loredotexe — Phase 5 Verification Suite              ');
console.log('    Free/Local Media Generation Engine & Hardware Evaluator    ');
console.log('===============================================================');
console.log('');

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

async function runCheck(name, fn) {
  totalChecks++;
  try {
    await fn();
    console.log(`  [PASS] Check ${totalChecks}: ${name}`);
    passedChecks++;
  } catch (err) {
    console.error(`  [FAIL] Check ${totalChecks}: ${name}`);
    console.error(`         Error: ${err.message}`);
    failedChecks++;
  }
}

async function main() {
  const db = createDatabaseConnection(':memory:');
  runMigrations(db);

  // 1. Hardware Detection
  await runCheck('HardwareDetector inspects system capabilities', () => {
    const detector = new HardwareDetector();
    const hw = detector.detectHardware();
    assert.ok(hw.os);
    assert.ok(hw.cpu);
    assert.ok(typeof hw.system_ram_gb === 'number');
    assert.ok(typeof hw.disk_free_gb === 'number');
    assert.ok(hw.gpu !== undefined);
  });

  // 2. Hardware Report & Model Compatibility
  await runCheck('HardwareReportService correctly evaluates 6GB GPU and Python 3.13 constraints', () => {
    const detector = new HardwareDetector();
    const reportService = new HardwareReportService(detector);
    const report = reportService.generateReport();
    assert.ok(report.hardware);
    assert.ok(report.model_evaluations['wan2.1-t2v-1.3b']);
    assert.strictEqual(report.model_evaluations['wan2.1-t2v-1.3b'].status, MODEL_SUPPORT_STATUS.UNSUPPORTED);
    assert.ok(report.recommended_mode);
  });

  // 3. Mock Video Model Adapter
  await runCheck('MockVideoModelAdapter generates valid MP4 placeholder media and SHA-256 hash', async () => {
    const adapter = new MockVideoModelAdapter();
    const req = {
      scene_id: 'SCN_001',
      prompt: 'Voyager drifting in deep space',
      duration_seconds: 5.0,
      width: 832,
      height: 480,
      fps: 16
    };
    const result = await adapter.generateScene(req, { projectId: 'PRJ_V_MOCK' });
    assert.strictEqual(result.status, 'COMPLETED');
    assert.strictEqual(result.width, 832);
    assert.strictEqual(result.height, 480);
    assert.strictEqual(result.duration_seconds, 5.0);
    assert.ok(existsSync(result.output_path));
    assert.ok(result.file_hash);
  });

  // 4. Wan2.1 Safe Non-Download Policy
  await runCheck('Wan21VideoAdapter enforces safe non-download and returns MODEL_NOT_INSTALLED', async () => {
    const adapter = new Wan21VideoAdapter({ modelPath: 'C:\\NonExistentPath' });
    const check = await adapter.validateEnvironment();
    assert.strictEqual(check.available, false);
    assert.ok([MEDIA_ERROR_CODES.MODEL_NOT_INSTALLED, MEDIA_ERROR_CODES.INSUFFICIENT_VRAM, MEDIA_ERROR_CODES.PYTHON_VERSION_UNSUPPORTED].includes(check.reason));
  });

  // 5. Lightweight Local Video Adapter Interface
  await runCheck('LightweightLocalVideoAdapter exposes clean VideoModelAdapter interface', async () => {
    const adapter = new LightweightLocalVideoAdapter();
    assert.strictEqual(adapter.getProviderName(), 'lightweight');
    assert.strictEqual(adapter.getModelName(), 'lightweight-local');
    const caps = adapter.getCapabilities();
    assert.strictEqual(caps.targetGpuVramGb, 6.0);
  });

  // 6. Scene Prompt Compiler
  await runCheck('ScenePromptCompiler compiles CanonicalScene into focused GenerationRequest', () => {
    const compiler = new ScenePromptCompiler();
    const scene = sampleStoryboard.scenes[0];
    const req = compiler.compileScene(scene, {
      styleBible: sampleStoryboard.visual_style,
      locationBible: sampleStoryboard.location_bible,
      propBible: sampleStoryboard.prop_bible
    });
    assert.strictEqual(req.scene_id, 'SCN_001');
    assert.strictEqual(req.duration_seconds, 5.0);
    assert.ok(req.prompt.length > 20);
    assert.ok(req.negative_prompt);
  });

  // 7. Reference Asset Registry
  await runCheck('ReferenceAssetRegistry tracks and resolves reference requirements', () => {
    const registry = new ReferenceAssetRegistry();
    const resolved = registry.resolveReferences(sampleStoryboard.reference_requirements, 'PRJ_TEST');
    assert.strictEqual(resolved.total_required, 2);
    assert.ok(['TEXT_ONLY', 'REFERENCE_AWARE'].includes(resolved.mode));
  });

  // 8. Media Validator
  await runCheck('MediaValidator validates file headers, duration bounds, and SHA-256 integrity', () => {
    const validator = new MediaValidator();
    const adapter = new MockVideoModelAdapter();
    const bin = adapter._generateDeterministicMockMp4({
      sceneId: 'SCN_001',
      duration: 5.0,
      width: 832,
      height: 480,
      prompt: 'Test prompt'
    });
    const tmpDir = resolve(__dirname, '../data/media/temp');
    mkdirSync(tmpDir, { recursive: true });
    const tmpPath = resolve(tmpDir, 'val_test.mp4');
    writeFileSync(tmpPath, bin);

    const check = validator.validateAsset(tmpPath, {
      expectedDuration: 5.0,
      expectedWidth: 832,
      expectedHeight: 480
    });
    assert.strictEqual(check.valid, true);
    assert.strictEqual(check.width, 832);
    assert.strictEqual(check.height, 480);
    assert.ok(check.hash);
  });

  // 9. Media Generation Planner (Idempotency & Resumability)
  await runCheck('MediaGenerationPlanner creates idempotent plan with reuse detection', () => {
    const planner = new MediaGenerationPlanner();
    const plan = planner.createPlan(sampleStoryboard, {
      projectId: 'PRJ_PLANNER_TEST',
      provider: 'mock'
    });
    assert.strictEqual(plan.total_scenes, 2);
    assert.strictEqual(plan.jobs.length, 2);
    assert.strictEqual(plan.jobs[0].scene_id, 'SCN_001');
    assert.strictEqual(plan.jobs[1].scene_id, 'SCN_002');
  });

  // 10. End-to-End Dry-Run Pass
  await runCheck('MediaService executes complete Dry-Run pass without media files', () => {
    const mediaService = new MediaService(db);
    const dryRun = mediaService.dryRun({
      storyboardPackage: sampleStoryboard,
      projectId: 'PRJ_E2E_DRY'
    });
    assert.strictEqual(dryRun.dry_run_passed, true);
    assert.strictEqual(dryRun.total_scenes, 2);
    assert.ok(dryRun.hardware_report);
  });

  // 11. End-to-End Media Generation (Mock Mode) & Manifest Output
  const projectService = new ProjectService(db);
  const project = projectService.createProject({
    title: sampleStoryboard.topic,
    topic: sampleStoryboard.topic
  });
  const projectId = project.id;

  await runCheck('MediaService generates complete validated media package with manifest', async () => {
    const mediaService = new MediaService(db);
    const result = await mediaService.generateMedia({
      storyboardPackage: sampleStoryboard,
      projectId: projectId,
      options: { mode: 'mock', provider: 'mock' }
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.completed_assets_count, 2);
    assert.strictEqual(result.failed_assets_count, 0);
    assert.ok(result.manifest);
    assert.strictEqual(result.manifest.summary.completed, 2);
    assert.ok(existsSync(result.manifest_path));
  });

  // 12. SQLite Media Persistence
  await runCheck('MediaRepository persists and retrieves jobs, assets, and manifests', () => {
    const repo = new MediaRepository(db);
    const jobs = repo.listJobsByProject(projectId);
    const assets = repo.listAssetsByProject(projectId);
    const manifest = repo.getManifestByProject(projectId);

    assert.ok(jobs.length >= 2);
    assert.strictEqual(assets.length, 2);
    assert.ok(manifest);
    assert.strictEqual(manifest.project_id, projectId);
  });

  console.log('');
  console.log('===============================================================');
  console.log(` Checks: ${totalChecks} total, ${passedChecks} passed, ${failedChecks} failed`);
  if (failedChecks === 0) {
    console.log(' Phase 5 Verification: ALL CHECKS PASSED');
  } else {
    console.log(' Phase 5 Verification: FAILED');
    process.exitCode = 1;
  }
  console.log('===============================================================');
}

main();
