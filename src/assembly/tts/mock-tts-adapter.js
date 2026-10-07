/**
 * Deterministic Mock TTS Adapter for Phase 6.
 * Generates lightweight, structurally valid RIFF/WAV audio files for testing and CI without external dependencies.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { TTSAdapter } from './tts-adapter.js';

export class MockTTSAdapter extends TTSAdapter {
  constructor(config = {}) {
    super();
    this.providerName = 'mock';
    this.voiceName = config.voice || 'mock-narrator-en';
    this.sampleRate = config.sampleRate || 24000;
  }

  getProviderName() {
    return this.providerName;
  }

  getVoiceName() {
    return this.voiceName;
  }

  async validateEnvironment() {
    return {
      available: true,
      provider: this.providerName,
      voice: this.voiceName,
      status: 'AVAILABLE',
      message: 'Mock TTS adapter is ready.'
    };
  }

  /**
   * Synthesizes audio deterministically for text.
   * @param {string} text
   * @param {object} [options={}]
   * @returns {Promise<object>}
   */
  async synthesize(text, options = {}) {
    const cleanText = (text || '').trim();
    const words = cleanText.split(/\s+/).filter(Boolean).length;
    const speed = options.speed || 1.0;
    
    // Natural speaking rate (~145 words per minute)
    const baseDuration = Math.max(1.5, Math.round((words / (145 * speed / 60)) * 10) / 10);
    const duration = options.durationSeconds || baseDuration;

    const outputPath = options.outputPath || path.join(process.cwd(), 'data', 'media', 'temp', `mock_tts_${Date.now()}.wav`);
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Generate valid PCM 16-bit Mono RIFF WAV file
    const wavBuffer = this._generateDeterministicWav(duration, this.sampleRate);
    fs.writeFileSync(outputPath, wavBuffer);

    const fileHash = createHash('sha256').update(wavBuffer).digest('hex');

    return {
      audioPath: outputPath,
      durationSeconds: duration,
      sampleRate: this.sampleRate,
      channels: 1,
      format: 'wav',
      fileHash,
      fileSizeBytes: wavBuffer.length
    };
  }

  /**
   * Generates a valid RIFF/WAV binary with PCM audio samples.
   * @private
   */
  _generateDeterministicWav(durationSeconds, sampleRate = 24000) {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const numSamples = Math.floor(sampleRate * durationSeconds);
    const dataSize = numSamples * blockAlign;
    const totalSize = 36 + dataSize;

    const buffer = Buffer.alloc(44 + dataSize);

    // RIFF chunk descriptor
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(totalSize, 4);
    buffer.write('WAVE', 8);

    // fmt sub-chunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
    buffer.writeUInt16LE(1, 20);  // AudioFormat (1 = PCM)
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);

    // data sub-chunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);

    // Write deterministic low-amplitude sine tone / PCM samples to prevent silence detection
    let offset = 44;
    const freq = 220; // A3 tone
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const sample = Math.sin(2 * Math.PI * freq * t) * 0.1 * 32767;
      buffer.writeInt16LE(Math.floor(sample), offset);
      offset += 2;
    }

    return buffer;
  }
}
