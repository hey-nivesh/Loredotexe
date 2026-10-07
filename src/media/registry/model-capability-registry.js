/**
 * Model Capability Registry for Phase 5 Media Generation Engine.
 * Formally defines system requirements, VRAM thresholds, and compatibility rules for all video models.
 */

export const MODEL_SUPPORT_STATUS = Object.freeze({
  SUPPORTED: 'SUPPORTED',
  SUPPORTED_WITH_LIMITATIONS: 'SUPPORTED_WITH_LIMITATIONS',
  UNSUPPORTED: 'UNSUPPORTED'
});

export const REGISTERED_MODELS = Object.freeze({
  'mock-video': {
    model_id: 'mock-video',
    provider: 'mock',
    name: 'Deterministic Mock Video Generator',
    minimum_vram_gb: 0,
    recommended_vram_gb: 0,
    minimum_ram_gb: 1,
    recommended_ram_gb: 2,
    supported_python_versions: ['any'],
    supported_os: ['windows', 'linux', 'darwin'],
    approximate_disk_requirement_gb: 0.1,
    generation_modes: ['mock', 'dry-run'],
    resolution_limits: { max_width: 1920, max_height: 1080 },
    known_constraints: ['Placeholder media only for CI and testing']
  },
  'lightweight-local': {
    model_id: 'lightweight-local',
    provider: 'lightweight',
    name: 'Lightweight Local Video Generator (6GB GPU Tier)',
    minimum_vram_gb: 4.0,
    recommended_vram_gb: 6.0,
    minimum_ram_gb: 8.0,
    recommended_ram_gb: 16.0,
    supported_python_versions: ['3.10', '3.11', '3.12'],
    supported_os: ['windows', 'linux'],
    approximate_disk_requirement_gb: 5.0,
    generation_modes: ['local', 'dry-run'],
    resolution_limits: { max_width: 832, max_height: 480 },
    known_constraints: [
      'Requires Python 3.10-3.12 isolated virtual environment',
      'Targeted for 6GB RTX 3050 Laptop GPU tier'
    ]
  },
  'wan2.1-t2v-1.3b': {
    model_id: 'wan2.1-t2v-1.3b',
    provider: 'wan2.1',
    name: 'Wan2.1 Text-to-Video 1.3B',
    minimum_vram_gb: 8.0,
    recommended_vram_gb: 12.0,
    minimum_ram_gb: 16.0,
    recommended_ram_gb: 32.0,
    supported_python_versions: ['3.10', '3.11', '3.12'],
    supported_os: ['windows', 'linux'],
    approximate_disk_requirement_gb: 15.0,
    generation_modes: ['local', 'dry-run'],
    resolution_limits: { max_width: 832, max_height: 480 },
    known_constraints: [
      'High VRAM requirement exceeding 6GB laptop GPUs',
      'Requires CUDA 11.8+ and PyTorch with FlashAttention',
      'Requires Python <= 3.12'
    ]
  }
});

export class ModelCapabilityRegistry {
  constructor(customModels = {}) {
    this.models = { ...REGISTERED_MODELS, ...customModels };
  }

  /**
   * Retrieves a registered model specification.
   * @param {string} modelId
   * @returns {object|null}
   */
  getModel(modelId) {
    return this.models[modelId] || null;
  }

  /**
   * Evaluates compatibility of a specific model against detected hardware.
   * @param {string} modelId
   * @param {object} hardware
   * @returns {object} Structured evaluation verdict
   */
  evaluateCompatibility(modelId, hardware) {
    const model = this.getModel(modelId);
    if (!model) {
      return {
        modelId,
        status: MODEL_SUPPORT_STATUS.UNSUPPORTED,
        reasons: [`Model '${modelId}' is not registered in capability registry.`],
        details: {}
      };
    }

    if (model.provider === 'mock') {
      return {
        modelId,
        status: MODEL_SUPPORT_STATUS.SUPPORTED,
        reasons: ['Mock adapter runs universally on any platform without hardware prerequisites.'],
        details: { model }
      };
    }

    const reasons = [];
    let isUnsupported = false;
    let isLimited = false;

    // 1. GPU Presence Check
    if (!hardware.gpu || !hardware.gpu.detected) {
      isUnsupported = true;
      reasons.push('No dedicated NVIDIA GPU detected on the system.');
    }

    // 2. VRAM Check
    const availableVram = hardware.gpu?.vram_gb || 0;
    if (availableVram < model.minimum_vram_gb) {
      isUnsupported = true;
      reasons.push(
        `Insufficient GPU VRAM: Model requires at least ${model.minimum_vram_gb} GB, but only ${availableVram} GB is available.`
      );
    } else if (availableVram < model.recommended_vram_gb) {
      isLimited = true;
      reasons.push(
        `Available VRAM (${availableVram} GB) is below recommended (${model.recommended_vram_gb} GB); memory offloading will be required.`
      );
    }

    // 3. System RAM Check
    const availableRam = hardware.system_ram_gb || 0;
    if (availableRam < model.minimum_ram_gb) {
      isUnsupported = true;
      reasons.push(
        `Insufficient System RAM: Model requires at least ${model.minimum_ram_gb} GB, but only ${availableRam} GB is available.`
      );
    } else if (availableRam < model.recommended_ram_gb) {
      isLimited = true;
      reasons.push(`System RAM (${availableRam} GB) is below recommended (${model.recommended_ram_gb} GB).`);
    }

    // 4. Free Disk Space Check
    const freeDisk = hardware.disk_free_gb || 0;
    if (freeDisk < model.approximate_disk_requirement_gb) {
      isUnsupported = true;
      reasons.push(
        `Insufficient Free Disk: Model requires ~${model.approximate_disk_requirement_gb} GB, but only ${freeDisk} GB is available.`
      );
    }

    // 5. Python Version Compatibility Check
    if (!model.supported_python_versions.includes('any')) {
      const pythonVer = hardware.python_version;
      if (!pythonVer) {
        isUnsupported = true;
        reasons.push('Python is not installed or not discoverable in PATH.');
      } else {
        const parts = pythonVer.split('.').map((p) => parseInt(p, 10));
        const majorMinor = `${parts[0]}.${parts[1]}`;
        if (!model.supported_python_versions.includes(majorMinor)) {
          isUnsupported = true;
          reasons.push(
            `Unsupported Python version (${pythonVer}): Model requires Python ${model.supported_python_versions.join(' / ')}. Python 3.13+ is currently not supported by AI model wheels.`
          );
        }
      }
    }

    // 6. CUDA Availability Check
    if (!hardware.cuda_available) {
      isUnsupported = true;
      reasons.push('CUDA is not available or not properly detected.');
    }

    let finalStatus = MODEL_SUPPORT_STATUS.SUPPORTED;
    if (isUnsupported) {
      finalStatus = MODEL_SUPPORT_STATUS.UNSUPPORTED;
    } else if (isLimited) {
      finalStatus = MODEL_SUPPORT_STATUS.SUPPORTED_WITH_LIMITATIONS;
    }

    return {
      modelId,
      modelName: model.name,
      status: finalStatus,
      reasons,
      details: {
        required_vram_gb: model.minimum_vram_gb,
        available_vram_gb: availableVram,
        required_ram_gb: model.minimum_ram_gb,
        available_ram_gb: availableRam,
        required_disk_gb: model.approximate_disk_requirement_gb,
        available_disk_gb: freeDisk,
        python_version: hardware.python_version,
        cuda_version: hardware.cuda_version
      }
    };
  }
}
