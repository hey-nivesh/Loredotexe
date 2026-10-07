/**
 * Wan2.1 Video Model Adapter for Phase 5.
 * Provides integration for Wan2.1 T2V-1.3B with strict environment validation,
 * safe non-download enforcement, VRAM checks, and isolated Python runner bridge.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { VideoModelAdapter } from './video-model-adapter.js';
import { HardwareDetector } from '../hardware/hardware-detector.js';
import { logger } from '../../logging/logger.js';
import { MEDIA_ERROR_CODES, ModelUnavailableError, HardwareConstraintError } from '../errors/media-errors.js';

export class Wan21VideoAdapter extends VideoModelAdapter {
  /**
   * @param {object} [config={}]
   * @param {HardwareDetector} [hardwareDetector]
   */
  constructor(config = {}, hardwareDetector = new HardwareDetector()) {
    super();
    this.config = config;
    this.hardwareDetector = hardwareDetector;
    this.modelPath = config.modelPath || process.env.VIDEO_MODEL_PATH || null;
    this.allowModelDownload = config.allowModelDownload || process.env.MEDIA_ALLOW_MODEL_DOWNLOAD === 'true';
  }

  getProviderName() {
    return 'wan2.1';
  }

  getModelName() {
    return 't2v-1.3b';
  }

  getCapabilities() {
    return {
      provider: 'wan2.1',
      model: 't2v-1.3b',
      maxWidth: 832,
      maxHeight: 480,
      supportedFps: [16],
      maxDurationSeconds: 10.0,
      supportsReferenceImages: false,
      requiresGpu: true,
      minimumVramGb: 8.0,
      recommendedVramGb: 12.0,
      minimumRamGb: 16.0
    };
  }

  /**
   * Validates hardware, VRAM, Python, and model paths before any attempt to execute.
   * @returns {Promise<{ available: boolean, status: string, reason?: string, message?: string, details?: object }>}
   */
  async validateEnvironment() {
    const hw = this.hardwareDetector.detectHardware();

    // 1. Check GPU presence
    if (!hw.gpu || !hw.gpu.detected) {
      return {
        available: false,
        status: 'UNAVAILABLE',
        reason: MEDIA_ERROR_CODES.GPU_NOT_FOUND,
        message: 'No dedicated NVIDIA GPU was detected on this machine.',
        details: { gpu: hw.gpu }
      };
    }

    // 2. Check CUDA availability
    if (!hw.cuda_available) {
      return {
        available: false,
        status: 'UNAVAILABLE',
        reason: MEDIA_ERROR_CODES.CUDA_UNAVAILABLE,
        message: 'CUDA is not available or not properly configured.',
        details: { cuda_version: hw.cuda_version }
      };
    }

    // 3. Check VRAM sufficiency (Strict 8 GB minimum for Wan2.1 1.3B)
    const availableVram = hw.gpu.vram_gb || 0;
    if (availableVram < 8.0) {
      return {
        available: false,
        status: 'UNAVAILABLE',
        reason: MEDIA_ERROR_CODES.INSUFFICIENT_VRAM,
        message: `Wan2.1 T2V-1.3B requires at least 8.0 GB VRAM. Detected available VRAM is ${availableVram} GB on ${hw.gpu.name}.`,
        details: {
          required_vram_gb: 8.0,
          available_vram_gb: availableVram,
          gpu_name: hw.gpu.name
        }
      };
    }

    // 4. Check Python version compatibility
    if (hw.python_version) {
      const parts = hw.python_version.split('.').map((p) => parseInt(p, 10));
      if (parts[0] === 3 && parts[1] > 12) {
        return {
          available: false,
          status: 'UNAVAILABLE',
          reason: MEDIA_ERROR_CODES.PYTHON_VERSION_UNSUPPORTED,
          message: `Installed Python is ${hw.python_version}. Wan2.1 requires Python 3.10–3.12 (Python 3.13+ is unsupported by generative video PyTorch wheels).`,
          details: {
            installed_python: hw.python_version,
            supported_versions: ['3.10', '3.11', '3.12']
          }
        };
      }
    }

    // 5. Check model file existence (Strict Non-Download Policy)
    if (!this.modelPath || !fs.existsSync(this.modelPath)) {
      return {
        available: false,
        status: 'UNAVAILABLE',
        reason: MEDIA_ERROR_CODES.MODEL_NOT_INSTALLED,
        message: `Wan2.1 model weights not found at path: '${this.modelPath || 'NOT_SET'}'. Automatic download is disabled (MEDIA_ALLOW_MODEL_DOWNLOAD=false).`,
        details: {
          configured_path: this.modelPath,
          allow_download: this.allowModelDownload
        }
      };
    }

    return {
      available: true,
      status: 'AVAILABLE',
      message: 'Wan2.1 adapter environment verified and ready.'
    };
  }

  estimateResources(scene) {
    const duration = scene?.duration_seconds || 5.0;
    return {
      estimatedVramGb: 8.0,
      estimatedRamGb: 16.0,
      estimatedSeconds: Math.round(duration * 25) // ~25s per second of video on modern GPU
    };
  }

  /**
   * Generates scene video via isolated Python subprocess.
   * @param {object} generationRequest
   * @param {object} [options={}]
   * @returns {Promise<object>}
   */
  async generateScene(generationRequest, options = {}) {
    const envCheck = await this.validateEnvironment();
    if (!envCheck.available) {
      if (envCheck.reason === MEDIA_ERROR_CODES.INSUFFICIENT_VRAM) {
        throw new HardwareConstraintError(envCheck.message, envCheck.reason, envCheck.details);
      }
      throw new ModelUnavailableError(envCheck.message, envCheck.reason, envCheck.details);
    }

    const runnerScript = path.join(process.cwd(), 'src', 'media', 'python', 'wan_t2v_runner.py');
    const sceneId = generationRequest.scene_id || 'S001';
    const projectId = options.projectId || 'PRJ_WAN';
    const version = options.version || 1;
    const outputDir =
      options.outputDir ||
      path.join(process.cwd(), 'data', 'media', 'generated', projectId, sceneId, `v${version}`);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, 'scene.mp4');

    return new Promise((resolve, reject) => {
      const args = [
        runnerScript,
        '--prompt', generationRequest.prompt,
        '--negative_prompt', generationRequest.negative_prompt || '',
        '--width', String(generationRequest.width || 832),
        '--height', String(generationRequest.height || 480),
        '--duration', String(generationRequest.duration_seconds || 5),
        '--fps', String(generationRequest.fps || 16),
        '--output', outputPath,
        '--model_path', this.modelPath,
        '--offload', this.config.offloadModel ? 'true' : 'false',
        '--t5_cpu', this.config.t5Cpu ? 'true' : 'false'
      ];

      logger.info('Launching isolated Wan2.1 Python runner', { sceneId, args });

      const child = spawn('python', args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (d) => { stdout += d.toString(); });
      child.stderr.on('data', (d) => { stderr += d.toString(); });

      child.on('error', (err) => {
        reject(new ModelUnavailableError(`Failed to spawn Python process: ${err.message}`, MEDIA_ERROR_CODES.GENERATION_FAILED));
      });

      child.on('close', (code) => {
        if (code === 0) {
          try {
            const parsed = JSON.parse(stdout.trim().split('\n').pop());
            resolve({
              status: 'COMPLETED',
              provider: this.getProviderName(),
              model: this.getModelName(),
              output_path: outputPath,
              ...parsed
            });
          } catch (_) {
            resolve({
              status: 'COMPLETED',
              provider: this.getProviderName(),
              model: this.getModelName(),
              output_path: outputPath
            });
          }
        } else {
          reject(new ModelUnavailableError(`Wan2.1 runner exited with code ${code}: ${stderr || stdout}`, MEDIA_ERROR_CODES.GENERATION_FAILED));
        }
      });
    });
  }
}
