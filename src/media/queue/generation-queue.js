/**
 * Generation Queue for Phase 5 Media Generation Engine.
 * Enforces sequential concurrency=1, resource-aware scheduling, timeout handling, and retry policies.
 */

import { HardwareDetector } from '../hardware/hardware-detector.js';
import { MediaValidator } from '../validation/media-validator.js';
import { AssetRegistry } from '../storage/asset-registry.js';
import { MediaRepository } from '../storage/media-repository.js';
import {
  MEDIA_ERROR_CODES,
  HardwareConstraintError,
  GenerationTimeoutError
} from '../errors/media-errors.js';
import { JOB_STATUSES } from '../schema/media-schema.js';
import { DEFAULT_MEDIA_CONFIG } from '../config/media-config.js';
import { logger } from '../../logging/logger.js';

export class GenerationQueue {
  /**
   * @param {object} options
   * @param {import('../adapters/video-model-adapter.js').VideoModelAdapter} options.adapter
   * @param {MediaValidator} [options.validator]
   * @param {AssetRegistry} [options.assetRegistry]
   * @param {MediaRepository} [options.repository]
   * @param {HardwareDetector} [options.hardwareDetector]
   * @param {number} [options.maxConcurrentJobs=1]
   * @param {number} [options.maxRetries=2]
   * @param {number} [options.minFreeDiskGb=5.0]
   * @param {number} [options.jobTimeoutMs=180000]
   */
  constructor(options = {}) {
    this.adapter = options.adapter;
    this.validator = options.validator || new MediaValidator();
    this.assetRegistry = options.assetRegistry || new AssetRegistry();
    this.repository = options.repository || null;
    this.hardwareDetector = options.hardwareDetector || new HardwareDetector();
    this.maxConcurrentJobs = options.maxConcurrentJobs || DEFAULT_MEDIA_CONFIG.maxConcurrentJobs;
    this.maxRetries = options.maxRetries !== undefined ? options.maxRetries : DEFAULT_MEDIA_CONFIG.maxRetries;
    this.minFreeDiskGb = options.minFreeDiskGb || DEFAULT_MEDIA_CONFIG.minFreeDiskGb;
    this.jobTimeoutMs = options.jobTimeoutMs || DEFAULT_MEDIA_CONFIG.jobTimeoutMs;
  }

  /**
   * Processes a list of generation jobs sequentially.
   * @param {Array<object>} jobs List of generation jobs
   * @param {object} [context={}] Execution context (projectId, storyboardVersion, etc.)
   * @returns {Promise<{ completed: Array<object>, failed: Array<object>, pending: Array<object> }>}
   */
  async processQueue(jobs = [], context = {}) {
    const completed = [];
    const failed = [];
    const pending = [];

    logger.info('Starting Generation Queue execution', {
      totalJobs: jobs.length,
      provider: this.adapter.getProviderName(),
      model: this.adapter.getModelName(),
      concurrency: this.maxConcurrentJobs
    });

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];

      // Check if already completed (e.g. from resume)
      if (job.status === JOB_STATUSES.COMPLETED && job.result) {
        completed.push(job);
        continue;
      }

      // 1. Proactive Resource Check before starting each job
      const resourceCheck = this._checkSystemResources();
      if (!resourceCheck.sufficient) {
        const errorDetails = {
          code: resourceCheck.code,
          reason: resourceCheck.reason,
          freeDiskGb: resourceCheck.freeDiskGb
        };
        logger.error('Aborting job execution due to resource constraint', errorDetails);

        job.status = JOB_STATUSES.FAILED;
        job.error = errorDetails;
        if (this.repository) this.repository.saveJob(job);
        failed.push(job);

        // Mark remaining unstarted jobs as pending
        for (let j = i + 1; j < jobs.length; j++) {
          pending.push(jobs[j]);
        }
        break;
      }

      // 2. Execute Job with Retries and Timeout
      const executedJob = await this._executeJobWithRetries(job, context);

