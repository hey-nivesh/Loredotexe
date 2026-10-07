/**
 * TTS Service for Phase 6 Audio Engine.
 * Coordinates segment synthesis, caching, retry logic, and provider resolution.
 */

import fs from 'node:fs';
import path from 'node:path';
import { MockTTSAdapter } from './mock-tts-adapter.js';
import { LocalTTSAdapter } from './local-tts-adapter.js';
import { TTSCache } from './tts-cache.js';
import { DEFAULT_ASSEMBLY_CONFIG } from '../config/assembly-config.js';
import { TTSError, ASSEMBLY_ERROR_CODES } from '../errors/assembly-errors.js';
import { logger } from '../../logging/logger.js';

export class TTSService {
  /**
   * @param {object} [options={}]
   */
  constructor(options = {}) {
    this.config = { ...DEFAULT_ASSEMBLY_CONFIG, ...options };
    this.cache = this.config.ttsCacheEnabled ? new TTSCache(this.config.ttsCacheDir) : null;
    this.adapter = this._resolveAdapter(this.config.ttsProvider);
  }

  /**
   * Resolves the configured TTS adapter.
   * @private
   */
  _resolveAdapter(provider) {
    const prov = (provider || 'mock').toLowerCase();
    if (prov === 'mock') {
      return new MockTTSAdapter({ voice: this.config.ttsVoice });
    }
    return new LocalTTSAdapter({
      provider: prov,
      modelPath: this.config.ttsModelPath,
      voice: this.config.ttsVoice,
      speed: this.config.ttsSpeed
    });
  }

  /**
   * Synthesizes audio for a single segment with caching.
   * @param {object} segment
   * @param {string} [projectAudioDir]
   * @returns {Promise<object>}
   */
  async synthesizeSegment(segment, projectAudioDir) {
    const text = segment.text || '';
    const voice = this.adapter.getVoiceName();
    const provider = this.adapter.getProviderName();
    const speed = this.config.ttsSpeed || 1.0;

    const cacheKey = this.cache ? this.cache.computeKey(text, voice, provider, speed) : null;

    // Check cache
    if (this.cache && cacheKey) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        logger.debug('TTS cache hit for segment', { narrationId: segment.narration_id });
        return {
          ...segment,
          actual_duration_seconds: cached.meta.durationSeconds || segment.estimated_duration_seconds,
          audio_path: cached.audioPath,
          status: 'COMPLETED',
          reused: true
        };
      }
    }

    const outputFileName = `${segment.narration_id || 'narr_' + Date.now()}.wav`;
    const targetDir = projectAudioDir || path.join(this.config.tempDir, 'narration');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const outputPath = path.join(targetDir, outputFileName);

    try {
      const result = await this.adapter.synthesize(text, {
        outputPath,
        speed,
        durationSeconds: segment.estimated_duration_seconds
      });

      if (this.cache && cacheKey) {
        this.cache.set(cacheKey, result.audioPath, {
          durationSeconds: result.durationSeconds,
          voice,
          provider
        });
      }

      return {
        ...segment,
        actual_duration_seconds: result.durationSeconds,
        audio_path: result.audioPath,
        status: 'COMPLETED',
        reused: false
      };
    } catch (err) {
      logger.error('TTS synthesis failed for segment', {
        narrationId: segment.narration_id,
        error: err.message
      });
      throw new TTSError(
        `TTS synthesis failed for segment ${segment.narration_id}: ${err.message}`,
        err.code || ASSEMBLY_ERROR_CODES.TTS_GENERATION_FAILED,
        { segment, originalError: err.message }
      );
    }
  }

  /**
   * Synthesizes audio for all narration segments sequentially.
   * @param {Array<object>} segments
   * @param {string} [projectAudioDir]
   * @returns {Promise<Array<object>>}
   */
  async synthesizeAll(segments, projectAudioDir) {
    const results = [];
    for (const seg of segments) {
      const syn = await this.synthesizeSegment(seg, projectAudioDir);
      results.push(syn);
    }
    return results;
  }
}
