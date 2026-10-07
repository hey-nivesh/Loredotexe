/**
 * Deterministic Mock Video Model Adapter for Phase 5.
 * Generates lightweight, valid placeholder media assets for testing and CI without GPU/model requirements.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { VideoModelAdapter } from './video-model-adapter.js';

export class MockVideoModelAdapter extends VideoModelAdapter {
  constructor(config = {}) {
    super();
    this.config = config;
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
      estimatedSeconds: Math.round(duration * 0.01 * 100) / 100
    };
  }

  /**
   * Generates a deterministic mock video asset.
   * @param {object} generationRequest
   * @param {object} [options={}]
   * @returns {Promise<object>}
   */
  async generateScene(generationRequest, options = {}) {
    const sceneId = generationRequest.scene_id || 'S001';
    const duration = generationRequest.duration_seconds || 5.0;
    const width = generationRequest.width || 832;
    const height = generationRequest.height || 480;
    const fps = generationRequest.fps || 16;
    const projectId = options.projectId || 'PRJ_MOCK';
    const version = options.version || 1;

    // Determine target output directory
    const outputDir =
      options.outputDir ||
      path.join(process.cwd(), 'data', 'media', 'generated', projectId, sceneId, `v${version}`);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const videoPath = options.outputPath || path.join(outputDir, 'scene.mp4');
    const metadataPath = path.join(outputDir, 'metadata.json');

    // Create a deterministic valid mock media binary (ftyp mp4 container header + payload)
    const mockBinary = this._generateDeterministicMockMp4({
      sceneId,
      duration,
      width,
      height,
      prompt: generationRequest.prompt
    });

    fs.writeFileSync(videoPath, mockBinary);

    // Compute SHA-256 hash
    const fileHash = createHash('sha256').update(mockBinary).digest('hex');
    const promptHash = createHash('sha256')
      .update(generationRequest.prompt + (generationRequest.negative_prompt || ''))
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
      file_size_bytes: mockBinary.length,
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
      file_size_bytes: mockBinary.length,
      metadata
    };
  }

  /**
   * Generates a minimal valid MP4 binary buffer.
   * @private
   */
  _generateDeterministicMockMp4({ sceneId, duration, width, height, prompt }) {
    // Minimal standard ISO base media file (MP4 ftyp + moov/mdat box structure)
    const header = Buffer.from([
      // ftyp box (24 bytes)
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, // size 24, 'ftyp'
      0x6d, 0x70, 0x34, 0x32, 0x00, 0x00, 0x00, 0x00, // 'mp42', minor version 0
      0x69, 0x73, 0x6f, 0x6d, 0x6d, 0x70, 0x34, 0x32  // compatible brands: 'isom', 'mp42'
    ]);

    // mdat payload containing encoded scene metadata + standard padding
    const payloadStr = JSON.stringify({
      generator: 'Loredotexe MockVideoAdapter v1.0',
      sceneId,
      duration,
      width,
      height,
      promptHash: createHash('sha256').update(prompt || '').digest('hex'),
      timestamp: Date.now()
    });
    const payloadBuf = Buffer.from(payloadStr, 'utf8');
    const paddingBuf = Buffer.alloc(Math.max(0, 512 - payloadBuf.length), 0x00);
    const combinedPayload = Buffer.concat([payloadBuf, paddingBuf]);

    // mdat box header (8 bytes)
    const mdatSize = combinedPayload.length + 8;
    const mdatBox = Buffer.alloc(mdatSize);
    mdatBox.writeUInt32BE(mdatSize, 0);
    mdatBox.write('mdat', 4, 4, 'ascii');
    combinedPayload.copy(mdatBox, 8);

    return Buffer.concat([header, mdatBox]);
  }
}