      if (executedJob.status === JOB_STATUSES.COMPLETED) {
        completed.push(executedJob);
      } else {
        failed.push(executedJob);
      }
    }

    return { completed, failed, pending };
  }

  /**
   * Executes a single job with controlled retries for transient errors.
   * @private
   */
  async _executeJobWithRetries(job, context) {
    job.status = JOB_STATUSES.VALIDATING;
    job.started_at = new Date().toISOString();
    if (this.repository) this.repository.saveJob(job);

    let attempt = 0;
    let lastError = null;

    while (attempt <= this.maxRetries) {
      attempt++;
      job.attempt = attempt;

      try {
        job.status = JOB_STATUSES.GENERATING;
        if (this.repository) this.repository.saveJob(job);

        // Execute adapter generation wrapped in timeout
        const generationResult = await this._executeWithTimeout(
          this.adapter.generateScene(job.request, {
            projectId: context.projectId,
            version: context.generationVersion || 1,
            sceneId: job.scene_id
          }),
          this.jobTimeoutMs
        );

        // Validate Output Media
        job.status = JOB_STATUSES.VALIDATING_OUTPUT;
        const validation = this.validator.validateMedia(generationResult.output_path, {
          duration_seconds: job.request.duration_seconds,
          width: job.request.width,
          height: job.request.height,
          fps: job.request.fps
        });

        // Register Asset
        const assetMetadata = generationResult.metadata || {
          asset_id: generationResult.asset_id || `ASSET_${job.scene_id}_v1`,
          project_id: context.projectId,
          scene_id: job.scene_id,
          type: 'video',
          provider: this.adapter.getProviderName(),
          model: this.adapter.getModelName(),
          version: context.generationVersion || 1,
          file_path: generationResult.output_path,
          file_hash: validation.fileHash,
          prompt_hash: job.prompt_hash,
          duration_seconds: validation.duration,
          width: validation.width,
          height: validation.height,
          fps: validation.fps,
          file_size_bytes: validation.fileSizeBytes,
          created_at: new Date().toISOString(),
          status: 'VALID'
        };

        this.assetRegistry.registerAsset(assetMetadata);

        job.status = JOB_STATUSES.COMPLETED;
        job.result = {
          output_path: generationResult.output_path,
          file_hash: validation.fileHash,
          duration: validation.duration,
          file_size_bytes: validation.fileSizeBytes,
          asset_metadata: assetMetadata
        };
        job.completed_at = new Date().toISOString();
        if (this.repository) this.repository.saveJob(job);

        logger.info('Scene generation job completed successfully', {
          jobId: job.id,
          sceneId: job.scene_id,
          attempt
        });

        return job;
      } catch (err) {
        lastError = err;
        const isNonRetryable = this._isNonRetryableError(err);

        logger.warn('Job generation attempt failed', {
          jobId: job.id,
          sceneId: job.scene_id,
          attempt,
          error: err.message,
          code: err.mediaErrorCode || err.name,
          isNonRetryable
        });

        if (isNonRetryable || attempt > this.maxRetries) {
          break;
        }

        job.status = JOB_STATUSES.RETRYING;
        if (this.repository) this.repository.saveJob(job);
      }
    }

    // Mark Job as FAILED
    job.status = JOB_STATUSES.FAILED;
    job.error = {
      message: lastError ? lastError.message : 'Unknown generation error',
      code: lastError?.mediaErrorCode || MEDIA_ERROR_CODES.GENERATION_FAILED,
      attempts: attempt
    };
    job.completed_at = new Date().toISOString();
    if (this.repository) this.repository.saveJob(job);

    return job;
  }

  /**
   * Executes a promise with a strict timeout rejection.
   * @private
   */
  async _executeWithTimeout(promise, timeoutMs) {
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new GenerationTimeoutError(`Generation job exceeded timeout of ${timeoutMs}ms.`));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timer);
      return result;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  /**
   * Inspects free disk space and resources before job launch.
   * @private
   */
  _checkSystemResources() {
    const hw = this.hardwareDetector.detectHardware();
    const freeDisk = hw.disk_free_gb || 0;

    if (freeDisk < this.minFreeDiskGb) {
      return {
        sufficient: false,
        code: MEDIA_ERROR_CODES.INSUFFICIENT_DISK,
        reason: `Available disk space (${freeDisk} GB) is below minimum safety threshold (${this.minFreeDiskGb} GB).`,
        freeDiskGb: freeDisk
      };
    }

    return { sufficient: true, freeDiskGb: freeDisk };
  }

  /**
   * Determines if an error is non-retryable (fatal configuration/hardware failure).
   * @private
   */
  _isNonRetryableError(err) {
    const code = err.mediaErrorCode || err.code;
    const nonRetryableCodes = [
      MEDIA_ERROR_CODES.GPU_NOT_FOUND,
      MEDIA_ERROR_CODES.CUDA_UNAVAILABLE,
      MEDIA_ERROR_CODES.INSUFFICIENT_VRAM,
      MEDIA_ERROR_CODES.INSUFFICIENT_RAM,
      MEDIA_ERROR_CODES.INSUFFICIENT_DISK,
      MEDIA_ERROR_CODES.MODEL_NOT_INSTALLED,
      MEDIA_ERROR_CODES.PYTHON_VERSION_UNSUPPORTED,
      MEDIA_ERROR_CODES.INVALID_SCENE,
      MEDIA_ERROR_CODES.INVALID_PROMPT
    ];

    return nonRetryableCodes.includes(code);
  }
}
