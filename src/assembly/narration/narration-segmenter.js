/**
 * Narration Segmenter for Phase 6.
 * Splits Phase 3 script / Phase 4 storyboard narration into clean, scene-linked narration units.
 */

import { validateNarrationSegment } from '../schema/assembly-schema.js';
import { AssemblyError, ASSEMBLY_ERROR_CODES } from '../errors/assembly-errors.js';

export class NarrationSegmenter {
  /**
   * Segments script/storyboard content into scene-aligned narration segments.
   * @param {object} scriptPackage Phase 3 canonical script package
   * @param {object} storyboardPackage Phase 4 canonical storyboard package
   * @returns {Array<object>} List of validated NarrationSegment objects
   */
  segmentNarration(scriptPackage, storyboardPackage) {
    if (!storyboardPackage || !Array.isArray(storyboardPackage.scenes) || storyboardPackage.scenes.length === 0) {
      throw new AssemblyError('Storyboard package must contain valid scenes for narration segmentation.', ASSEMBLY_ERROR_CODES.INVALID_INPUT);
    }

    const segments = [];
    const scenes = storyboardPackage.scenes;
    const chapters = scriptPackage?.chapters || [];

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const seq = scene.sequence || i + 1;
      const sceneId = scene.scene_id || `SCN_${String(seq).padStart(3, '0')}`;

      // Extract narration text from chapter or scene visual action
      let text = '';
      if (chapters[i] && chapters[i].narration) {
        text = chapters[i].narration;
      } else if (scene.action) {
        text = scene.action;
      } else if (scene.visual_purpose) {
        text = scene.visual_purpose;
      } else {
        text = `Scene ${seq} visual sequence.`;
      }

      const words = text.split(/\s+/).filter(Boolean).length;
      const estimatedDuration = scene.duration_seconds || Math.max(2.0, Math.round((words / (145 / 60)) * 10) / 10);

      const segment = validateNarrationSegment({
        narration_id: `NARR_${String(seq).padStart(3, '0')}`,
        scene_id: sceneId,
        sequence: seq,
        text,
        estimated_duration_seconds: estimatedDuration,
        actual_duration_seconds: 0.0,
        audio_path: null,
        status: 'PENDING'
      });

      segments.push(segment);
    }

    return segments;
  }
}
