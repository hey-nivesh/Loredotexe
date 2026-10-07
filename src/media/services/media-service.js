/**
 * Media Service: Master Orchestrator for Phase 5 Media Generation Engine.
 * Integrates Hardware Detection, Model Adapters, Queue, Validation, and State Management.
 */

import fs from 'node:fs';
import path from 'node:path';
import { HardwareDetector } from '../hardware/hardware-detector.js';
import { HardwareReportService } from '../hardware/hardware-report.js';
import { ModelCapabilityRegistry } from '../registry/model-capability-registry.js';
import { AdapterRegistry } from '../adapters/adapter-registry.js';
import { ScenePromptCompiler } from '../compiler/scene-prompt-compiler.js';
import { ReferenceAssetRegistry } from '../references/reference-asset-registry.js';
import { MediaValidator } from '../validation/media-validator.js';
import { MediaRepository } from '../storage/media-repository.js';
import { AssetRegistry } from '../storage/asset-registry.js';
import { MediaGenerationPlanner } from '../planner/media-generation-planner.js';
import { GenerationQueue } from '../queue/generation-queue.js';
import { DEFAULT_MEDIA_CONFIG, MEDIA_GENERATION_MODES } from '../config/media-config.js';
import { logger } from '../../logging/logger.js';
import { MediaError, MEDIA_ERROR_CODES } from '../errors/media-errors.js';

export class MediaService {
  /**
   * @param {import('node:sqlite').DatabaseSync} [db]
   * @param {object} [config={}]
   * @param {object} [dependencies={}]
   */
  constructor(db = null, config = {}, dependencies = {}) {
    this.db = db;
    this.config = { ...DEFAULT_MEDIA_CONFIG, ...config };
    
    this.repository = db ? new MediaRepository(db) : (dependencies.repository || null);
    this.assetRegistry = new AssetRegistry(this.repository, this.config.outputDir);
    this.hardwareDetector = dependencies.hardwareDetector || new HardwareDetector();
    this.modelRegistry = dependencies.modelRegistry || new ModelCapabilityRegistry();
    this.hardwareReportService = new HardwareReportService(this.hardwareDetector, this.modelRegistry);
    this.adapterRegistry = dependencies.adapterRegistry || new AdapterRegistry(this.config, this.hardwareDetector);
    this.promptCompiler = dependencies.promptCompiler || new ScenePromptCompiler();
    this.referenceRegistry = dependencies.referenceRegistry || new ReferenceAssetRegistry(this.config.referencesDir);
    this.validator = dependencies.validator || new MediaValidator();
    this.planner = dependencies.planner || new MediaGenerationPlanner({
      promptCompiler: this.promptCompiler,
      assetRegistry: this.assetRegistry
    });
  }

  /**
   * Returns a comprehensive hardware capability and model compatibility report.
   * @returns {object}
   */
  getHardwareReport() {
    return this.hardwareReportService.generateReport();
  }

  /**
   * Performs a deterministic Dry-Run pass without generating video media files.
   * @param {object} params
   * @param {object} params.storyboardPackage Phase 4 Storyboard Package
   * @param {string} [params.projectId]
   * @param {object} [params.options={}]
   * @returns {object} Dry-Run Result
   */
  dryRun({ storyboardPackage, projectId = null, options = {} }) {
    logger.info('Executing Phase 5 Media Generation Dry-Run pass');

    const hardwareReport = this.getHardwareReport();
    const resolvedProjectId = projectId || storyboardPackage.project_id || 'PRJ_DRY_RUN';

    // Build reference manifest resolution
    const references = this.referenceRegistry.resolveReferences(
      storyboardPackage.reference_requirements,
      resolvedProjectId
    );

    // Create generation plan
    const plan = this.planner.createPlan(storyboardPackage, {
      projectId: resolvedProjectId,
      provider: options.provider || this.config.defaultProvider,
      model: options.model || this.config.defaultModelVariant,
      force_regenerate: options.force_regenerate === true
    });

    const adapter = this.adapterRegistry.getAdapter(plan.provider);
    const estimatedResources = plan.jobs.map((job) => ({
      scene_id: job.scene_id,
      resources: adapter.estimateResources(job.request)
    }));

    return {
      mode: MEDIA_GENERATION_MODES.DRY_RUN,
      project_id: resolvedProjectId,
      storyboard_version: storyboardPackage.storyboard_version || 1,
      total_scenes: plan.total_scenes,
      reused_scenes_count: plan.reused_scenes_count,
      pending_scenes_count: plan.pending_scenes_count,
      total_estimated_duration_seconds: plan.total_estimated_video_duration_seconds,
      hardware_report: hardwareReport,
      references,
      plan,
      estimated_resources: estimatedResources,
      dry_run_passed: true,
      message: 'Dry-run completed successfully. All scene prompts compiled, resources estimated, and jobs planned.'
    };
  }

