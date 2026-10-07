/**
 * Agent A: Story Architect
 * Analyzes research dossiers, defines narrative promise, and constructs chapter outlines with word budgets.
 */

import { DossierIneligibleError } from '../errors/script-errors.js';
import { DEFAULT_SCRIPT_CONFIG, estimateDurationSeconds } from '../config/tone-config.js';

export class StoryArchitect {
  /**
   * @param {object} [config={}]
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_SCRIPT_CONFIG, ...config };
  }

  /**
   * Validates dossier eligibility and creates a narrative story architecture.
   * @param {object} dossier Validated Phase 2 Research Dossier
   * @returns {object} Outline and architectural plan
   */
  createStoryArchitecture(dossier) {
    if (!dossier || typeof dossier !== 'object') {
      throw new DossierIneligibleError('Research dossier must be provided to Story Architect.');
    }

    if (dossier.eligibility_status !== 'READY_FOR_REVIEW') {
      throw new DossierIneligibleError(
        `Dossier is not eligible for scriptwriting. Current eligibility_status: '${dossier.eligibility_status}'. Topic must be READY_FOR_REVIEW.`,
        { eligibility_status: dossier.eligibility_status, rejection_reasons: dossier.rejection_reasons || [] }
      );
    }

    const claims = Array.isArray(dossier.factual_claims) ? dossier.factual_claims : [];
    const supportedClaims = claims.filter((c) => c.verification_status === 'SUPPORTED');
    if (supportedClaims.length === 0) {
      throw new DossierIneligibleError('Dossier contains no verified supported facts. Cannot construct grounded script.', {
        topic: dossier.topic
      });
    }

    const topic = dossier.topic || 'Unknown Topic';
    const category = dossier.category || 'general';
    const entities = Array.isArray(dossier.important_entities) ? dossier.important_entities : [];
    const entityName = entities[0] || topic;

    const centralQuestion = `What really happened with ${topic}, and why is the internet getting the whole story wrong?`;
    const targetWords = Math.round((this.config.targetDurationSeconds / 60) * this.config.narrationWordsPerMinute);

    // Title options
    const titleOptions = [
      `The Insane Truth Behind ${topic} (Explained)`,
      `Why Everyone Is Wrong About ${topic}`,
      `How ${entityName} Broke Reality: The Complete Story`,
      `${topic}: What They Didn't Tell You`,
      `The 10-Minute Breakdown of ${topic}`
    ];

    // Partition claims across chapters
    const claimIds = supportedClaims.map((c) => c.claim_id);
    const disputedIds = (dossier.disputed_claims || []).map((c) => c.claim_id);

    // Dynamic 7-Chapter Narrative Structure
    const chapterBlueprints = [
      {
        id: 'ch-01-hook',
        heading: 'The Glitch in the Matrix',
        purpose: 'Hook the audience with the central anomaly, establish stakes, and present the core question.',
        budgetRatio: 0.10,
        claims: claimIds.slice(0, 1),
        openingTransition: 'Picture this: ',
        closingTransition: 'To understand how we got here, we have to rewind.'
      },
      {
        id: 'ch-02-background',
        heading: 'Before the Chaos Began',
        purpose: 'Establish critical lore and historical context before diving into complex mechanics.',
        budgetRatio: 0.15,
        claims: claimIds.slice(1, 2),
        openingTransition: 'Before everything went completely off the rails, ',
        closingTransition: 'And that is when the warning sirens started going off.'
      },
      {
        id: 'ch-03-catalyst',
        heading: 'The Incident That Changed Everything',
        purpose: 'Break down the main triggering event with verified chronological evidence.',
        budgetRatio: 0.20,
        claims: claimIds.slice(2, 4).length ? claimIds.slice(2, 4) : claimIds.slice(0, 1),
        openingTransition: 'Here is where things get genuinely wild: ',
        closingTransition: 'Naturally, everyone tried to figure out what was actually happening.'
      },
      {
        id: 'ch-04-mechanism',
        heading: 'How It Actually Works (Without the Boring Stuff)',
        purpose: 'Demystify technical mechanics and core systems using intuitive real-world analogies.',
        budgetRatio: 0.20,
        claims: claimIds.slice(1, 3),
        openingTransition: 'Let us break down the actual mechanics without sounding like a boring textbook.',
        closingTransition: 'Which brings us to the elephant in the room.'
      },
      {
        id: 'ch-05-controversy',
        heading: 'The Great Debate & Wild Theories',
        purpose: 'Explore competing interpretations and disputed claims while firmly maintaining uncertainty.',
        budgetRatio: 0.15,
        claims: disputedIds.length > 0 ? disputedIds : claimIds.slice(0, 2),
        openingTransition: 'Now, the internet immediately did what the internet does best: theorize.',
        closingTransition: 'So what is actual verified reality, and what is total fiction?'
      },
      {
        id: 'ch-06-reality-check',
        heading: 'Fact vs Fiction: The Hard Evidence',
        purpose: 'Separate confirmed facts from internet myths, addressing unknowns and limitations directly.',
        budgetRatio: 0.10,
        claims: claimIds.slice(0, Math.min(3, claimIds.length)),
        openingTransition: 'Time for a reality check.',
        closingTransition: 'Which leaves us with one final, undeniable conclusion.'
      },
      {
        id: 'ch-07-takeaway',
        heading: 'The Final Verdict',
        purpose: 'Deliver the ultimate resolution, answer the central question, and leave the viewer satisfied.',
        budgetRatio: 0.10,
        claims: claimIds.slice(0, 1),
        openingTransition: 'At the end of the day, here is the real takeaway: ',
        closingTransition: 'That is the complete 10-minute explosion. See you in the next one.'
      }
    ];

    const chapters = chapterBlueprints.map((ch, idx) => {
      const budgetWords = Math.round(targetWords * ch.budgetRatio);
      return {
        chapter_id: ch.id,
        index: idx + 1,
        heading: ch.heading,
        purpose: ch.purpose,
        target_words: budgetWords,
        target_duration_seconds: estimateDurationSeconds(budgetWords, this.config.narrationWordsPerMinute),
        assigned_claim_ids: ch.claims.length > 0 ? ch.claims : claimIds.slice(0, 1),
        opening_transition: ch.openingTransition,
        closing_transition: ch.closingTransition
      };
    });

    return {
      topic,
      category,
      central_question: centralQuestion,
      target_words: targetWords,
      target_duration_seconds: this.config.targetDurationSeconds,
      title_options: titleOptions,
      chapters,
      supported_claims_count: supportedClaims.length,
      disputed_claims_count: disputedIds.length
    };
  }
}
