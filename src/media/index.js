/**
 * Phase 5: Free/Local Media Generation Engine - Public API Exports.
 */

export { MediaService } from './services/media-service.js';
export { HardwareDetector } from './hardware/hardware-detector.js';
export { HardwareReportService } from './hardware/hardware-report.js';
export { ModelCapabilityRegistry, MODEL_SUPPORT_STATUS } from './registry/model-capability-registry.js';
export { VideoModelAdapter } from './adapters/video-model-adapter.js';
export { MockVideoModelAdapter } from './adapters/mock-video-adapter.js';
export { Wan21VideoAdapter } from './adapters/wan21-video-adapter.js';
export { LightweightLocalVideoAdapter } from './adapters/lightweight-local-adapter.js';
export { AdapterRegistry } from './adapters/adapter-registry.js';
export { ScenePromptCompiler } from './compiler/scene-prompt-compiler.js';
export { ReferenceAssetRegistry, REFERENCE_STATUSES } from './references/reference-asset-registry.js';
export { MediaValidator } from './validation/media-validator.js';
export { GenerationQueue } from './queue/generation-queue.js';
export { MediaGenerationPlanner } from './planner/media-generation-planner.js';
export { MediaRepository } from './storage/media-repository.js';
export { AssetRegistry } from './storage/asset-registry.js';
export { DEFAULT_MEDIA_CONFIG, MEDIA_GENERATION_MODES } from './config/media-config.js';
export * from './schema/media-schema.js';
export * from './errors/media-errors.js';
