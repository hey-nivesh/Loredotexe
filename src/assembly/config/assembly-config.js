/**
 * Configuration and Environment Defaults for Phase 6 Audio & Video Assembly Engine.
 */

import path from 'node:path';

export const PHASE6_MODES = Object.freeze({
  MOCK: 'mock',
  DRY_RUN: 'dry-run',
  REAL: 'real'
});

export const RENDER_PROFILES = Object.freeze({
  LOW: {
    width: 854,
    height: 480,
    fps: 30,
    crf: 24,
    preset: 'veryfast',
    bitrate: '1500k',
    audioBitrate: '128k'
  },
  MEDIUM: {
    width: 1280,
    height: 720,
    fps: 30,
    crf: 22,
    preset: 'medium',
    bitrate: '3500k',
    audioBitrate: '192k'
  },
  HIGH: {
    width: 1920,
    height: 1080,
    fps: 30,
    crf: 20,
    preset: 'medium',
    bitrate: '8000k',
    audioBitrate: '256k'
  }
});

export const DEFAULT_ASSEMBLY_CONFIG = Object.freeze({
  mode: (process.env.PHASE6_MODE || 'mock').toLowerCase(),
  outputDir: process.env.VIDEO_OUTPUT_DIR || path.join(process.cwd(), 'data', 'media', 'final'),
  tempDir: process.env.VIDEO_TEMP_DIR || path.join(process.cwd(), 'data', 'media', 'temp'),
  
  // TTS Settings
  ttsProvider: (process.env.TTS_PROVIDER || 'mock').toLowerCase(),
  ttsModelPath: process.env.TTS_MODEL_PATH || null,
  ttsVoice: process.env.TTS_VOICE || 'en-US-ChristopherNeural',
  ttsSpeed: parseFloat(process.env.TTS_SPEED || '1.0'),
  ttsCacheEnabled: process.env.TTS_CACHE_ENABLED !== 'false',
  ttsCacheDir: path.join(process.cwd(), 'data', 'media', 'tts_cache'),
  
  // Subtitle Settings
  subtitleFormat: (process.env.SUBTITLE_FORMAT || 'srt').toLowerCase(),
  subtitleFont: process.env.SUBTITLE_FONT || 'Arial',
  subtitleFontSize: parseInt(process.env.SUBTITLE_FONT_SIZE || '24', 10),
  subtitlePosition: process.env.SUBTITLE_POSITION || 'bottom-center',
  subtitleMargin: parseInt(process.env.SUBTITLE_MARGIN || '30', 10),
  subtitleOutline: parseInt(process.env.SUBTITLE_OUTLINE || '2', 10),
  subtitleMaxCharsPerLine: parseInt(process.env.SUBTITLE_MAX_CHARS_PER_LINE || '42', 10),
  subtitleMaxLines: parseInt(process.env.SUBTITLE_MAX_LINES || '2', 10),
  subtitleMinDurationSeconds: parseFloat(process.env.SUBTITLE_MIN_DURATION || '1.0'),
  subtitleMaxDurationSeconds: parseFloat(process.env.SUBTITLE_MAX_DURATION || '6.0'),
  
  // Music & SFX
  musicEnabled: process.env.MUSIC_ENABLED === 'true',
  musicDir: process.env.MUSIC_DIR || path.join(process.cwd(), 'assets', 'music'),
  musicVolume: parseFloat(process.env.MUSIC_VOLUME || '0.15'),
  sfxEnabled: process.env.SFX_ENABLED === 'true',
  sfxDir: process.env.SFX_DIR || path.join(process.cwd(), 'assets', 'sfx'),
  sfxVolume: parseFloat(process.env.SFX_VOLUME || '0.20'),
  
  // Video & FFmpeg Settings
  renderProfile: (process.env.VIDEO_RENDER_PROFILE || 'LOW').toUpperCase(),
  videoCodec: process.env.VIDEO_CODEC || 'libx264',
  audioCodec: process.env.VIDEO_AUDIO_CODEC || 'aac',
  pixelFormat: process.env.VIDEO_PIXEL_FORMAT || 'yuv420p',
  crf: parseInt(process.env.VIDEO_CRF || '23', 10),
  preset: process.env.VIDEO_PRESET || 'medium',
  fps: parseInt(process.env.VIDEO_FPS || '30', 10),
  maxConcurrentAssemblies: parseInt(process.env.ASSEMBLY_CONCURRENCY || '1', 10),
  
  // Binary paths
  ffmpegPath: process.env.FFMPEG_PATH || null,
  ffprobePath: process.env.FFPROBE_PATH || null,
  
  // Cleanups
  cleanupTempFiles: process.env.CLEANUP_TEMP_FILES !== 'false'
});
