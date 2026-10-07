/**
 * Abstract Base Class for Video Model Adapters.
 * Defines the clean model-independent contract for Phase 5.
 */

export class VideoModelAdapter {
  /**
   * Returns the provider identifier (e.g., 'mock', 'wan2.1', 'lightweight').
   * @returns {string}
   */
  getProviderName() {
    throw new Error('getProviderName() must be implemented by subclass.');
  }

  /**
   * Returns the model variant/name (e.g., 'mock-video', 't2v-1.3b').
   * @returns {string}
   */
  getModelName() {
    throw new Error('getModelName() must be implemented by subclass.');
  }

  /**
   * Returns model capabilities and limits.
   * @returns {object}
   */
  getCapabilities() {
    throw new Error('getCapabilities() must be implemented by subclass.');
  }

  /**
   * Validates whether the local environment and dependencies are ready to execute.
   * @returns {Promise<{ available: boolean, status: string, reason?: string, details?: object }>}
   */
  async validateEnvironment() {
    throw new Error('validateEnvironment() must be implemented by subclass.');
  }

  /**
   * Estimates computational resource requirements for a scene.
   * @param {object} scene Canonical scene object
   * @returns {{ estimatedVramGb: number, estimatedRamGb: number, estimatedSeconds: number }}
   */
  estimateResources(scene) {
    throw new Error('estimateResources() must be implemented by subclass.');
  }

  /**
   * Generates video media for a canonical scene.
   * @param {object} generationRequest Validated GenerationRequest
   * @param {object} [options={}] Generation options (output path, force, etc.)
   * @returns {Promise<object>} MediaGenerationResult
   */
  async generateScene(generationRequest, options = {}) {
    throw new Error('generateScene() must be implemented by subclass.');
  }

  /**
   * Cancels an ongoing generation job.
   * @param {string} jobId
   * @returns {Promise<void>}
   */
  async cancelGeneration(jobId) {
    // Default no-op
  }
}
