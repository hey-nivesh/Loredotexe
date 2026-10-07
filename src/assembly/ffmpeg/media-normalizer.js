/**
 * Media Normalizer for Phase 6 Video Assembly.
 * Converts disparate scene video files into a standard format (H.264, YUV420p, fixed FPS & resolution) before concatenation.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DEFAULT_ASSEMBLY_CONFIG, RENDER_PROFILES } from '../config/assembly-config.js';
import { logger } from '../../logging/logger.js';

export class MediaNormalizer {
  /**
   * @param {object} [options={}]
   */
  constructor(options = {}) {
    this.config = { ...DEFAULT_ASSEMBLY_CONFIG, ...options };
    this.profile = RENDER_PROFILES[this.config.renderProfile] || RENDER_PROFILES.LOW;
  }

  /**
   * Normalizes a single scene video asset.
   * @param {string} inputPath
   * @param {string} outputPath
   * @param {object} [targetSpec={}]
   * @param {boolean} [useFfmpeg=false]
   * @returns {string} Normalized video path
   */
  normalizeScene(inputPath, outputPath, targetSpec = {}, useFfmpeg = false) {
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Input scene video not found at '${inputPath}'.`);
    }

    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const width = targetSpec.width || this.profile.width;
    const height = targetSpec.height || this.profile.height;
    const fps = targetSpec.fps || this.profile.fps;

    if (!useFfmpeg) {
      // Mock normalization - copy or touch valid normalized placeholder
      fs.copyFileSync(inputPath, outputPath);
      return outputPath;
    }

    const ffmpegBin = this.config.ffmpegPath || 'ffmpeg';
    const filter = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,format=${this.config.pixelFormat}`;

    const args = [
      '-y',
      '-i', inputPath,
      '-vf', filter,
      '-r', String(fps),
      '-c:v', this.config.videoCodec,
      '-preset', this.profile.preset,
      '-crf', String(this.profile.crf),
      '-an',
      outputPath
    ];

    const res = spawnSync(ffmpegBin, args, { encoding: 'utf8', timeout: 120000 });
    if (res.error || res.status !== 0) {
      logger.warn('Scene normalization with FFmpeg failed; falling back to direct copy', { error: res.stderr });
      fs.copyFileSync(inputPath, outputPath);
    }

    return outputPath;
  }

  /**
   * Normalizes all scene assets in batch.
   * @param {Array<{ sceneId: string, inputPath: string }>} sceneClips
   * @param {string} tempDir
   * @param {boolean} [useFfmpeg=false]
   * @returns {Array<string>} Array of normalized video paths
   */
  normalizeAll(sceneClips, tempDir, useFfmpeg = false) {
    const normalizedPaths = [];
    for (let i = 0; i < sceneClips.length; i++) {
      const clip = sceneClips[i];
      const normPath = path.join(tempDir, `norm_scene_${i + 1}_${clip.sceneId}.mp4`);
      this.normalizeScene(clip.inputPath, normPath, {}, useFfmpeg);
      normalizedPaths.push(normPath);
    }
    return normalizedPaths;
  }
}
