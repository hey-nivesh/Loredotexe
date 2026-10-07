/**
 * Hardware Report Generator for Phase 5 Media Generation Engine.
 * Formulates a complete hardware profile, evaluates all registered models, and produces recommendation.
 */

import { HardwareDetector } from './hardware-detector.js';
import { ModelCapabilityRegistry, MODEL_SUPPORT_STATUS } from '../registry/model-capability-registry.js';

export class HardwareReportService {
  /**
   * @param {HardwareDetector} [detector]
   * @param {ModelCapabilityRegistry} [registry]
   */
  constructor(detector = new HardwareDetector(), registry = new ModelCapabilityRegistry()) {
    this.detector = detector;
    this.registry = registry;
  }

  /**
   * Generates a comprehensive hardware evaluation report.
   * @returns {object} Complete Hardware Report
   */
  generateReport() {
    const hardware = this.detector.detectHardware();
    const modelEvaluations = {};

    for (const modelId of Object.keys(this.registry.models)) {
      modelEvaluations[modelId] = this.registry.evaluateCompatibility(modelId, hardware);
    }

    // Determine overall recommended mode
    let recommendedMode = 'MOCK';
    const recommendations = [];

    const wanEval = modelEvaluations['wan2.1-t2v-1.3b'];
    const lightweightEval = modelEvaluations['lightweight-local'];

    if (wanEval && wanEval.status === MODEL_SUPPORT_STATUS.SUPPORTED) {
      recommendedMode = 'LOCAL_WAN21';
      recommendations.push('System has ample VRAM and RAM to execute Wan2.1 T2V-1.3B locally.');
    } else if (lightweightEval && lightweightEval.status !== MODEL_SUPPORT_STATUS.UNSUPPORTED) {
      recommendedMode = 'LOCAL_LIGHTWEIGHT';
      recommendations.push('System meets requirements for a 6GB-optimized lightweight local video backend (e.g. SVD/AnimateDiff/LTX-Video).');
    } else {
      recommendedMode = 'MOCK';
      recommendations.push('Hardware constraints (VRAM or Python version) suggest using MOCK mode or evaluating lightweight quantized backends.');
    }

    // Specific note for current 6GB RTX 3050 Laptop setup
    if (hardware.gpu?.vram_gb && hardware.gpu.vram_gb <= 6.0) {
      recommendations.push(
        'GPU VRAM is approximately 6 GB. High-end models like Wan2.1 are classified as UNSUPPORTED due to VRAM limits. A lightweight 6GB generator is recommended for future real generation.'
      );
    }

    if (hardware.python_version && hardware.python_version.startsWith('3.13')) {
      recommendations.push(
        `Installed Python is ${hardware.python_version}. Most generative video backends require Python 3.10–3.12. Set up an isolated Python 3.10–3.12 virtual environment when installing local AI models.`
      );
    }

    return {
      timestamp: new Date().toISOString(),
      hardware: {
        os: hardware.os,
        cpu: hardware.cpu,
        system_ram_gb: hardware.system_ram_gb,
        free_ram_gb: hardware.free_ram_gb,
        gpu: hardware.gpu,
        cuda_available: hardware.cuda_available,
        cuda_version: hardware.cuda_version,
        python_version: hardware.python_version,
        pytorch_version: hardware.pytorch_version,
        disk_free_gb: hardware.disk_free_gb,
        disk_path: hardware.disk_path
      },
      model_evaluations: modelEvaluations,
      recommended_mode: recommendedMode,
      recommendations
    };
  }
}
