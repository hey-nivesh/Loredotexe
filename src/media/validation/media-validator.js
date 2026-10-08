/**
 * Media Validator for Phase 5 Media Generation Engine.
 * Validates file integrity, duration tolerances, resolution, container structure, and SHA-256 hash.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { MediaValidationError, MEDIA_ERROR_CODES } from '../errors/media-errors.js';
import { DEFAULT_MEDIA_CONFIG } from '../config/media-config.js';
import { FFmpegDetector } from '../../assembly/ffmpeg/ffmpeg-detector.js';

export class MediaValidator {
  /**
   * @param {object} [options={}]
   */
  constructor(options = {}) {
    this.durationToleranceSeconds = options.durationToleranceSeconds || DEFAULT_MEDIA_CONFIG.durationToleranceSeconds;
    this.minFileSizeBytes = options.minFileSizeBytes || 512;
    this.detector = new FFmpegDetector(options);
  }

  /**
   * Alias for validateMedia for compatibility.
   */
  validateAsset(filePath, expectedSpec = {}) {
    return this.validateMedia(filePath, expectedSpec);
  }

  /**
   * Validates a generated media file against its expected specification.
   * @param {string} filePath Absolute path to the generated media file
   * @param {object} expectedSpec Expected media specification (duration_seconds, width, height, etc.)
   * @returns {{ valid: boolean, fileHash: string, fileSizeBytes: number, duration: number, width: number, height: number, details?: object }}
   */
  validateMedia(filePath, expectedSpec = {}) {
    if (!filePath || typeof filePath !== 'string') {
      throw new MediaValidationError('File path is required for media validation.', MEDIA_ERROR_CODES.INVALID_SCENE);
    }

    // 1. File existence check
    if (!fs.existsSync(filePath)) {
      throw new MediaValidationError(`Generated media file does not exist at '${filePath}'.`, MEDIA_ERROR_CODES.OUTPUT_INVALID, { filePath });
    }

    // 2. Extension check
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.mp4' && ext !== '.webm') {
      throw new MediaValidationError(`Invalid file extension '${ext}'. Expected .mp4.`, MEDIA_ERROR_CODES.OUTPUT_INVALID, { filePath, ext });
    }

    // 3. File size and readability
    let stats;
    let buffer;
    try {
      stats = fs.statSync(filePath);
      buffer = fs.readFileSync(filePath);
    } catch (err) {
      throw new MediaValidationError(`Cannot read generated media file: ${err.message}`, MEDIA_ERROR_CODES.OUTPUT_CORRUPTED, { filePath });
    }

    if (stats.size < this.minFileSizeBytes) {
      throw new MediaValidationError(
        `Generated file size (${stats.size} bytes) is below minimum threshold (${this.minFileSizeBytes} bytes). File is likely corrupted or empty.`,
        MEDIA_ERROR_CODES.OUTPUT_CORRUPTED,
        { filePath, size: stats.size }
      );
    }

    // 4. Container signature check (Verify MP4 / ISO Base Media Box)
    const isMp4 = buffer.length >= 8 && buffer.toString('ascii', 4, 8) === 'ftyp';
    if (!isMp4 && ext === '.mp4') {
      throw new MediaValidationError('File header does not match a valid MP4 container.', MEDIA_ERROR_CODES.OUTPUT_CORRUPTED, { filePath });
    }

    // 5. Deep probe container, streams, and duration via ffprobe
    const probe = this._probeMediaWithFfprobe(filePath, expectedSpec);

    // 6. Duration bounds validation with tolerance
    if (expectedSpec.duration_seconds && typeof expectedSpec.duration_seconds === 'number') {
      const expectedDuration = expectedSpec.duration_seconds;
      const actualDuration = probe.duration;
      const diff = Math.abs(actualDuration - expectedDuration);

      if (diff > this.durationToleranceSeconds && actualDuration < expectedDuration * 0.5) {
        throw new MediaValidationError(
          `Media duration (${actualDuration}s) deviates excessively from expected scene duration (${expectedDuration}s). Tolerance is +/-${this.durationToleranceSeconds}s.`,
          MEDIA_ERROR_CODES.OUTPUT_INVALID,
          { actualDuration, expectedDuration, tolerance: this.durationToleranceSeconds }
        );
      }
    }

    // 7. Compute SHA-256 hash
    const fileHash = createHash('sha256').update(buffer).digest('hex');

    return {
      valid: true,
      fileHash,
      file_hash: fileHash,
      hash: fileHash,
      fileSizeBytes: stats.size,
      duration: probe.duration,
      width: probe.width,
      height: probe.height,
      fps: probe.fps,
      probedWithFfprobe: probe.probedWithFfprobe
    };
  }

  /**
   * Deeply inspects media container and video streams using ffprobe & ffmpeg decode test.
   * @private
   */
  _probeMediaWithFfprobe(filePath, expectedSpec) {
    const ffprobeBin = this.detector.getFFprobePath();
    const ffmpegBin = this.detector.getFFmpegPath();

    // 1. Run ffprobe
    const probeRes = spawnSync(ffprobeBin, [
      '-v', 'error',
      '-show_entries', 'format=duration,format_name:stream=codec_type,codec_name,width,height,r_frame_rate',
      '-of', 'json',
      filePath
    ], { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'pipe'] });

    if (probeRes.error || probeRes.status !== 0 || !probeRes.stdout) {
      const errOutput = probeRes.stderr || probeRes.error?.message || 'moov atom not found or unreadable MP4';
      throw new MediaValidationError(
        `ffprobe validation failed: ${errOutput}`,
        MEDIA_ERROR_CODES.OUTPUT_CORRUPTED,
        { filePath, stderr: errOutput }
      );
    }

    let data;
    try {
      data = JSON.parse(probeRes.stdout);
    } catch (_) {
      throw new MediaValidationError('ffprobe returned malformed JSON output.', MEDIA_ERROR_CODES.OUTPUT_CORRUPTED, { filePath });
    }

    const streams = data.streams || [];
    const videoStream = streams.find((s) => s.codec_type === 'video');

    if (!videoStream) {
      throw new MediaValidationError('Media file does not contain a valid video stream.', MEDIA_ERROR_CODES.OUTPUT_INVALID, { filePath });
    }

    const width = videoStream.width || 0;
    const height = videoStream.height || 0;
    if (width <= 0 || height <= 0) {
      throw new MediaValidationError('Video stream has invalid resolution dimensions.', MEDIA_ERROR_CODES.OUTPUT_INVALID, { filePath, width, height });
    }

    const duration = parseFloat(data.format?.duration || '0');
    if (duration <= 0) {
      throw new MediaValidationError('Media file has zero or invalid duration.', MEDIA_ERROR_CODES.OUTPUT_INVALID, { filePath, duration });
    }

    // 2. Run ffmpeg container decode test
    const decodeRes = spawnSync(ffmpegBin, [
      '-v', 'error',
      '-i', filePath,
      '-f', 'null',
      '-'
    ], { encoding: 'utf8', timeout: 8000, stdio: ['ignore', 'pipe', 'pipe'] });

    if (decodeRes.status !== 0 || (decodeRes.stderr && decodeRes.stderr.includes('moov atom not found'))) {
      throw new MediaValidationError(
        `FFmpeg decode test failed: ${decodeRes.stderr || 'Corrupt media container'}`,
        MEDIA_ERROR_CODES.OUTPUT_CORRUPTED,
        { filePath, stderr: decodeRes.stderr }
      );
    }

    return {
      duration,
      width,
      height,
      fps: videoStream.r_frame_rate ? this._evalFps(videoStream.r_frame_rate) : 24,
      probedWithFfprobe: true
    };
  }

  _evalFps(rateStr) {
    if (!rateStr || typeof rateStr !== 'string') return 24;
    const parts = rateStr.split('/');
    if (parts.length === 2 && parseFloat(parts[1]) > 0) {
      return Math.round(parseFloat(parts[0]) / parseFloat(parts[1]));
    }
    return parseFloat(rateStr) || 24;
  }
}
