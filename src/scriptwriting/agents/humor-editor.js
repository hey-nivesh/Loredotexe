/**
 * Agent C: Humor and Meme Editor
 * Infuses Gen-Z internet culture voice, contextual punchlines, sarcasm, and descriptive meme suggestions.
 */

import { randomUUID } from 'node:crypto';
import { HUMOR_TYPES, DEFAULT_SCRIPT_CONFIG, countSpokenWords, estimateDurationSeconds } from '../config/tone-config.js';

export class HumorEditor {
  /**
   * @param {object} [config={}]
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_SCRIPT_CONFIG, ...config };
  }

  /**
   * Applies the Gen-Z humor and meme pass to the drafted script.
   * @param {object} draftedScript Output from Scriptwriter
   * @param {object} dossier Validated Phase 2 Research Dossier
   * @returns {object} Humor-enhanced chapters, annotations, and meme suggestions
   */
  applyHumorAndMemes(draftedScript, dossier) {
    const humorAnnotations = [];
    const memeSuggestions = [];
    const visualSuggestions = [];
    const updatedChapters = [];

    const allowProfanity = this.config.profanityLevel === 'contextual' || this.config.profanityLevel === 'uncensored';

    for (const chapter of draftedScript.chapters) {
      let narration = chapter.narration;
      const chapterId = chapter.chapter_id;

      // Injects voice flavor and annotations based on chapter context
      switch (chapterId) {
        case 'ch-01-hook': {
          const punchline = allowProfanity
            ? 'Honestly, if you told me this was straight out of a sci-fi thriller, I would have bet money on it.'
            : 'Honestly, if you told me this was straight out of a movie script, I would have 100% believed you.';
          
          narration = narration.replace(
            'If that sounds completely wild, that is because it is.',
            `If that sounds completely wild, that is because it is. ${punchline}`
          );

          const hId = `humor-${randomUUID().slice(0, 8)}`;
          humorAnnotations.push({
            annotation_id: hId,
            chapter_id: chapterId,
            location_hint: 'Hook ending punchline',
            joke_text: punchline,
            humor_type: HUMOR_TYPES.SARCASM,
            related_claim_ids: chapter.referenced_claim_ids,
            optional_visual_punchline: 'Dramatic zoom-in with record scratch sound effect.',
            editorial_notes: 'Keeps the opening energetic without obscuring the underlying fact.'
          });

          memeSuggestions.push({
            meme_id: `meme-${randomUUID().slice(0, 8)}`,
            chapter_id: chapterId,
            trigger_context: 'When introducing the unexpected anomaly',
            intended_joke: 'Audience disbelief at the absurdity of the situation',
            suggested_format_or_reaction: 'Classic "Confused Nick Young / Question Marks" reaction overlay',
            approximate_duration_seconds: 2,
            asset_rights_note: 'Use royalty-free original motion graphic reaction recreation.'
          });
          break;
        }

        case 'ch-03-catalyst': {
          const hId = `humor-${randomUUID().slice(0, 8)}`;
          humorAnnotations.push({
            annotation_id: hId,
            chapter_id: chapterId,
            location_hint: 'Mid-catalyst reaction',
            joke_text: 'Basically the entire engineering department having a collective panic attack.',
            humor_type: HUMOR_TYPES.EXAGGERATION,
            related_claim_ids: chapter.referenced_claim_ids,
            optional_visual_punchline: 'Rapid-fire split screen of cartoon alarm lights flashing.',
            editorial_notes: 'Hyperbolic framing of the crisis response; material claims preserved.'
          });

          memeSuggestions.push({
            meme_id: `meme-${randomUUID().slice(0, 8)}`,
            chapter_id: chapterId,
            trigger_context: 'When the critical milestone happens',
            intended_joke: 'Everything is fine / This is fine burning room meme',
            suggested_format_or_reaction: 'Animated stylized reproduction of the "This is fine" dog with coffee',
            approximate_duration_seconds: 3,
            asset_rights_note: 'Original vector art reproduction.'
          });
          break;
        }

        case 'ch-04-mechanism': {
          const analogyJoke = 'Think of it like trying to debug your Wi-Fi router from 15 billion miles away using a toaster.';
          narration = narration.replace(
            'When you strip away the dense jargon, the principle is actually straightforward.',
            `When you strip away the dense jargon, the principle is actually straightforward. ${analogyJoke}`
          );

          const hId = `humor-${randomUUID().slice(0, 8)}`;
          humorAnnotations.push({
            annotation_id: hId,
            chapter_id: chapterId,
            location_hint: 'Technical breakdown analogy',
            joke_text: analogyJoke,
            humor_type: HUMOR_TYPES.ANALOGY,
            related_claim_ids: chapter.referenced_claim_ids,
            optional_visual_punchline: 'Illustration of a router floating in deep space with 0 bars.',
            editorial_notes: 'Simplifies distance and latency concept using relatable tech analogy.'
          });
          break;
        }

        case 'ch-05-controversy': {
          memeSuggestions.push({
            meme_id: `meme-${randomUUID().slice(0, 8)}`,
            chapter_id: chapterId,
            trigger_context: 'Debunking wild social media conspiracy theories',
            intended_joke: 'Pepe Silvia conspiracy board connecting red strings to nowhere',
            suggested_format_or_reaction: 'Motion graphics corkboard with chaotic animated red strings',
            approximate_duration_seconds: 2.5,
            asset_rights_note: 'Custom stylized procedural graphic.'
          });
          break;
        }

        case 'ch-07-takeaway': {
          const closingJoke = 'Moral of the story: always double-check the receipts before believing Twitter headlines.';
          narration = narration.replace(
            'That is the complete 10-minute explosion.',
            `${closingJoke} That is the complete 10-minute explosion.`
          );
          break;
        }
      }

      // Add visual scene cues
      visualSuggestions.push({
        visual_id: `vis-${randomUUID().slice(0, 8)}`,
        chapter_id: chapterId,
        description: `Cinematic 3D title card and animated key takeaway for: ${chapter.heading}`,
        cue_type: 'lower_third_and_b_roll',
        duration_seconds: Math.min(5, chapter.estimated_duration_seconds)
      });

      const updatedWords = countSpokenWords(narration);
      const updatedDuration = estimateDurationSeconds(updatedWords, this.config.narrationWordsPerMinute);

      updatedChapters.push({
        ...chapter,
        narration,
        spoken_word_count: updatedWords,
        estimated_duration_seconds: updatedDuration
      });
    }

    const fullNarration = updatedChapters.map((c) => `## ${c.heading}\n\n${c.narration}`).join('\n\n');
    const totalWords = updatedChapters.reduce((acc, c) => acc + c.spoken_word_count, 0);
    const totalDuration = estimateDurationSeconds(totalWords, this.config.narrationWordsPerMinute);

    return {
      chapters: updatedChapters,
      full_narration: fullNarration,
      spoken_word_count: totalWords,
      estimated_duration_seconds: totalDuration,
      humor_annotations: humorAnnotations,
      meme_suggestions: memeSuggestions,
      visual_suggestions: visualSuggestions,
      factual_claim_references: draftedScript.factual_claim_references
    };
  }
}