  /**
   * Executes the full Phase 5 Media Generation pipeline.
   * @param {object} params
   * @param {object} params.storyboardPackage Canonical Phase 4 storyboard package
   * @param {string} [params.projectId]
   * @param {object} [params.options={}]
   * @returns {Promise<object>} Complete Media Package & Manifest
   */
  async generateMedia({ storyboardPackage, projectId = null, options = {} }) {
    const mode = (options.mode || this.config.generationMode || MEDIA_GENERATION_MODES.MOCK).toLowerCase();
    const resolvedProjectId = projectId || storyboardPackage.project_id;

    logger.info('Starting Phase 5 Media Generation execution', {
      projectId: resolvedProjectId,
      mode,
      provider: options.provider || this.config.defaultProvider
    });

    // 1. If dry-run requested, delegate immediately
    if (mode === MEDIA_GENERATION_MODES.DRY_RUN) {
      return this.dryRun({ storyboardPackage, projectId: resolvedProjectId, options });
    }

    // 2. Resolve Model Adapter
    const providerName = options.provider || this.config.defaultProvider;
    const adapter = this.adapterRegistry.getAdapter(providerName);

    // 3. Validate Adapter Environment
    const envCheck = await adapter.validateEnvironment();
    if (!envCheck.available && mode !== MEDIA_GENERATION_MODES.MOCK) {
      logger.warn('Requested adapter environment is unavailable', envCheck);
      throw new MediaError(envCheck.message || 'Media adapter environment is unavailable.', envCheck.reason || MEDIA_ERROR_CODES.MODEL_NOT_INSTALLED, false, envCheck);
    }

    // 4. Resolve References
    const references = this.referenceRegistry.resolveReferences(
      storyboardPackage.reference_requirements,
      resolvedProjectId
    );

    // 5. Build Execution Plan (Idempotent & Resumable)
    const plan = this.planner.createPlan(storyboardPackage, {
      projectId: resolvedProjectId,
      provider: adapter.getProviderName(),
      model: adapter.getModelName(),
      force_regenerate: options.force_regenerate === true
    });

    // 6. Execute Generation Queue (Sequential Concurrency = 1)
    const queue = new GenerationQueue({
      adapter,
      validator: this.validator,
      assetRegistry: this.assetRegistry,
      repository: this.repository,
      hardwareDetector: this.hardwareDetector,
      maxConcurrentJobs: this.config.maxConcurrentJobs,
      maxRetries: options.maxRetries !== undefined ? options.maxRetries : this.config.maxRetries,
      minFreeDiskGb: this.config.minFreeDiskGb,
      jobTimeoutMs: this.config.jobTimeoutMs
    });

    const queueResult = await queue.processQueue(plan.jobs, {
      projectId: resolvedProjectId,
      generationVersion: plan.generation_version
    });

    // 7. Compile Media Manifest
    const completedAssets = queueResult.completed
      .map((job) => job.result?.asset_metadata)
      .filter(Boolean);

    const manifest = {
      project_id: resolvedProjectId,
      storyboard_version: plan.storyboard_version,
      generation_version: plan.generation_version,
      provider: adapter.getProviderName(),
      model: adapter.getModelName(),
      summary: {
        total_scenes: plan.total_scenes,
        completed: queueResult.completed.length,
        failed: queueResult.failed.length,
        pending: queueResult.pending.length
      },
      assets: completedAssets,
      created_at: new Date().toISOString()
    };

    // 8. Save Manifest to SQLite and Disk
    if (this.repository) {
      this.repository.saveManifest(manifest);
    }

    const manifestDir = this.config.manifestsDir;
    if (!fs.existsSync(manifestDir)) {
      fs.mkdirSync(manifestDir, { recursive: true });
    }
    const manifestPath = path.join(manifestDir, `${resolvedProjectId}_manifest.json`);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    logger.info('Phase 5 Media Generation pipeline finished', {
      projectId: resolvedProjectId,
      completed: manifest.summary.completed,
      failed: manifest.summary.failed
    });

    return {
      success: queueResult.failed.length === 0,
      mode,
      project_id: resolvedProjectId,
      storyboard_version: plan.storyboard_version,
      manifest,
      manifest_path: manifestPath,
      completed_assets_count: manifest.summary.completed,
      failed_assets_count: manifest.summary.failed,
      pending_assets_count: manifest.summary.pending,
      references,
      queue_result: {
        completed_job_ids: queueResult.completed.map((j) => j.id),
        failed_job_ids: queueResult.failed.map((j) => j.id)
      },
      message:
        queueResult.failed.length === 0
          ? 'Phase 5 media generation completed successfully! All canonical scenes converted to validated video clips.'
          : `Phase 5 media generation finished with partial progress (${manifest.summary.completed}/${plan.total_scenes} scenes completed, ${manifest.summary.failed} failed). Resume supported.`
    };
  }

  /**
   * Retrieves the latest manifest for a project.
   * @param {string} projectId
   * @returns {object|null}
   */
  getManifest(projectId) {
    if (this.repository) {
      return this.repository.getManifestByProject(projectId);
    }
    const manifestPath = path.join(this.config.manifestsDir, `${projectId}_manifest.json`);
    if (fs.existsSync(manifestPath)) {
      return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    }
    return null;
  }

  /**
   * Lists all generated media assets for a project.
   * @param {string} projectId
   * @returns {Array<object>}
   */
  listAssets(projectId) {
    if (this.repository) {
      return this.repository.listAssetsByProject(projectId);
    }
    return [];
  }
}
