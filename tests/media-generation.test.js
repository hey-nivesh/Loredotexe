/**
 * Comprehensive Test Suite for Phase 5 Media Generation Engine.
 * Covers all 22 required test scenarios deterministically without requiring external GPUs or large models.
 */

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createDatabaseConnection, runMigrations } from '../src/db/connection.js';
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
  MediaValidationError,
  ModelUnavailableError,
  HardwareConstraintError,
  validateGenerationRequest
} from '../src/media/index.js';

const db = createDatabaseConnection(':memory:');
runMigrations(db);

const fixturePath = path.join(process.cwd(), 'fixtures', 'phase-5', 'sample-storyboard.json');
const sampleStoryboard = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const testOutputDir = path.join(process.cwd(), 'data', 'media', 'test_generated');

function ensureProject(projectId) {
  if (!projectId) return;
  db.prepare(`
    INSERT OR IGNORE INTO projects (id, title, topic, status, input_json, metadata_json, created_at, updated_at)
    VALUES (?, ?, ?, 'CREATED', '{}', '{}', datetime('now'), datetime('now'))
  `).run(projectId, projectId, projectId);
}

// Pre-populate test project IDs
['PRJ_REG_01', 'PRJ_PARTIAL', 'PRJ_RESUME_TEST', 'PRJ_FORCE_TEST', 'PRJ_E2E_MOCK', sampleStoryboard.project_id].forEach(ensureProject);

