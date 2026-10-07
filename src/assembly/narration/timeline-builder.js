/**
 * Narration Timeline Builder for Phase 6.
 * Calculates sequential timeline offsets for synthesized audio segments.
 */

import { validateNarrationTimeline } from '../schema/assembly-schema.js';

export class TimelineBuilder {
  /**
   * Constructs a continuous timeline from synthesized narration segments.
   * @param {Array<object>} synthesizedSegments
   * @returns {object} Canonical Narration Timeline
   */
  buildTimeline(synthesizedSegments) {
    let currentOffset = 0.0;
    const timelineSegments = [];

    for (const seg of synthesizedSegments) {
      const duration = seg.actual_duration_seconds || seg.estimated_duration_seconds || 5.0;
      const start = Math.round(currentOffset * 1000) / 1000;
      const end = Math.round((currentOffset + duration) * 1000) / 1000;

      timelineSegments.push({
        narration_id: seg.narration_id,
        scene_id: seg.scene_id,
        sequence: seg.sequence,
        text: seg.text,
        start_seconds: start,
        end_seconds: end,
        duration_seconds: duration,
        audio_path: seg.audio_path
      });

      currentOffset = end;
    }

    return validateNarrationTimeline({
      timeline_version: 1,
      total_duration_seconds: Math.round(currentOffset * 1000) / 1000,
      segments: timelineSegments
    });
  }
}
