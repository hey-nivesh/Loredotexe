/**
 * Local TTS Adapter for Phase 6 (Piper / Local Engine Bridge).
 * Integrates optional local voice synthesis without automatic model downloads.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { TTSAdapter } from './tts-adapter.js';
import { TTSError, ASSEMBLY_ERROR_CODES } from '../errors/assembly-errors.js';

export class LocalTTSAdapter extends TTSAdapter {
  constructor(config = {}) {
    super();
    this.providerName = config.provider || 'piper';
    this.modelPath = config.modelPath || process.env.TTS_MODEL_PATH || null;
    this.voiceName = config.voice || process.env.TTS_VOICE || 'en_US-lessac-medium';
    this.speed = config.speed || 1.0;
  }

  getProviderName() {
    return this.providerName;
  }

  getVoiceName() {
    return this.voiceName;
  }

  async validateEnvironment() {
    if (!this.modelPath || !fs.existsSync(this.modelPath)) {
      return {
        available: false,
        provider: this.providerName,
        voice: this.voiceName,
        status: 'UNAVAILABLE',
        reason: ASSEMBLY_ERROR_CODES.TTS_MODEL_NOT_INSTALLED,
        message: `Local voice model was not found at '${this.modelPath || 'unspecified path'}'. Configure TTS_MODEL_PATH with a valid model.`
      };
    }

    return {
      available: true,
      provider: this.providerName,
      voice: this.voiceName,
      modelPath: this.modelPath,
      status: 'AVAILABLE'
    };
  }

  async synthesize(text, options = {}) {
    const envCheck = await this.validateEnvironment();
    if (!envCheck.available) {
      throw new TTSError(envCheck.message, envCheck.reason, envCheck);
    }

    const outputPath = options.outputPath || path.join(process.cwd(), 'data', 'media', 'temp', `tts_${Date.now()}.wav`);
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Execute local piper CLI if installed
    const result = spawnSync('piper', [
      '--model', this.modelPath,
      '--output_file', outputPath
    ], {
      input: text,
      encoding: 'utf8',
      timeout: 30000
    });

    if (result.error || result.status !== 0) {
      throw new TTSError(
        `Local TTS synthesis failed: ${result.stderr || result.error?.message}`,
        ASSEMBLY_ERROR_CODES.TTS_GENERATION_FAILED
      );
    }

    return {
      audioPath: outputPath,
      durationSeconds: options.durationSeconds || 5.0,
      format: 'wav'
    };
  }
}
