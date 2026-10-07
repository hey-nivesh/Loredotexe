/**
 * Lightweight Local Video Adapter (Placeholder & Evaluation Harness) for Phase 5.
 * Targets 4–6 GB VRAM GPUs (e.g. RTX 3050 Laptop GPU) for future lightweight model selection.
 */

import { VideoModelAdapter } from './video-model-adapter.js';
import { HardwareDetector } from '../hardware/hardware-detector.js';
import { MEDIA_ERROR_CODES, ModelUnavailableError } from '../errors/media-errors.js';

export class LightweightLocalVideoAdapter extends VideoModelAdapter {
  /**
   * @param {object} [config={}]
   * @param {HardwareDetector} [hardwareDetector]
   */
  constructor(config = {}, hardwareDetector = new HardwareDetector()) {
    super();
    this.config = config;
    this.hardwareDetector = hardwareDetector;
    this.selectedModel = config.selectedModel || 'pending-evaluation';
  }

  getProviderName() {
    return 'lightweight';
  }

  getModelName() {
    return 'lightweight-local';
  }

  getCapabilities() {
    return {
      provider: 'lightweight',
      model: 'lightweight-local',
      targetGpuVramGb: 6.0,
      maxWidth: 832,
      maxHeight: 480,
      supportedFps: [16, 24],
      maxDurationSeconds: 6.0,
      supportsReferenceImages: true,
      requiresGpu: true,
      minimumVramGb: 4.0,
      recommendedVramGb: 6.0,
      minimumRamGb: 8.0
    };
  }

  /**
   * Validates local readiness for lightweight generation.
   * @returns {Promise<{ available: boolean, status: string, message: string, details?: object }>}
   */
  async validateEnvironment() {
    const hw = this.hardwareDetector.detectHardware();

    if (!hw.gpu || !hw.gpu.detected) {
      return {
        available: false,
        status: 'UNAVAILABLE',
        reason: MEDIA_ERROR_CODES.GPU_NOT_FOUND,
        message: 'No dedicated NVIDIA GPU was detected for lightweight local generation.'
      };
    }

    if (!hw.cuda_available) {
      return {
        available: false,
        status: 'UNAVAILABLE',
        reason: MEDIA_ERROR_CODES.CUDA_UNAVAILABLE,
        message: 'CUDA driver or toolkit is not active.'
      };
    }

    // Check Python version
    if (hw.python_version) {
      const parts = hw.python_version.split('.').map((p) => parseInt(p, 10));
      if (parts[0] === 3 && parts[1] > 12) {
        return {
          available: false,
          status: 'UNAVAILABLE',
          reason: MEDIA_ERROR_CODES.PYTHON_VERSION_UNSUPPORTED,
          message: `Installed Python is ${hw.python_version}. Lightweight AI generation requires an isolated Python 3.10–3.12 environment.`
        };
      }
    }

    if (this.selectedModel === 'pending-evaluation') {
      return {
        available: false,
        status: 'PENDING_MODEL_SELECTION',
        reason: 'MODEL_EVALUATION_STAGE',
        message:
          'Phase 5 infrastructure is ready. Specific lightweight 6GB model (e.g. SVD/AnimateDiff/LTX-Video) is pending evaluation in next engineering step.'
      };
    }

    return {
      available: true,
      status: 'AVAILABLE',
      message: 'Lightweight local video adapter is configured and ready.'
    };
  }

  estimateResources(scene) {
    const duration = scene?.duration_seconds || 5.0;
    return {
      estimatedVramGb: 5.5,
      estimatedRamGb: 12.0,
      estimatedSeconds: Math.round(duration * 12)
    };
  }

  async generateScene(generationRequest, options = {}) {
    const env = await this.validateEnvironment();
    if (!env.available) {
      throw new ModelUnavailableError(env.message, env.reason || MEDIA_ERROR_CODES.MODEL_NOT_INSTALLED, env);
    }

    throw new ModelUnavailableError(
      'Lightweight local generator is in evaluation stage. Use MOCK mode for end-to-end testing.',
      MEDIA_ERROR_CODES.MODEL_NOT_INSTALLED
    );
  }
}
