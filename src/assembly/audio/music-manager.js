/**
 * Music Manager for Phase 6 Background Audio.
 * Discovers and validates user-provided local music tracks without cloud downloading.
 */

import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_ASSEMBLY_CONFIG } from '../config/assembly-config.js';

export class MusicManager {
  /**
   * @param {object} [options={}]
   */
  constructor(options = {}) {
    this.enabled = options.musicEnabled !== undefined ? options.musicEnabled : DEFAULT_ASSEMBLY_CONFIG.musicEnabled;
    this.musicDir = options.musicDir || DEFAULT_ASSEMBLY_CONFIG.musicDir;
    this.defaultVolume = options.musicVolume || DEFAULT_ASSEMBLY_CONFIG.musicVolume;
  }

  /**
   * Discovers available audio tracks in the local music folder.
   * @returns {Array<string>} Array of absolute track paths
   */
  listAvailableTracks() {
    if (!this.enabled || !fs.existsSync(this.musicDir)) {
      return [];
    }

    try {
      const files = fs.readdirSync(this.musicDir);
      return files
        .filter((f) => ['.mp3', '.wav', '.m4a', '.ogg', '.flac'].includes(path.extname(f).toLowerCase()))
        .map((f) => path.join(this.musicDir, f));
    } catch (_) {
      return [];
    }
  }

  /**
   * Selects a music track for a project or scene mood.
   * @param {string} [mood] Optional mood tag
   * @returns {{ trackPath: string, volume: number } | null}
   */
  selectTrack(mood = 'default') {
    const tracks = this.listAvailableTracks();
    if (tracks.length === 0) return null;

    // Deterministic selection
    return {
      trackPath: tracks[0],
      volume: this.defaultVolume,
      mood
    };
  }
}
