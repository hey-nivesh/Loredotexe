/**
 * Deterministic Mock Video Model Adapter for Phase 5.
 * Generates lightweight, genuinely valid H.264/MP4 media assets via FFmpeg for testing, CI, and local workflows.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { VideoModelAdapter } from './video-model-adapter.js';
import { FFmpegDetector } from '../../assembly/ffmpeg/ffmpeg-detector.js';

export class MockVideoModelAdapter extends VideoModelAdapter {
  constructor(config = {}) {
    super();
    this.config = config;
    this.detector = new FFmpegDetector(config);
  }

  getProviderName() {
    return 'mock';
  }

  getModelName() {
    return 'mock-video';
  }

  getCapabilities() {
    return {
      provider: 'mock',
      model: 'mock-video',
      maxWidth: 1920,
      maxHeight: 1080,
      supportedFps: [16, 24, 30, 60],
      maxDurationSeconds: 60.0,
      supportsReferenceImages: true,
      requiresGpu: false
    };
  }

  async validateEnvironment() {
    return {
      available: true,
      status: 'AVAILABLE',
      message: 'Mock adapter is available and ready for execution.'
    };
  }

  estimateResources(scene) {
    const duration = scene?.duration_seconds || 5.0;
    return {
      estimatedVramGb: 0,
      estimatedRamGb: 0.1,
      estimatedSeconds: Math.round(duration * 0.05 * 100) / 100
    };
  }

  /**
   * Generates a deterministic, genuinely valid mock video asset using FFmpeg.
   * @param {object} generationRequest
   * @param {object} [options={}]
   * @returns {Promise<object>}
   */
  async generateScene(generationRequest, options = {}) {
    const sceneId = generationRequest.scene_id || 'S001';
    const duration = generationRequest.duration_seconds || 5.0;
    const width = generationRequest.width || 832;
    const height = generationRequest.height || 480;
    const fps = generationRequest.fps || 24;
    const projectId = options.projectId || 'PRJ_MOCK';
    const version = options.version || 1;

    // Determine target output directory
    const outputDir =
      options.outputDir ||
      path.join(process.cwd(), 'data', 'media', 'generated', projectId, sceneId, `v${version}`);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const videoPath = (options.outputPath || path.join(outputDir, 'scene.mp4')).replace(/\\/g, '/');
    const metadataPath = path.join(path.dirname(videoPath), 'metadata.json').replace(/\\/g, '/');

    if (!fs.existsSync(path.dirname(videoPath))) {
      fs.mkdirSync(path.dirname(videoPath), { recursive: true });
    }

    // Generate genuinely valid MP4 via FFmpeg
    this._generateValidMockMp4WithFfmpeg({
      videoPath,
      sceneId,
      duration,
      width,
      height,
      fps
    });

    if (!fs.existsSync(videoPath) || fs.statSync(videoPath).size === 0) {
      throw new Error(`Failed to generate valid MP4 at '${videoPath}'.`);
    }

    const fileBuf = fs.readFileSync(videoPath);
    const fileHash = createHash('sha256').update(fileBuf).digest('hex');
    const promptHash = createHash('sha256')
      .update((generationRequest.prompt || '') + (generationRequest.negative_prompt || ''))
      .digest('hex');

    const assetId = options.assetId || `ASSET_${sceneId}_v${version}_${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    const metadata = {
      asset_id: assetId,
      project_id: projectId,
      scene_id: sceneId,
      type: 'video',
      provider: this.getProviderName(),
      model: this.getModelName(),
      version,
      file_path: videoPath,
      file_hash: fileHash,
      prompt_hash: promptHash,
      generation_parameters: {
        width,
        height,
        fps,
        duration_seconds: duration,
        prompt: generationRequest.prompt,
        negative_prompt: generationRequest.negative_prompt
      },
      duration_seconds: duration,
      width,
      height,
      fps,
      file_size_bytes: fileBuf.length,
      created_at: now,
      status: 'VALID'
    };

    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

    return {
      status: 'COMPLETED',
      provider: this.getProviderName(),
      model: this.getModelName(),
      asset_id: assetId,
      output_path: videoPath,
      metadata_path: metadataPath,
      duration_seconds: duration,
      width,
      height,
      fps,
      file_hash: fileHash,
      file_size_bytes: fileBuf.length,
      metadata
    };
  }

  /**
   * Generates a genuinely valid MP4 with H.264 video, silent audio, valid moov atom, and faststart.
   * @private
   */
  _generateValidMockMp4WithFfmpeg({ videoPath, sceneId, duration, width, height, fps }) {
    const ffmpegBin = this.detector.getFFmpegPath();

    // Width and height must be divisible by 2 for libx264 yuv420p
    const validWidth = width % 2 === 0 ? width : width + 1;
    const validHeight = height % 2 === 0 ? height : height + 1;
    const validFps = Math.max(1, fps || 24);
    const validDuration = Math.max(0.5, duration || 5.0);

    const args = [
      '-y',
      '-f', 'lavfi',
      '-i', `color=c=0x181824:s=${validWidth}x${validHeight}:r=${validFps}:d=${validDuration}`,
      '-f', 'lavfi',
      '-i', `anullsrc=r=44100:cl=stereo:d=${validDuration}`,
      '-c:v', 'libx264',
      '-tune', 'stillimage',
      '-preset', 'ultrafast',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-shortest',
      '-movflags', '+faststart',
      videoPath
    ];

    const result = spawnSync(ffmpegBin, args, {
      encoding: 'utf8',
      timeout: 30000,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    if (result.error || result.status !== 0 || !fs.existsSync(videoPath)) {
      throw new Error(
        `FFmpeg mock video generation failed: ${result.stderr || result.error?.message || 'Unknown error'}`
      );
    }
  }
}
