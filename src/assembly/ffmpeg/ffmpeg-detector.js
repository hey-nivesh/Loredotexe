import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DEFAULT_ASSEMBLY_CONFIG } from '../config/assembly-config.js';

export class FFmpegDetector {
  /**
   * @param {object} [options={}]
   */
  constructor(options = {}) {
    this.ffmpegPath = options.ffmpegPath || DEFAULT_ASSEMBLY_CONFIG.ffmpegPath || 'ffmpeg';
    this.ffprobePath = options.ffprobePath || DEFAULT_ASSEMBLY_CONFIG.ffprobePath || 'ffprobe';
  }

  /**
   * Detects availability and version strings for FFmpeg and FFprobe.
   * @returns {{ ffmpeg_available: boolean, ffprobe_available: boolean, ffmpeg_version: string|null, ffprobe_version: string|null, setup_instructions?: string }}
   */
  detect() {
    const ffmpegRes = this._probeBinary(this.ffmpegPath);
    const ffprobeRes = this._probeBinary(this.ffprobePath);

    const report = {
      ffmpeg_available: ffmpegRes.available,
      ffprobe_available: ffprobeRes.available,
      ffmpeg_version: ffmpegRes.version,
      ffprobe_version: ffprobeRes.version,
      ffmpeg_path: this.ffmpegPath,
      ffprobe_path: this.ffprobePath
    };

    if (!report.ffmpeg_available || !report.ffprobe_available) {
      report.setup_instructions = 'Install FFmpeg via winget: `winget install Gyan.FFmpeg` or download from https://ffmpeg.org and add to PATH.';
    }

    return report;
  }

  _probeBinary(binaryPath) {
    if (!binaryPath) return { available: false, version: null };
    try {
      if (path.isAbsolute(binaryPath)) {
        if (!fs.existsSync(binaryPath)) {
          return { available: false, version: null };
        }
        const res = spawnSync(binaryPath, ['-version'], {
          encoding: 'utf8',
          timeout: 1000,
          stdio: ['ignore', 'pipe', 'pipe']
        });

        if (!res.error && res.status === 0 && res.stdout) {
          const firstLine = res.stdout.split('\n')[0].trim();
          const match = firstLine.match(/version\s+([^\s]+)/i);
          return {
            available: true,
            version: match ? match[1] : firstLine
          };
        }
      }
    } catch (_) {}

    return { available: false, version: null };
  }
}
