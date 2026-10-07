/**
 * Script Input Adapter
 * Normalizes and isolates Phase 3 script packages for Phase 4 consumption.
 */

import { ScriptInputError } from '../errors/storyboard-errors.js';

export class ScriptInputAdapter {
  /**
   * Adapts and validates an incoming Phase 3 script payload.
   * @param {object} rawInput
   * @returns {object} Normalized script input for Phase 4
   */
  adapt(rawInput) {
    if (!rawInput || typeof rawInput !== 'object') {
      throw new ScriptInputError('Script input payload must be a non-empty object.');
    }

    const script = rawInput.scriptPackage || rawInput.script || rawInput;

    const projectId = rawInput.project_id || rawInput.projectId || script.project_id || script.projectId;
    if (!projectId) {
      throw new ScriptInputError('Missing required projectId in script input.');
    }

    const scriptId = rawInput.script_id || rawInput.scriptId || script.id || script.script_id || 'script-default';
    const scriptVersion = parseInt(rawInput.script_version || rawInput.scriptVersion || script.script_version || script.version || 1, 10);
    const topic = script.topic || rawInput.topic || 'Untitled Topic';
    const targetDurationSeconds = parseInt(script.target_duration_seconds || rawInput.target_duration_seconds || 600, 10);

    const chapters = Array.isArray(script.chapters) ? script.chapters : [];
    if (chapters.length === 0) {
      throw new ScriptInputError('Input script package contains no chapters to storyboard.');
    }

    const fullNarration = script.full_narration || chapters.map((c) => c.narration).join('\n\n');
    const humorAnnotations = Array.isArray(script.humor_annotations) ? script.humor_annotations : [];
    const memeSuggestions = Array.isArray(script.meme_suggestions) ? script.meme_suggestions : [];
    const visualSuggestions = Array.isArray(script.visual_suggestions) ? script.visual_suggestions : [];
    const factualClaimReferences = Array.isArray(script.factual_claim_references) ? script.factual_claim_references : [];

    return {
      projectId,
      project_id: projectId,
      scriptId,
      script_id: scriptId,
      scriptVersion,
      script_version: scriptVersion,
      topic,
      targetDurationSeconds,
      target_duration_seconds: targetDurationSeconds,
      chapters: chapters.map((ch, idx) => ({
        chapterId: ch.chapter_id || `ch-${String(idx + 1).padStart(2, '0')}`,
        index: ch.index || idx + 1,
        heading: ch.heading || `Chapter ${idx + 1}`,
        purpose: ch.purpose || '',
        narration: ch.narration || '',
        spokenWordCount: ch.spoken_word_count || (ch.narration ? ch.narration.split(/\s+/).length : 0),
        estimatedDurationSeconds: ch.estimated_duration_seconds || 60,
        referencedClaimIds: ch.referenced_claim_ids || []
      })),
      entities: {
        characters: ['Explosion Host', 'Lead Investigator'],
        locations: ['Command Studio', 'Deep Space Void'],
        props: ['Glass Tablet', 'Microchip']
      },
      fullNarration,
      humorAnnotations,
      memeSuggestions,
      visualSuggestions,
      factualClaimReferences
    };
  }

  adaptScript(rawInput) {
    return this.adapt(rawInput);
  }
}

export const scriptInputAdapter = new ScriptInputAdapter();
