/**
 * Sound Effects (SFX) Manager for Phase 6.
 * Discovers and maps scene-level sound effects from user-provided assets.
 */

import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_ASSEMBLY_CONFIG } from '../config/assembly-config.js';

export class SFXManager {
  /**
   * @param {object} [options={}]
   */
  constructor(options = {}) {
    this.enabled = options.sfxEnabled !== undefined ? options.sfxEnabled : DEFAULT_ASSEMBLY_CONFIG.sfxEnabled;
    this.sfxDir = options.sfxDir || DEFAULT_ASSEMBLY_CONFIG.sfxDir;
    this.defaultVolume = options.sfxVolume || DEFAULT_ASSEMBLY_CONFIG.sfxVolume;
  }

  /**
   * Resolves sound effects for a given scene storyboard description.
   * @param {object} scene
   * @returns {Array<object>} Resolved SFX cues
   */
  resolveSceneSfx(scene) {
    if (!this.enabled || !fs.existsSync(this.sfxDir)) {
      return [];
    }

    const cues = [];
    const actionLower = (scene.action || '').toLowerCase();

    // Look for cues in local library matching keywords
    const available = this._listAvailableSfx();
    for (const [cueKey, filePath] of Object.entries(available)) {
      if (actionLower.includes(cueKey)) {
        cues.push({
          type: cueKey,
          filePath,
          volume: this.defaultVolume,
          startOffsetSeconds: 0.5
        });
      }
    }

    return cues;
  }

  _listAvailableSfx() {
    const sfxMap = {};
    try {
      const files = fs.readdirSync(this.sfxDir);
      for (const f of files) {
        const name = path.parse(f).name.toLowerCase();
        sfxMap[name] = path.join(this.sfxDir, f);
      }
    } catch (_) {}
    return sfxMap;
  }
}
