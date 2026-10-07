/**
 * Visual Beat Extractor
 * Decomposes script narration, humor annotations, and factual claims into structured visual beats.
 */

import { randomUUID } from 'node:crypto';
import { VISUAL_TYPES } from '../schema/storyboard-schema.js';

export class VisualBeatExtractor {
  constructor(config = {}) {
    this.minDurationSeconds = config.minDurationSeconds || 4.0;
    this.maxDurationSeconds = config.maxDurationSeconds || 10.0;
  }

  /**
   * Extracts visual beats from a single chapter.
   * @param {object} chapter
   * @param {number} [index=1]
   */
  extractBeatsFromChapter(chapter, index = 1) {
    const sentences = (chapter.narration || '')
      .split(/(?<=[.?!])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 5);

    const beats = [];
    const chapterId = chapter.chapter_id || chapter.chapterId || `ch-${String(index).padStart(2, '0')}`;
    const heading = chapter.heading || `Chapter ${index}`;

    beats.push({
      beat_id: `BEAT_${String(index).padStart(3, '0')}_01`,
      chapter_id: chapterId,
      sequence: 1,
      beat_type: VISUAL_TYPES.CINEMATIC,
      visual_intent: `Establishing shot and high-impact visual hook for: ${heading}`,
      spoken_text: sentences[0] || heading,
      narration_snippet: sentences[0] || heading,
      duration_seconds: 6.0,
      requires_diagram: false,
      is_meme: false
    });

    if (sentences.length > 1) {
      const midSentence = sentences.slice(1, Math.min(sentences.length, 3)).join(' ');
      beats.push({
        beat_id: `BEAT_${String(index).padStart(3, '0')}_02`,
        chapter_id: chapterId,
        sequence: 2,
        beat_type: VISUAL_TYPES.TALKING_CHARACTER,
        visual_intent: `Dramatic narrative progression and explanation`,
        spoken_text: midSentence,
        narration_snippet: midSentence,
        duration_seconds: 7.0,
        requires_diagram: false,
        is_meme: false
      });
    }

    return beats;
  }

  /**
   * Extracts granular visual storytelling beats from normalized script chapters.
   * @param {object} adaptedScript
   * @returns {Array<object>} Array of visual beats
   */
  extractBeats(adaptedScript) {
    const beats = [];
    const memeMap = new Map();
    for (const m of adaptedScript.memeSuggestions) {
      memeMap.set(m.chapter_id, m);
    }

    const humorMap = new Map();
    for (const h of adaptedScript.humorAnnotations) {
      humorMap.set(h.chapter_id, h);
    }

    let globalBeatIndex = 1;

    for (const chapter of adaptedScript.chapters) {
      const sentences = chapter.narration
        .split(/(?<=[.?!])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 5);

      // 1. Establishing / Opening beat for the chapter
      const establishingBeat = {
        beat_id: `BEAT_${String(globalBeatIndex++).padStart(3, '0')}`,
        chapter_id: chapter.chapterId,
        sequence: beats.length + 1,
        beat_type: VISUAL_TYPES.CINEMATIC,
        visual_intent: `Establishing shot and high-impact visual hook for: ${chapter.heading}`,
        narration_snippet: sentences[0] || chapter.heading,
        duration_seconds: 6,
        requires_diagram: false,
        is_meme: false
      };
      beats.push(establishingBeat);

      // 2. Core content beats (explanations, demonstrations, or character moments)
      if (sentences.length > 1) {
        const midSentence = sentences.slice(1, Math.min(sentences.length, 3)).join(' ');
        const isTechnicalOrTimeline = /timeline|mechanics|data|memory|chip|engine|sonar|system|launch|19\d\d|20\d\d/i.test(midSentence);

        beats.push({
          beat_id: `BEAT_${String(globalBeatIndex++).padStart(3, '0')}`,
          chapter_id: chapter.chapterId,
          sequence: beats.length + 1,
          beat_type: isTechnicalOrTimeline ? VISUAL_TYPES.DIAGRAM : VISUAL_TYPES.TALKING_CHARACTER,
          visual_intent: isTechnicalOrTimeline
            ? `Technical breakdown / infographic visualization clarifying key mechanisms`
            : `Dramatic character-driven narration and physical scene development`,
          narration_snippet: midSentence,
          duration_seconds: 7,
          requires_diagram: isTechnicalOrTimeline,
          is_meme: false
        });
      }

      // 3. Check for Meme / Humor visual opportunity in this chapter
      const chapterMeme = memeMap.get(chapter.chapterId);
      if (chapterMeme) {
        beats.push({
          beat_id: `BEAT_${String(globalBeatIndex++).padStart(3, '0')}`,
          chapter_id: chapter.chapterId,
          sequence: beats.length + 1,
          beat_type: VISUAL_TYPES.MEME_INSERT,
          visual_intent: `Comedic visual reaction / parody insert: ${chapterMeme.suggested_format_or_reaction}`,
          narration_snippet: chapterMeme.intended_joke || 'Comedic timing beat',
          duration_seconds: Math.max(4.0, Math.min(10.0, chapterMeme.approximate_duration_seconds || 4.0)),
          requires_diagram: false,
          is_meme: true,
          meme_reference: chapterMeme
        });
      }

      // 4. Climax / Resolution beat for the chapter
      if (sentences.length > 2) {
        const closingSentence = sentences[sentences.length - 1];
        beats.push({
          beat_id: `BEAT_${String(globalBeatIndex++).padStart(3, '0')}`,
          chapter_id: chapter.chapterId,
          sequence: beats.length + 1,
          beat_type: VISUAL_TYPES.ENVIRONMENT,
          visual_intent: `Impactful visual conclusion and visual transition out of: ${chapter.heading}`,
          narration_snippet: closingSentence,
          duration_seconds: 6,
          requires_diagram: false,
          is_meme: false
        });
      }
    }

    return beats;
  }
}

export const visualBeatExtractor = new VisualBeatExtractor();
