/**
 * Timeline Synchronizer for Phase 6 Audio & Video Alignment.
 * Reconciles visual scene durations with synthesized narration timing.
 */

import { TimelineError, ASSEMBLY_ERROR_CODES } from '../errors/assembly-errors.js';
import { logger } from '../../logging/logger.js';

export class TimelineSynchronizer {
  /**
   * @param {object} [options={}]
   */
  constructor(options = {}) {
    this.maxAllowedOverflowSeconds = options.maxAllowedOverflowSeconds || 1.5;
  }

  /**
   * Synchronizes visual scenes with synthesized narration segments.
   * @param {Array<object>} scenes Phase 4 canonical scenes / Phase 5 media assets
   * @param {Array<object>} narrationSegments Synthesized narration segments
   * @returns {object} Synchronized Timeline & Timing Report
   */
  synchronize(scenes, narrationSegments) {
    if (!Array.isArray(scenes) || scenes.length === 0) {
      throw new TimelineError('Scenes array is required for synchronization.', ASSEMBLY_ERROR_CODES.INVALID_INPUT);
    }
    if (!Array.isArray(narrationSegments) || narrationSegments.length === 0) {
      throw new TimelineError('Narration segments are required for synchronization.', ASSEMBLY_ERROR_CODES.NARRATION_MISSING);
    }

    const synchronizedScenes = [];
    const timingReport = {
      status: 'VALID',
      total_visual_duration: 0.0,
      total_audio_duration: 0.0,
      conflicts: [],
      warnings: [],
      adjustments: []
    };

    let timelineOffset = 0.0;

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const narr = narrationSegments.find(
        (n) => n.scene_id === scene.scene_id || n.sequence === (scene.sequence || i + 1)
      );

      const visualDuration = scene.duration_seconds || 5.0;
      const audioDuration = narr?.actual_duration_seconds || narr?.estimated_duration_seconds || visualDuration;

      timingReport.total_visual_duration += visualDuration;
      timingReport.total_audio_duration += audioDuration;

      let reconciledDuration = visualDuration;
      let visualHoldSeconds = 0.0;

      // Case 1: Audio is longer than visual duration
      if (audioDuration > visualDuration) {
        const diff = audioDuration - visualDuration;
        if (diff > this.maxAllowedOverflowSeconds) {
          timingReport.conflicts.push({
            scene_id: scene.scene_id,
            type: ASSEMBLY_ERROR_CODES.NARRATION_OVERFLOW,
            visual_duration: visualDuration,
            audio_duration: audioDuration,
            overflow_seconds: diff,
            message: `Narration exceeds scene visual duration by ${diff.toFixed(2)}s.`
          });
          timingReport.status = 'CONFLICT';
        } else {
          // Micro-extend scene timing to accommodate narration
          reconciledDuration = audioDuration;
          timingReport.adjustments.push({
            scene_id: scene.scene_id,
            action: 'EXTEND_VISUAL',
            added_seconds: diff
          });
        }
      } 
      // Case 2: Audio is shorter than visual duration
      else if (visualDuration > audioDuration) {
        visualHoldSeconds = Math.round((visualDuration - audioDuration) * 1000) / 1000;
        if (visualHoldSeconds > 3.0) {
          timingReport.warnings.push({
            scene_id: scene.scene_id,
            type: 'LONG_SCENE',
            visual_duration: visualDuration,
            audio_duration: audioDuration,
            hold_seconds: visualHoldSeconds,
            message: `Scene is ${visualHoldSeconds.toFixed(2)}s longer than narration; visual hold applied.`
          });
        }
      }

      const sceneStart = Math.round(timelineOffset * 1000) / 1000;
      const sceneEnd = Math.round((timelineOffset + reconciledDuration) * 1000) / 1000;

      synchronizedScenes.push({
        scene_id: scene.scene_id,
        sequence: scene.sequence || i + 1,
        start_seconds: sceneStart,
        end_seconds: sceneEnd,
        duration_seconds: reconciledDuration,
        visual_duration: visualDuration,
        audio_duration: audioDuration,
        visual_hold_seconds: visualHoldSeconds,
        narration: narr ? {
          narration_id: narr.narration_id,
          text: narr.text,
          audio_path: narr.audio_path
        } : null
      });

      timelineOffset = sceneEnd;
    }

    return {
      synchronized_scenes: synchronizedScenes,
      total_duration_seconds: Math.round(timelineOffset * 1000) / 1000,
      timing_report: timingReport
    };
  }
}
