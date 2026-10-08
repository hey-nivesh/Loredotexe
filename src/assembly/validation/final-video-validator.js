/**
 * Final Video Validator for Phase 6.
 * Performs deep verification of the assembled MP4 deliverable, audio streams, subtitles, and timeline duration parity.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { DEFAULT_ASSEMBLY_CONFIG } from '../config/assembly-config.js';
import { FFmpegDetector } from '../ffmpeg/ffmpeg-detector.js';

export class FinalVideoValidator {
  /**
   * @param {object} [options={}]
   */
  constructor(options = {}) {
    this.detector = new FFmpegDetector(options);
  }

  /**
   * Validates the complete final video package.
   * @param {object} params
   * @param {string} params.videoPath Final assembled MP4 path
   * @param {string} [params.audioPath] Master mixed audio path
   * @param {string} [params.subtitlePath] Subtitles SRT path
   * @param {number} [params.expectedDurationSeconds] Target timeline duration
   * @returns {{ status: 'PASS'|'WARN'|'FAIL', valid: boolean, errors: Array<string>, warnings: Array<string>, details: object }}
   */
  validateFinalVideo({ videoPath, audioPath, subtitlePath, expectedDurationSeconds }) {
    const errors = [];
    const warnings = [];
    const details = {};

    // 1. File existence
    if (!videoPath || !fs.existsSync(videoPath)) {
      errors.push(`Final video file does not exist at '${videoPath}'.`);
      return { status: 'FAIL', valid: false, errors, warnings, details };
    }

    const stats = fs.statSync(videoPath);
    if (stats.size < 1024) {
      errors.push(`Final video file size (${stats.size} bytes) is suspiciously small or corrupted.`);
    }

    // 2. Container signature check (Verify MP4 ftyp box)
    const buffer = fs.readFileSync(videoPath);
    const isMp4 = buffer.length >= 8 && buffer.toString('ascii', 4, 8) === 'ftyp';
    if (!isMp4) {
      errors.push('Final video header is not a valid MP4 container.');
    }

    details.file_size_bytes = stats.size;
    details.sha256 = createHash('sha256').update(buffer).digest('hex');

    // 3. Audio file validation
    if (audioPath) {
      if (!fs.existsSync(audioPath)) {
        errors.push(`Master audio file does not exist at '${audioPath}'.`);
      }
    }

    // 4. Subtitle validation
    if (subtitlePath) {
      if (!fs.existsSync(subtitlePath)) {
        warnings.push(`Subtitles file not found at '${subtitlePath}'.`);
      } else {
        const subContent = fs.readFileSync(subtitlePath, 'utf8');
        if (!subContent.trim()) {
          warnings.push('Subtitle file is empty.');
        }
      }
    }

    // 5. FFprobe Deep Stream Inspection
    const ffprobeBin = this.detector.getFFprobePath();
    const ffmpegBin = this.detector.getFFmpegPath();

    const probeRes = spawnSync(ffprobeBin, [
      '-v', 'error',
      '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate:format=duration,format_name',
      '-of', 'json',
      videoPath
    ], { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'pipe'] });

    if (probeRes.error || probeRes.status !== 0 || !probeRes.stdout) {
      errors.push(`ffprobe validation failed: ${probeRes.stderr || probeRes.error?.message || 'moov atom not found or unreadable MP4'}`);
    } else {
      try {
        const data = JSON.parse(probeRes.stdout);
        const streams = data.streams || [];
        const hasVideo = streams.some((s) => s.codec_type === 'video');
        const hasAudio = streams.some((s) => s.codec_type === 'audio');
        const duration = parseFloat(data.format?.duration || '0');

        details.ffprobe = { hasVideo, hasAudio, duration, streams };

        if (!hasVideo) {
          errors.push('Final video does not contain a video stream.');
        }
        if (duration <= 0) {
          errors.push('Final video has zero duration.');
        }
        if (expectedDurationSeconds && duration > 0) {
          const diff = Math.abs(duration - expectedDurationSeconds);
          if (diff > 2.0) {
            warnings.push(`Final video duration (${duration.toFixed(2)}s) differs from timeline (${expectedDurationSeconds.toFixed(2)}s).`);
          }
        }
      } catch (err) {
        errors.push(`Failed to parse ffprobe json output: ${err.message}`);
      }
    }

    // 6. FFmpeg Decode Integrity Test
    const decodeRes = spawnSync(ffmpegBin, [
      '-v', 'error',
      '-i', videoPath,
      '-f', 'null',
      '-'
    ], { encoding: 'utf8', timeout: 8000, stdio: ['ignore', 'pipe', 'pipe'] });

    if (decodeRes.status !== 0 || (decodeRes.stderr && decodeRes.stderr.includes('moov atom not found'))) {
      errors.push(`FFmpeg decode error: ${decodeRes.stderr || 'Container decoding failed'}`);
    }

    const status = errors.length > 0 ? 'FAIL' : warnings.length > 0 ? 'WARN' : 'PASS';

    return {
      status,
      valid: errors.length === 0,
      errors,
      warnings,
      details
    };
  }
}
