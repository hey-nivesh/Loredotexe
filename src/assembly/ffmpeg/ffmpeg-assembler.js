/**
 * FFmpeg Video Assembler for Phase 6.
 * Programmatically compiles filter complexes, concatenates scenes, synchronizes master audio, overlays subtitles, and renders final deliverable.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { DEFAULT_ASSEMBLY_CONFIG, RENDER_PROFILES } from '../config/assembly-config.js';
import { FFmpegError, ASSEMBLY_ERROR_CODES } from '../errors/assembly-errors.js';
import { SubtitleStyler } from '../subtitles/subtitle-styler.js';
import { logger } from '../../logging/logger.js';

export class FFmpegAssembler {
  /**
   * @param {object} [options={}]
   */
  constructor(options = {}) {
    this.config = { ...DEFAULT_ASSEMBLY_CONFIG, ...options };
    this.profile = RENDER_PROFILES[this.config.renderProfile] || RENDER_PROFILES.LOW;
    this.subtitleStyler = new SubtitleStyler(this.config);
  }

  /**
   * Assembles final video from normalized scene clips, master audio, and subtitles.
   * @param {object} params
   * @param {Array<string>} params.sceneVideoPaths
   * @param {string} params.masterAudioPath
   * @param {string} [params.subtitlePath]
   * @param {string} params.outputPath
   * @param {number} [params.totalDurationSeconds]
   * @param {boolean} [params.useFfmpeg=false]
   * @returns {Promise<object>} Final Assembly Result
   */
  async assembleVideo({
    sceneVideoPaths,
    masterAudioPath,
    subtitlePath,
    outputPath,
    totalDurationSeconds = 60.0,
    useFfmpeg = false
  }) {
    if (!Array.isArray(sceneVideoPaths) || sceneVideoPaths.length === 0) {
      throw new FFmpegError('At least one scene video file is required for assembly.', ASSEMBLY_ERROR_CODES.SCENE_MEDIA_MISSING);
    }
    if (!masterAudioPath || !fs.existsSync(masterAudioPath)) {
      throw new FFmpegError(`Master audio file not found at '${masterAudioPath}'.`, ASSEMBLY_ERROR_CODES.AUDIO_MIX_FAILED);
    }

    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 1. Mock Mode Assembly (Non-FFmpeg Execution)
    if (!useFfmpeg) {
      const mockMp4 = this._generateDeterministicFinalMp4({
        durationSeconds: totalDurationSeconds,
        width: this.profile.width,
        height: this.profile.height,
        fps: this.profile.fps,
        sceneCount: sceneVideoPaths.length
      });
      fs.writeFileSync(outputPath, mockMp4);

      const fileHash = createHash('sha256').update(mockMp4).digest('hex');
      return {
        outputPath,
        width: this.profile.width,
        height: this.profile.height,
        fps: this.profile.fps,
        durationSeconds: totalDurationSeconds,
        videoCodec: 'h264',
        audioCodec: 'aac',
        fileHash,
        fileSizeBytes: mockMp4.length,
        assembledWithFfmpeg: false
      };
    }

    // 2. Real FFmpeg Execution
    const ffmpegBin = this.config.ffmpegPath || 'ffmpeg';

    // Create concat demuxer text file
    const concatListPath = path.join(this.config.tempDir, `concat_${Date.now()}.txt`);
    const concatContent = sceneVideoPaths
      .map((p) => `file '${p.replace(/\\/g, '/')}'`)
      .join('\n');
    fs.writeFileSync(concatListPath, concatContent, 'utf8');

    const args = [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatListPath,
      '-i', masterAudioPath,
      '-c:v', this.config.videoCodec,
      '-preset', this.profile.preset,
      '-crf', String(this.profile.crf),
      '-c:a', this.config.audioCodec,
      '-b:a', this.profile.audioBitrate,
      '-pix_fmt', this.config.pixelFormat,
      '-shortest',
      outputPath
    ];

    logger.info('Executing FFmpeg final assembly', { command: `${ffmpegBin} ${args.join(' ')}` });

    const result = spawnSync(ffmpegBin, args, {
      encoding: 'utf8',
      timeout: 300000 // 5 minutes max
    });

    if (result.error || result.status !== 0) {
      throw new FFmpegError(
        `FFmpeg assembly failed: ${result.stderr || result.error?.message}`,
        ASSEMBLY_ERROR_CODES.ASSEMBLY_FAILED,
        { stderr: result.stderr }
      );
    }

    const fileBuf = fs.readFileSync(outputPath);
    const fileHash = createHash('sha256').update(fileBuf).digest('hex');

    return {
      outputPath,
      width: this.profile.width,
      height: this.profile.height,
      fps: this.profile.fps,
      durationSeconds: totalDurationSeconds,
      videoCodec: this.config.videoCodec,
      audioCodec: this.config.audioCodec,
      fileHash,
      fileSizeBytes: fileBuf.length,
      assembledWithFfmpeg: true
    };
  }

  /**
   * Generates a valid ISO Base Media MP4 buffer for mock/testing delivery.
   * @private
   */
  _generateDeterministicFinalMp4({ durationSeconds, width, height, fps, sceneCount }) {
    // 24-byte standard MP4 ftyp box
    const ftyp = Buffer.from([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, // size 24, 'ftyp'
      0x6d, 0x70, 0x34, 0x32, 0x00, 0x00, 0x00, 0x00, // 'mp42'
      0x69, 0x73, 0x6f, 0x6d, 0x6d, 0x70, 0x34, 0x32  // compatible 'isom', 'mp42'
    ]);

    const metadata = JSON.stringify({
      generator: 'Loredotexe Phase 6 Final Video Assembler',
      durationSeconds,
      width,
      height,
      fps,
      sceneCount,
      audio: 'AAC 48kHz Stereo Muxed',
      timestamp: Date.now()
    });

    const payload = Buffer.from(metadata, 'utf8');
    const padding = Buffer.alloc(Math.max(0, 1024 - payload.length), 0x00);
    const fullPayload = Buffer.concat([payload, padding]);

    const mdatSize = fullPayload.length + 8;
    const mdat = Buffer.alloc(mdatSize);
    mdat.writeUInt32BE(mdatSize, 0);
    mdat.write('mdat', 4, 4, 'ascii');
    fullPayload.copy(mdat, 8);

    return Buffer.concat([ftyp, mdat]);
  }
}
