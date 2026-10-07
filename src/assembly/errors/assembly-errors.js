/**
 * Error classes for Phase 6 Audio & Video Assembly Engine.
 */

import { AppError } from '../../errors/app-errors.js';

export const ASSEMBLY_ERROR_CODES = Object.freeze({
  TTS_MODEL_NOT_INSTALLED: 'TTS_MODEL_NOT_INSTALLED',
  TTS_GENERATION_FAILED: 'TTS_GENERATION_FAILED',
  NARRATION_MISSING: 'NARRATION_MISSING',
  SCENE_MEDIA_MISSING: 'SCENE_MEDIA_MISSING',
  AUDIO_MIX_FAILED: 'AUDIO_MIX_FAILED',
  FFMPEG_NOT_FOUND: 'FFMPEG_NOT_FOUND',
  FFPROBE_NOT_FOUND: 'FFPROBE_NOT_FOUND',
  INVALID_MEDIA: 'INVALID_MEDIA',
  TIMELINE_CONFLICT: 'TIMELINE_CONFLICT',
  NARRATION_OVERFLOW: 'NARRATION_OVERFLOW',
  SUBTITLE_GENERATION_FAILED: 'SUBTITLE_GENERATION_FAILED',
  ASSEMBLY_FAILED: 'ASSEMBLY_FAILED',
  FINAL_VALIDATION_FAILED: 'FINAL_VALIDATION_FAILED',
  INVALID_INPUT: 'INVALID_INPUT'
});

export class AssemblyError extends AppError {
  constructor(message, code = ASSEMBLY_ERROR_CODES.ASSEMBLY_FAILED, isOperational = true, details = {}) {
    super(message, code, 500, isOperational, details);
  }
}

export class TTSError extends AssemblyError {
  constructor(message, code = ASSEMBLY_ERROR_CODES.TTS_GENERATION_FAILED, details = {}) {
    super(message, code, true, details);
  }
}

export class TimelineError extends AssemblyError {
  constructor(message, code = ASSEMBLY_ERROR_CODES.TIMELINE_CONFLICT, details = {}) {
    super(message, code, true, details);
  }
}

export class SubtitleError extends AssemblyError {
  constructor(message, code = ASSEMBLY_ERROR_CODES.SUBTITLE_GENERATION_FAILED, details = {}) {
    super(message, code, true, details);
  }
}

export class FFmpegError extends AssemblyError {
  constructor(message, code = ASSEMBLY_ERROR_CODES.ASSEMBLY_FAILED, details = {}) {
    super(message, code, true, details);
  }
}

export class AudioValidationError extends AssemblyError {
  constructor(message, details = {}) {
    super(message, ASSEMBLY_ERROR_CODES.AUDIO_MIX_FAILED, true, details);
  }
}

export class FinalValidationError extends AssemblyError {
  constructor(message, details = {}) {
    super(message, ASSEMBLY_ERROR_CODES.FINAL_VALIDATION_FAILED, true, details);
  }
}
