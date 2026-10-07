/**
 * TTS Caching Service for Phase 6.
 * Implements idempotent, disk-backed cache indexed by SHA-256(text + voice + provider + speed).
 */

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { DEFAULT_ASSEMBLY_CONFIG } from '../config/assembly-config.js';

export class TTSCache {
  /**
   * @param {string} [cacheDir]
   */
  constructor(cacheDir = DEFAULT_ASSEMBLY_CONFIG.ttsCacheDir) {
    this.cacheDir = cacheDir;
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Computes a deterministic cache key for text synthesis.
   * @param {string} text
   * @param {string} voice
   * @param {string} provider
   * @param {number} [speed=1.0]
   * @returns {string} SHA-256 Hex Hash
   */
  computeKey(text, voice, provider, speed = 1.0) {
    const raw = `${provider.trim().toLowerCase()}:${voice.trim().toLowerCase()}:${speed}:${text.trim()}`;
    return createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Looks up a cached audio entry.
   * @param {string} key
   * @returns {{ audioPath: string, meta: object } | null}
   */
  get(key) {
    const audioPath = path.join(this.cacheDir, `${key}.wav`);
    const metaPath = path.join(this.cacheDir, `${key}.json`);

    if (fs.existsSync(audioPath) && fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        return { audioPath, meta };
      } catch (_) {
        return null;
      }
    }
    return null;
  }

  /**
   * Stores synthesized audio in cache.
   * @param {string} key
   * @param {string} sourceAudioPath
   * @param {object} meta
   */
  set(key, sourceAudioPath, meta = {}) {
    const destAudioPath = path.join(this.cacheDir, `${key}.wav`);
    const destMetaPath = path.join(this.cacheDir, `${key}.json`);

    if (fs.existsSync(sourceAudioPath)) {
      fs.copyFileSync(sourceAudioPath, destAudioPath);
      fs.writeFileSync(destMetaPath, JSON.stringify({ ...meta, cachedAt: new Date().toISOString() }, null, 2), 'utf8');
    }
  }
}