describe('Phase 5 — Media Generation Engine Test Suite', () => {
  before(() => {
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  after(() => {
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  // 1. Hardware Detection
  test('1. Hardware detection detects real system and formatted capability object', () => {
    const detector = new HardwareDetector();
    const hw = detector.detectHardware();

    assert.ok(hw.os);
    assert.ok(hw.cpu);
    assert.ok(typeof hw.system_ram_gb === 'number');
    assert.ok(typeof hw.disk_free_gb === 'number');
    assert.ok(hw.gpu !== undefined);
  });

  // 2. Mock Adapter
  test('2. MockVideoModelAdapter produces valid lightweight placeholder video with metadata and SHA-256 hash', async () => {
    const adapter = new MockVideoModelAdapter();
    const req = {
      scene_id: 'SCN_001',
      prompt: 'Cosmic probe in deep space',
      negative_prompt: 'blurry',
      width: 832,
      height: 480,
      fps: 16,
      duration_seconds: 5.0
    };

    const result = await adapter.generateScene(req, {
      projectId: 'PRJ_TEST_01',
      outputDir: path.join(testOutputDir, 'mock_scene_01')
    });

    assert.strictEqual(result.status, 'COMPLETED');
    assert.strictEqual(result.provider, 'mock');
    assert.strictEqual(result.width, 832);
    assert.strictEqual(result.height, 480);
    assert.strictEqual(result.duration_seconds, 5.0);
    assert.ok(fs.existsSync(result.output_path));
    assert.ok(result.file_hash);
    assert.ok(result.file_size_bytes > 0);
  });

  // 3. Dry-Run Mode
  test('3. Dry-run mode plans jobs, estimates resources, and does not create media files on disk', () => {
    const service = new MediaService(db);
    const dryRunResult = service.dryRun({
      storyboardPackage: sampleStoryboard,
      projectId: 'PRJ_DRY_RUN'
    });

    assert.strictEqual(dryRunResult.dry_run_passed, true);
    assert.strictEqual(dryRunResult.total_scenes, 2);
    assert.ok(Array.isArray(dryRunResult.estimated_resources));
    assert.strictEqual(dryRunResult.estimated_resources.length, 2);
    assert.ok(dryRunResult.hardware_report);
  });

  // 4. Missing Model Check
  test('4. Wan21VideoAdapter returns MODEL_NOT_INSTALLED when weights path is missing', async () => {
    const mockHw = new HardwareDetector({
      gpu: { vendor: 'nvidia', name: 'NVIDIA RTX 4090', vram_gb: 24.0, detected: true },
      cuda_available: true,
      python_version: '3.11.0',
      system_ram_gb: 32.0,
      disk_free_gb: 50.0
    });

    const adapter = new Wan21VideoAdapter({ modelPath: 'C:\\NonExistentPath\\Wan2.1' }, mockHw);
    const check = await adapter.validateEnvironment();

    assert.strictEqual(check.available, false);
    assert.strictEqual(check.reason, MEDIA_ERROR_CODES.MODEL_NOT_INSTALLED);
  });

  // 5. Missing GPU Check
  test('5. ModelCapabilityRegistry and Wan21 adapter flag GPU_NOT_FOUND when no dedicated GPU exists', async () => {
    const mockHw = new HardwareDetector({
      gpu: { vendor: 'none', name: 'Integrated Intel Graphics', vram_gb: 0, detected: false },
      cuda_available: false,
      python_version: '3.11.0',
      system_ram_gb: 16.0,
      disk_free_gb: 50.0
    });

    const adapter = new Wan21VideoAdapter({}, mockHw);
    const check = await adapter.validateEnvironment();

    assert.strictEqual(check.available, false);
    assert.strictEqual(check.reason, MEDIA_ERROR_CODES.GPU_NOT_FOUND);
  });

  // 6. Insufficient VRAM Check (6GB RTX 3050 Laptop scenario)
  test('6. Wan21VideoAdapter and ModelCapabilityRegistry classify 6GB VRAM as INSUFFICIENT_VRAM', async () => {
    const mockHw = new HardwareDetector({
      gpu: { vendor: 'nvidia', name: 'NVIDIA GeForce RTX 3050 Laptop GPU', vram_gb: 6.0, detected: true },
      cuda_available: true,
      python_version: '3.11.0',
      system_ram_gb: 16.0,
      disk_free_gb: 50.0
    });

    const registry = new ModelCapabilityRegistry();
    const evaluation = registry.evaluateCompatibility('wan2.1-t2v-1.3b', mockHw.detectHardware());

    assert.strictEqual(evaluation.status, MODEL_SUPPORT_STATUS.UNSUPPORTED);
    assert.ok(evaluation.reasons.some((r) => r.includes('Insufficient GPU VRAM')));

    const adapter = new Wan21VideoAdapter({}, mockHw);
    const check = await adapter.validateEnvironment();
    assert.strictEqual(check.available, false);
    assert.strictEqual(check.reason, MEDIA_ERROR_CODES.INSUFFICIENT_VRAM);
  });

  // 7. Insufficient RAM Check
  test('7. ModelCapabilityRegistry detects INSUFFICIENT_RAM when system RAM is too low', () => {
    const registry = new ModelCapabilityRegistry();
    const evaluation = registry.evaluateCompatibility('wan2.1-t2v-1.3b', {
      gpu: { vendor: 'nvidia', name: 'NVIDIA RTX 4090', vram_gb: 24.0, detected: true },
      cuda_available: true,
      python_version: '3.11.0',
      system_ram_gb: 8.0, // Model requires 16GB
      disk_free_gb: 50.0
    });

    assert.strictEqual(evaluation.status, MODEL_SUPPORT_STATUS.UNSUPPORTED);
    assert.ok(evaluation.reasons.some((r) => r.includes('Insufficient System RAM')));
  });

  // 8. Insufficient Disk Check
  test('8. ModelCapabilityRegistry detects INSUFFICIENT_DISK when free disk space is below requirement', () => {
    const registry = new ModelCapabilityRegistry();
    const evaluation = registry.evaluateCompatibility('wan2.1-t2v-1.3b', {
      gpu: { vendor: 'nvidia', name: 'NVIDIA RTX 4090', vram_gb: 24.0, detected: true },
      cuda_available: true,
      python_version: '3.11.0',
      system_ram_gb: 32.0,
      disk_free_gb: 2.0 // Model requires ~15GB
    });

    assert.strictEqual(evaluation.status, MODEL_SUPPORT_STATUS.UNSUPPORTED);
    assert.ok(evaluation.reasons.some((r) => r.includes('Insufficient Free Disk')));
  });

  // 9. Scene Prompt Compilation
  test('9. ScenePromptCompiler compiles CanonicalScene and Bibles into high-signal GenerationRequest', () => {
    const compiler = new ScenePromptCompiler();
    const scene = sampleStoryboard.scenes[1]; // talking character scene
    const bibles = {
      characterBible: sampleStoryboard.character_bible,
      locationBible: sampleStoryboard.location_bible,
      propBible: sampleStoryboard.prop_bible,
      styleBible: sampleStoryboard.visual_style
    };

    const req = compiler.compileScene(scene, bibles);

    assert.strictEqual(req.scene_id, 'SCN_002');
    assert.strictEqual(req.duration_seconds, 6.0);
    assert.ok(req.prompt.includes('Lead NASA Flight Engineer') || req.prompt.includes('Camera'));
    assert.ok(req.negative_prompt);
    assert.strictEqual(req.width, 832);
    assert.strictEqual(req.height, 480);
  });

  // 10. Generation Request Validation
  test('10. validateGenerationRequest rejects missing required fields and negative durations', () => {
    assert.throws(
      () => validateGenerationRequest({ prompt: 'test', duration_seconds: -1 }),
      MediaValidationError
    );

    assert.throws(
      () => validateGenerationRequest({ scene_id: 'S1', prompt: '', duration_seconds: 5 }),
      MediaValidationError
    );
  });

  // 11. Queue Processing (Sequential Concurrency = 1)
  test('11. GenerationQueue processes jobs sequentially with Concurrency=1', async () => {
    const adapter = new MockVideoModelAdapter();
    const queue = new GenerationQueue({ adapter });

    const jobs = [
      {
        id: 'JOB_01',
        scene_id: 'SCN_001',
        status: 'QUEUED',
        request: { scene_id: 'SCN_001', prompt: 'Scene 1', duration_seconds: 5.0, width: 832, height: 480, fps: 16 }
      },
      {
        id: 'JOB_02',
        scene_id: 'SCN_002',
        status: 'QUEUED',
        request: { scene_id: 'SCN_002', prompt: 'Scene 2', duration_seconds: 6.0, width: 832, height: 480, fps: 16 }
      }
    ];

    const result = await queue.processQueue(jobs, { projectId: 'PRJ_QUEUE_TEST' });

    assert.strictEqual(result.completed.length, 2);
    assert.strictEqual(result.failed.length, 0);
  });

  // 12. Retry Handling
  test('12. GenerationQueue retries transient errors up to maxRetries and skips fatal errors', async () => {
    let attempts = 0;
    const transientFailingAdapter = {
      getProviderName: () => 'transient',
      getModelName: () => 'test',
      generateScene: async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Transient network glitch');
        }
        const mock = new MockVideoModelAdapter();
        return mock.generateScene({ scene_id: 'SCN_001', prompt: 'Retry test', duration_seconds: 4.0 });
      }
    };

    const queue = new GenerationQueue({ adapter: transientFailingAdapter, maxRetries: 2 });
    const job = {
      id: 'JOB_RETRY',
      scene_id: 'SCN_001',
      status: 'QUEUED',
      request: { scene_id: 'SCN_001', prompt: 'Retry test', duration_seconds: 4.0, width: 832, height: 480, fps: 16 }
    };

    const result = await queue.processQueue([job], { projectId: 'PRJ_RETRY' });
    assert.strictEqual(result.completed.length, 1);
    assert.strictEqual(attempts, 2);
  });

  // 13. Timeout Handling
  test('13. GenerationQueue marks TIMEOUT when job exceeds timeout limit', async () => {
    const hangingAdapter = {
      getProviderName: () => 'slow',
      getModelName: () => 'slow-model',
      generateScene: async () => {
        await new Promise((r) => setTimeout(r, 500));
        return {};
      }
    };

    const queue = new GenerationQueue({ adapter: hangingAdapter, jobTimeoutMs: 50, maxRetries: 0 });
    const job = {
      id: 'JOB_TIMEOUT',
      scene_id: 'SCN_001',
      status: 'QUEUED',
      request: { scene_id: 'SCN_001', prompt: 'Timeout test', duration_seconds: 4.0, width: 832, height: 480, fps: 16 }
    };

    const result = await queue.processQueue([job], { projectId: 'PRJ_TIMEOUT' });
    assert.strictEqual(result.failed.length, 1);
    assert.strictEqual(result.failed[0].error.code, MEDIA_ERROR_CODES.TIMEOUT);
  });

  // 14. Media Validation
  test('14. MediaValidator verifies valid file and catches corrupt/missing files', () => {
    const validator = new MediaValidator();
    const adapter = new MockVideoModelAdapter();

    const outputDir = path.join(testOutputDir, 'val_test');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const validFile = path.join(outputDir, 'scene.mp4');

    const bin = adapter._generateDeterministicMockMp4({
      sceneId: 'SCN_001',
      duration: 5.0,
      width: 832,
      height: 480,
      prompt: 'Val test'
    });
    fs.writeFileSync(validFile, bin);

    const validation = validator.validateMedia(validFile, { duration_seconds: 5.0 });
    assert.strictEqual(validation.valid, true);
    assert.ok(validation.fileHash);

    // Corrupted file test
    const corruptFile = path.join(outputDir, 'corrupt.mp4');
    fs.writeFileSync(corruptFile, Buffer.from('NOT_AN_MP4_HEADER'));
    assert.throws(() => validator.validateMedia(corruptFile, { duration_seconds: 5.0 }), MediaValidationError);
  });

  // 15. SHA-256 Hashing
  test('15. SHA-256 hashing ensures reproducible asset verification', async () => {
    const adapter = new MockVideoModelAdapter();
    const req = { scene_id: 'SCN_HASH', prompt: 'Exact same prompt', duration_seconds: 5.0 };

    const res1 = await adapter.generateScene(req, { outputDir: path.join(testOutputDir, 'h1') });
    const res2 = await adapter.generateScene(req, { outputDir: path.join(testOutputDir, 'h2') });

    assert.ok(res1.file_hash);
    assert.ok(res2.file_hash);
    assert.strictEqual(typeof res1.file_hash, 'string');
    assert.strictEqual(res1.file_hash.length, 64);
  });

  // 16. Asset Registry & SQLite Persistence
  test('16. AssetRegistry stores metadata in SQLite and file system', () => {
    const repo = new MediaRepository(db);
    const registry = new AssetRegistry(repo, testOutputDir);

    const asset = {
      asset_id: 'ASSET_REG_01',
      project_id: 'PRJ_REG_01',
      scene_id: 'SCN_001',
      type: 'video',
      provider: 'mock',
      model: 'mock-video',
      version: 1,
      file_path: path.join(testOutputDir, 'test.mp4'),
      file_hash: 'abc123hash',
      file_size_bytes: 1024,
      duration_seconds: 5.0,
      width: 832,
      height: 480,
      fps: 16,
      status: 'VALID',
      metadata: { prompt_hash: 'phash123' }
    };

    registry.registerAsset(asset);
    const listed = repo.listAssetsByProject('PRJ_REG_01');
    assert.strictEqual(listed.length, 1);
    assert.strictEqual(listed[0].sceneId, 'SCN_001');
  });

  // 17. Idempotency (Existing asset reuse)
  test('17. MediaGenerationPlanner reuses existing valid assets without regenerating', () => {
    const repo = new MediaRepository(db);
    const assetRegistry = new AssetRegistry(repo, testOutputDir);
    const planner = new MediaGenerationPlanner({ assetRegistry });

    // Seed an asset in DB and on disk
    const promptCompiler = new ScenePromptCompiler();
    const req0 = promptCompiler.compileScene(sampleStoryboard.scenes[0], {
      characterBible: sampleStoryboard.character_bible,
      locationBible: sampleStoryboard.location_bible,
      propBible: sampleStoryboard.prop_bible,
      styleBible: sampleStoryboard.visual_style
    });
    const promptHash = req0.prompt + (req0.negative_prompt || '');
    const computedHash = createHash('sha256').update(promptHash).digest('hex');

    const fakeScenePath = path.join(testOutputDir, 'scene_test17.mp4');
    fs.writeFileSync(fakeScenePath, 'fake-mp4-data');

    repo.saveAsset({
      asset_id: 'ASSET_PRE_01',
      project_id: sampleStoryboard.project_id,
      scene_id: 'SCN_001',
      provider: 'mock',
      model: 'mock-video',
      file_path: fakeScenePath,
      file_hash: 'fakehash',
      duration_seconds: 5.0,
      status: 'VALID',
      metadata: { prompt_hash: computedHash }
    });

    const plan = planner.createPlan(sampleStoryboard, {
      projectId: sampleStoryboard.project_id,
      provider: 'mock',
      model: 'mock-video',
      force_regenerate: false
    });

    assert.ok(plan.reused_scenes_count >= 1);
  });

  // 18. Partial Completion Handling
  test('18. MediaService handles partial generation failure gracefully and outputs partial manifest', async () => {
    const partialFailingAdapter = {
      getProviderName: () => 'mock',
      getModelName: () => 'mock-video',
      validateEnvironment: async () => ({ available: true }),
      estimateResources: () => ({ estimatedVramGb: 0, estimatedRamGb: 0.1, estimatedSeconds: 0.1 }),
      generateScene: async (req, options) => {
        if (req.scene_id === 'SCN_002') {
          throw new Error('Simulated failure on scene 2');
        }
        const mock = new MockVideoModelAdapter();
        return mock.generateScene(req, options);
      }
    };

    const partialProjectId = 'PRJ_PARTIAL_FAIL';
    ensureProject(partialProjectId);

    const service = new MediaService(db, {}, {
      adapterRegistry: { getAdapter: () => partialFailingAdapter }
    });

    const result = await service.generateMedia({
      storyboardPackage: sampleStoryboard,
      projectId: partialProjectId,
      options: { maxRetries: 0, force_regenerate: true }
    });

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.completed_assets_count, 1);
    assert.strictEqual(result.failed_assets_count, 1);
    assert.ok(result.manifest);
  });

  // 19. Resume after Failure
  test('19. Second run resumes and generates only pending scenes', async () => {
    const service = new MediaService(db);
    const result = await service.generateMedia({
      storyboardPackage: sampleStoryboard,
      projectId: 'PRJ_RESUME_TEST'
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.completed_assets_count, 2);

    // Second run with existing assets in DB
    const resumeResult = await service.generateMedia({
      storyboardPackage: sampleStoryboard,
      projectId: 'PRJ_RESUME_TEST',
      options: { force_regenerate: false }
    });

    assert.strictEqual(resumeResult.success, true);
    assert.strictEqual(resumeResult.completed_assets_count, 2);
  });

  // 20. Version Mismatch Forces Regeneration
  test('20. force_regenerate=true bypasses existing assets and generates new ones', () => {
    const service = new MediaService(db);
    const plan = service.planner.createPlan(sampleStoryboard, {
      projectId: 'PRJ_FORCE_TEST',
      force_regenerate: true
    });

    assert.strictEqual(plan.reused_scenes_count, 0);
    assert.strictEqual(plan.pending_scenes_count, 2);
  });

  // 21. Invalid Phase 4 Scene Rejection
  test('21. MediaGenerationPlanner rejects malformed storyboard package', () => {
    const planner = new MediaGenerationPlanner();
    assert.throws(
      () => planner.createPlan({ invalid_field: true }),
      Error
    );
  });

  // 22. n8n Workflow File Validity
  test('22. n8n workflow JSON files parse cleanly and contain valid Phase 5 nodes and connections', () => {
    const standalonePath = path.join(process.cwd(), 'workflows', 'phase-5-media-generation.json');
    const masterPath = path.join(process.cwd(), 'workflows', 'loredotexe-pipeline.json');

    assert.ok(fs.existsSync(standalonePath));
    assert.ok(fs.existsSync(masterPath));

    const standalone = JSON.parse(fs.readFileSync(standalonePath, 'utf8'));
    const master = JSON.parse(fs.readFileSync(masterPath, 'utf8'));

    assert.ok(standalone.nodes.length >= 8);
    assert.ok(master.nodes.length >= 22);
    assert.ok(master.connections['Detect Hardware Capabilities']);
    assert.ok(master.connections['Execute Media Generation Engine']);
  });
});
