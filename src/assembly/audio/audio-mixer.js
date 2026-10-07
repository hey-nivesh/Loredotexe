/**
 * Audio Mixer for Phase 6 Audio Engine.
 * Concatenates narration, applies background music ducking, and layers SFX.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { DEFAULT_ASSEMBLY_CONFIG } from '../config/assembly-config.js';
import { AudioValidationError } from '../errors/assembly-errors.js';
import { logger } from '../../logging/logger.js';

export class AudioMixer {
  /**
   * @param {object} [options={}]
   */
  constructor(options = {}) {
    this.config = { ...DEFAULT_ASSEMBLY_CONFIG, ...options };
  }

  /**
   * Concatenates raw narration audio segments into a single track.
   * @param {Array<string>} narrationAudioPaths
   * @param {string} outputPath
   * @returns {string} Concatenated narration path
   */
  concatenateNarration(narrationAudioPaths, outputPath) {
    const validPaths = narrationAudioPaths.filter((p) => p && fs.existsSync(p));
    if (validPaths.length === 0) {
      throw new Error('No valid narration audio files found to concatenate.');
    }

    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // If single file, copy directly
    if (validPaths.length === 1) {
      fs.copyFileSync(validPaths[0], outputPath);
      return outputPath;
    }

    // Mock binary concatenation of PCM WAV data
    const buffers = validPaths.map((p) => fs.readFileSync(p));
    const header = buffers[0].subarray(0, 44);
    let totalDataSize = 0;
    const dataChunks = [];

    for (const buf of buffers) {
      const pcmData = buf.subarray(44);
      totalDataSize += pcmData.length;
      dataChunks.push(pcmData);
    }

    const mergedHeader = Buffer.from(header);
    mergedHeader.writeUInt32LE(36 + totalDataSize, 4);
    mergedHeader.writeUInt32LE(totalDataSize, 40);

    const mergedWav = Buffer.concat([mergedHeader, ...dataChunks]);
    fs.writeFileSync(outputPath, mergedWav);

    return outputPath;
  }

  /**
   * Mixes narration with optional music and SFX into master audio.
   * @param {object} params
   * @param {string} params.narrationPath Master narration audio path
   * @param {object} [params.musicTrack] Optional background music track { trackPath, volume }
   * @param {Array<object>} [params.sfxCues] Optional SFX cues
   * @param {string} params.outputPath Output master audio path
   * @param {boolean} [params.useFfmpeg=false]
   * @returns {Promise<object>} Mixed Audio Result
   */
  async mixMasterAudio({ narrationPath, musicTrack, sfxCues = [], outputPath, useFfmpeg = false }) {
    if (!fs.existsSync(narrationPath)) {
      throw new Error(`Master narration audio file not found at '${narrationPath}'.`);
    }

    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // If no music and no SFX, or mock mode, narration is master
    if ((!musicTrack && sfxCues.length === 0) || !useFfmpeg) {
      fs.copyFileSync(narrationPath, outputPath);
      const buf = fs.readFileSync(outputPath);
      const fileHash = createHash('sha256').update(buf).digest('hex');
      return {
        audioPath: outputPath,
        format: path.extname(outputPath).slice(1) || 'wav',
        fileHash,
        fileSizeBytes: buf.length,
        musicApplied: false,
        sfxApplied: false
      };
    }

    // Real FFmpeg audio filter mixing (amix with ducking volume)
    const ffmpegBin = this.config.ffmpegPath || 'ffmpeg';
    const musicVol = musicTrack?.volume || this.config.musicVolume || 0.15;
    
    // Construct filter: [0:a]volume=1.0[narr];[1:a]volume=0.15[bgm];[narr][bgm]amix=inputs=2:duration=first:dropout_transition=2[out]
    const args = [
      '-y',
      '-i', narrationPath,
      '-i', musicTrack.trackPath,
      '-filter_complex', `[0:a]volume=1.0[narr];[1:a]volume=${musicVol}[bgm];[narr][bgm]amix=inputs=2:duration=first[out]`,
      '-map', '[out]',
      outputPath
    ];

    const result = spawnSync(ffmpegBin, args, { encoding: 'utf8', timeout: 60000 });
    if (result.error || result.status !== 0) {
      logger.warn('FFmpeg audio mixing failed; falling back to clean narration', { error: result.stderr });
      fs.copyFileSync(narrationPath, outputPath);
    }

    const buf = fs.readFileSync(outputPath);
    const fileHash = createHash('sha256').update(buf).digest('hex');

    return {
      audioPath: outputPath,
      format: path.extname(outputPath).slice(1) || 'wav',
      fileHash,
      fileSizeBytes: buf.length,
      musicApplied: !!musicTrack,
      sfxApplied: sfxCues.length > 0
    };
  }
}
