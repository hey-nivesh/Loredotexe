/**
 * Configuration and Environment Defaults for Phase 5 Media Generation Engine.
 */

import path from 'node:path';

export const MEDIA_GENERATION_MODES = Object.freeze({
  MOCK: 'mock',
  DRY_RUN: 'dry-run',
  LOCAL: 'local'
});

export const DEFAULT_MEDIA_CONFIG = Object.freeze({
  generationEnabled: process.env.MEDIA_GENERATION_ENABLED !== 'false',
  generationMode: (process.env.MEDIA_GENERATION_MODE || 'mock').toLowerCase(),
  outputDir: process.env.MEDIA_OUTPUT_DIR || path.join(process.cwd(), 'data', 'media', 'generated'),
  tempDir: process.env.MEDIA_TEMP_DIR || path.join(process.cwd(), 'data', 'media', 'temp'),
  referencesDir: process.env.MEDIA_REFERENCES_DIR || path.join(process.cwd(), 'data', 'media', 'references'),
  manifestsDir: path.join(process.cwd(), 'data', 'media', 'manifests'),
  
  // Safe model policy - strict default is false
  allowModelDownload: process.env.MEDIA_ALLOW_MODEL_DOWNLOAD === 'true',
  
  // Provider settings
  defaultProvider: process.env.VIDEO_MODEL_PROVIDER || 'mock',
  defaultModelVariant: process.env.VIDEO_MODEL_VARIANT || 'mock-video',
  modelPath: process.env.VIDEO_MODEL_PATH || null,
  
  // Video generation defaults
  defaultWidth: parseInt(process.env.VIDEO_DEFAULT_WIDTH || '832', 10),
  defaultHeight: parseInt(process.env.VIDEO_DEFAULT_HEIGHT || '480', 10),
  defaultFps: parseInt(process.env.VIDEO_DEFAULT_FPS || '16', 10),
  defaultDurationSeconds: parseFloat(process.env.VIDEO_DEFAULT_DURATION_SECONDS || '5.0'),
  
  // Memory offload settings
  offloadModel: process.env.VIDEO_OFFLOAD_MODEL !== 'false',
  t5Cpu: process.env.VIDEO_T5_CPU !== 'false',
  
  // Queue & Resource bounds
  maxConcurrentJobs: parseInt(process.env.VIDEO_MAX_CONCURRENT_JOBS || '1', 10),
  maxRetries: parseInt(process.env.MEDIA_MAX_RETRIES || '2', 10),
  minFreeDiskGb: parseFloat(process.env.MEDIA_MIN_FREE_DISK_GB || '5.0'),
  minRamGb: 8.0,
  minVramGb: 6.0,
  jobTimeoutMs: parseInt(process.env.MEDIA_JOB_TIMEOUT_MS || '180000', 10),
  
  // Validation
  validationEnabled: process.env.MEDIA_VALIDATION_ENABLED !== 'false',
  durationToleranceSeconds: parseFloat(process.env.MEDIA_DURATION_TOLERANCE_SECONDS || '0.75')
});
