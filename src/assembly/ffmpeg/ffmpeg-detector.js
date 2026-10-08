/**
 * FFmpeg and FFprobe Detection and Path Resolution Utility.
 * Resolves binary executables from environment, PATH, and standard Windows/Unix locations.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DEFAULT_ASSEMBLY_CONFIG } from '../config/assembly-config.js';

export class FFmpegDetector {
  /**
   * @param {object} [options={}]
   */
  constructor(options = {}) {
    this.configuredFfmpegPath = options.ffmpegPath || process.env.FFMPEG_PATH || DEFAULT_ASSEMBLY_CONFIG.ffmpegPath || 'ffmpeg';
    this.configuredFfprobePath = options.ffprobePath || process.env.FFPROBE_PATH || DEFAULT_ASSEMBLY_CONFIG.ffprobePath || 'ffprobe';
    this.resolvedFfmpegPath = null;
    this.resolvedFfprobePath = null;
    this._cachedReport = null;
  }

  /**
   * Gets the resolved usable path to the ffmpeg executable.
   * @returns {string}
   */
  getFFmpegPath() {
    if (!this.resolvedFfmpegPath) {
      this.detect();
    }
    return this.resolvedFfmpegPath || this.configuredFfmpegPath;
  }

  /**
   * Gets the resolved usable path to the ffprobe executable.
   * @returns {string}
   */
  getFFprobePath() {
    if (!this.resolvedFfprobePath) {
      this.detect();
    }
    return this.resolvedFfprobePath || this.configuredFfprobePath;
  }

  /**
   * Detects availability and version strings for FFmpeg and FFprobe.
   * @returns {{ ffmpeg_available: boolean, ffprobe_available: boolean, ffmpeg_version: string|null, ffprobe_version: string|null, ffmpeg_path: string, ffprobe_path: string, setup_instructions?: string }}
   */
  detect() {
    const ffmpegRes = this._findAndProbeBinary('ffmpeg', this.configuredFfmpegPath);
    const ffprobeRes = this._findAndProbeBinary('ffprobe', this.configuredFfprobePath);

    this.resolvedFfmpegPath = ffmpegRes.resolvedPath || this.configuredFfmpegPath;
    this.resolvedFfprobePath = ffprobeRes.resolvedPath || this.configuredFfprobePath;

    const report = {
      ffmpeg_available: ffmpegRes.available,
      ffprobe_available: ffprobeRes.available,
      ffmpeg_version: ffmpegRes.version,
      ffprobe_version: ffprobeRes.version,
      ffmpeg_path: this.resolvedFfmpegPath,
      ffprobe_path: this.resolvedFfprobePath
    };

    if (!report.ffmpeg_available || !report.ffprobe_available) {
      report.setup_instructions = 'Install FFmpeg via winget: `winget install Gyan.FFmpeg` or download from https://ffmpeg.org and add to PATH.';
    }

    this._cachedReport = report;
    return report;
  }

  /**
   * Probes binary via configured path, system PATH, or fallback directory scan.
   * @private
   */
  _findAndProbeBinary(defaultName, configuredPath) {
    // 1. Try configured path
    if (configuredPath) {
      const directProbe = this._probeBinary(configuredPath);
      if (directProbe.available) {
        return { ...directProbe, resolvedPath: configuredPath };
      }
    }

    // 2. Try default name in system PATH
    if (configuredPath !== defaultName) {
      const defaultProbe = this._probeBinary(defaultName);
      if (defaultProbe.available) {
        return { ...defaultProbe, resolvedPath: defaultName };
      }
    }

    // 3. Search common Windows installation paths
    if (process.platform === 'win32') {
      const candidates = this._getWindowsCandidates(defaultName);
      for (const candidate of candidates) {
        const probe = this._probeBinary(candidate);
        if (probe.available) {
          return { ...probe, resolvedPath: candidate };
        }
      }
    }

    return { available: false, version: null, resolvedPath: null };
  }

  /**
   * Gathers common Windows installation directory paths for FFmpeg.
   * @private
   */
  _getWindowsCandidates(binaryName) {
    const exeName = binaryName.endsWith('.exe') ? binaryName : `${binaryName}.exe`;
    const candidates = [];

    const localAppData = process.env.LOCALAPPDATA || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'AppData', 'Local') : '');
    if (localAppData) {
      const wingetDir = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
      if (fs.existsSync(wingetDir)) {
        try {
          const entries = fs.readdirSync(wingetDir);
          for (const entry of entries) {
            if (entry.toLowerCase().includes('ffmpeg')) {
              const fullPkg = path.join(wingetDir, entry);
              this._findExeRecursive(fullPkg, exeName, candidates, 3);
            }
          }
        } catch (_) {}
      }
    }

    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    candidates.push(path.join(programFiles, 'ffmpeg', 'bin', exeName));
    candidates.push(path.join('C:\\ProgramData', 'chocolatey', 'bin', exeName));
    if (process.env.USERPROFILE) {
      candidates.push(path.join(process.env.USERPROFILE, 'scoop', 'shims', exeName));
    }

    return candidates;
  }

  /**
   * Helper to find an executable recursively up to a max depth.
   * @private
   */
  _findExeRecursive(dir, exeName, results, maxDepth) {
    if (maxDepth <= 0 || !fs.existsSync(dir)) return;
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
          this._findExeRecursive(fullPath, exeName, results, maxDepth - 1);
        } else if (item.isFile() && item.name.toLowerCase() === exeName.toLowerCase()) {
          results.push(fullPath);
        }
      }
    } catch (_) {}
  }

  /**
   * Probes an individual binary path.
   * @private
   */
  _probeBinary(binaryPath) {
    if (!binaryPath) return { available: false, version: null };
    try {
      if (path.isAbsolute(binaryPath) && !fs.existsSync(binaryPath)) {
        return { available: false, version: null };
      }
      const res = spawnSync(binaryPath, ['-version'], {
        encoding: 'utf8',
        timeout: 2000,
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
    } catch (_) {}

    return { available: false, version: null };
  }
}
