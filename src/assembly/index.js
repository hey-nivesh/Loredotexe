/**
 * Phase 6 Audio & Video Assembly Engine Barrel Exports.
 */

export * from './config/assembly-config.js';
export * from './errors/assembly-errors.js';
export * from './schema/assembly-schema.js';
export * from './tts/tts-adapter.js';
export * from './tts/mock-tts-adapter.js';
export * from './tts/local-tts-adapter.js';
export * from './tts/tts-cache.js';
export * from './tts/tts-service.js';
export * from './narration/narration-segmenter.js';
export * from './narration/timeline-builder.js';
export * from './narration/timeline-synchronizer.js';
export * from './subtitles/subtitle-chunker.js';
export * from './subtitles/subtitle-generator.js';
export * from './subtitles/subtitle-styler.js';
export * from './audio/music-manager.js';
export * from './audio/sfx-manager.js';
export * from './audio/audio-mixer.js';
export * from './ffmpeg/ffmpeg-detector.js';
export * from './ffmpeg/media-normalizer.js';
export * from './ffmpeg/ffmpeg-assembler.js';
export * from './validation/audio-validator.js';
export * from './validation/final-video-validator.js';
export * from './storage/assembly-repository.js';
export * from './storage/final-asset-registry.js';
export * from './services/assembly-service.js';
export { PROJECT_STATUS } from '../projects/project.schema.js';
