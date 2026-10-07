/**
 * Future Video Model Adapter Interface Contract
 * Enables future Phase 5 media-generation adapters to consume Phase 4 canonical scenes without altering storyboard logic.
 */

export class VideoModelAdapter {
  /**
   * Generates video or image media from a canonical model-independent scene.
   * @param {object} scene Canonical scene object from Phase 4
   * @returns {Promise<object>} Media generation result
   */
  async generateScene(scene) {
    throw new Error('VideoModelAdapter.generateScene() is an interface contract to be implemented in Phase 5.');
  }

  /**
   * Generates character or location reference assets.
   * @param {object} referenceRequirement Reference manifest requirement
   * @returns {Promise<object>}
   */
  async generateReferenceAsset(referenceRequirement) {
    throw new Error('VideoModelAdapter.generateReferenceAsset() is an interface contract to be implemented in Phase 5.');
  }

  /**
   * Translates a canonical Phase 4 scene into a Wan2.1 video generation request payload.
   * @param {object} scene
   * @returns {object}
   */
  static adaptToWan21(scene) {
    return {
      model: 'wan2.1-t2v-14b',
      prompt: scene.visual_prompt,
      negative_prompt: scene.negative_prompt,
      num_frames: Math.round((scene.duration_seconds || 6) * 24),
      fps: 24,
      width: 1280,
      height: 720,
      camera_movement: scene.camera?.movement || 'static'
    };
  }

  /**
   * Translates a canonical Phase 4 scene into an AnimateDiff motion payload.
   * @param {object} scene
   * @returns {object}
   */
  static adaptToAnimateDiff(scene) {
    return {
      positive_prompt: scene.visual_prompt,
      negative_prompt: scene.negative_prompt,
      motion_module: 'mm_sd_v15_v2',
      frame_length: Math.round((scene.duration_seconds || 6) * 16),
      fps: 16
    };
  }

  /**
   * Translates a canonical Phase 4 scene into a ComfyUI workflow request.
   * @param {object} scene
   * @returns {object}
   */
  static adaptToComfyUI(scene) {
    return {
      prompt: {
        '6': {
          inputs: { text: scene.visual_prompt },
          class_type: 'CLIPTextEncode'
        },
        '7': {
          inputs: { text: scene.negative_prompt },
          class_type: 'CLIPTextEncode'
        }
      },
      extra_data: {
        scene_id: scene.scene_id,
        duration: scene.duration_seconds
      }
    };
  }
}
