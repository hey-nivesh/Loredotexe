/**
 * Abstract Video/Audio TTS Model Adapter Base Interface for Phase 6.
 */

export class TTSAdapter {
  getProviderName() {
    throw new Error('TTSAdapter.getProviderName() must be implemented.');
  }

  getVoiceName() {
    throw new Error('TTSAdapter.getVoiceName() must be implemented.');
  }

  async validateEnvironment() {
    throw new Error('TTSAdapter.validateEnvironment() must be implemented.');
  }

  /**
   * Synthesizes audio for a single narration text segment.
   * @param {string} text Text to synthesize
   * @param {object} [options={}] Options (voice, speed, outputPath, sceneId, etc.)
   * @returns {Promise<{ audioPath: string, durationSeconds: number, format: string, fileHash: string, sampleRate: number }>}
   */
  async synthesize(text, options = {}) {
    throw new Error('TTSAdapter.synthesize() must be implemented.');
  }
}
