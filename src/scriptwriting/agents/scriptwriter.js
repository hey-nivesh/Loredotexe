/**
 * Agent B: Scriptwriter
 * Turns architectural outlines and verified dossier claims into natural, grounded spoken YouTube narration.
 */

import { countSpokenWords, estimateDurationSeconds, DEFAULT_SCRIPT_CONFIG } from '../config/tone-config.js';

export class Scriptwriter {
  /**
   * @param {object} [config={}]
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_SCRIPT_CONFIG, ...config };
  }

  /**
   * Drafts narration for all chapters based on story outline and dossier facts.
   * @param {object} outline Created by StoryArchitect
   * @param {object} dossier Validated Phase 2 Research Dossier
   * @returns {object} Drafted chapters and citation mapping
   */
  draftScript(outline, dossier) {
    const claimsMap = new Map();
    for (const c of (dossier.factual_claims || [])) {
      claimsMap.set(c.claim_id, c);
    }

    const disputedMap = new Map();
    for (const d of (dossier.disputed_claims || [])) {
      disputedMap.set(d.claim_id, d);
    }

    const draftedChapters = [];
    const factualClaimReferences = [];
    const topic = dossier.topic || outline.topic;
    const category = dossier.category || outline.category;
    const backgroundContext = dossier.background_context || `The unfolding investigation into ${topic}.`;

    for (const chapterPlan of outline.chapters) {
      const assignedClaims = chapterPlan.assigned_claim_ids.map((id) => claimsMap.get(id) || disputedMap.get(id)).filter(Boolean);
      
      const narrationParagraphs = [];
      const chapterClaimRefs = [];

      // 1. Opening transition
      narrationParagraphs.push(chapterPlan.opening_transition);

      // 2. Draft content depending on chapter purpose
      switch (chapterPlan.chapter_id) {
        case 'ch-01-hook': {
          const leadClaim = assignedClaims[0] || { claim_text: `${topic} triggered widespread investigation.` };
          narrationParagraphs.push(
            `You are looking at one of the most fascinating events in ${category}. The moment ${topic.toLowerCase()} happened, it sent shockwaves everywhere. Specifically: ${leadClaim.claim_text} If that sounds completely wild, that is because it is.`
          );
          if (leadClaim.claim_id) {
            chapterClaimRefs.push(leadClaim.claim_id);
            factualClaimReferences.push({
              chapter_id: chapterPlan.chapter_id,
              claim_id: leadClaim.claim_id,
              statement: leadClaim.claim_text
            });
          }
          break;
        }

        case 'ch-02-background': {
          narrationParagraphs.push(
            `${backgroundContext} To put this into perspective, think of this like setting up the dominoes before the first one gets tapped. Everything seemed normal until key baseline metrics began shifting.`
          );
          if (assignedClaims.length > 0) {
            const claim = assignedClaims[0];
            narrationParagraphs.push(
              `As documented in verified reports: ${claim.claim_text} This established the exact conditions that made what followed so surprising.`
            );
            if (claim.claim_id) {
              chapterClaimRefs.push(claim.claim_id);
              factualClaimReferences.push({
                chapter_id: chapterPlan.chapter_id,
                claim_id: claim.claim_id,
                statement: claim.claim_text
              });
            }
          }
          break;
        }

        case 'ch-03-catalyst': {
          for (const claim of assignedClaims) {
            narrationParagraphs.push(
              `The definitive milestone occurred when records verified: ${claim.claim_text} This was not just a minor blip on the radar—it fundamentally shifted how experts and observers evaluated the entire situation.`
            );
            if (claim.claim_id) {
              chapterClaimRefs.push(claim.claim_id);
              factualClaimReferences.push({
                chapter_id: chapterPlan.chapter_id,
                claim_id: claim.claim_id,
                statement: claim.claim_text
              });
            }
          }
          if (assignedClaims.length === 0) {
            narrationParagraphs.push(`The core event unfolded rapidly across documented timelines.`);
          }
          break;
        }

        case 'ch-04-mechanism': {
          narrationParagraphs.push(
            `Think of how a car engine sputters when a single spark plug misfires. In the case of ${topic}, the underlying mechanism behaved in a remarkably similar way.`
          );
          for (const claim of assignedClaims) {
            narrationParagraphs.push(
              `Here is the verified technical reality: ${claim.claim_text} When you strip away the dense jargon, the principle is actually straightforward.`
            );
            if (claim.claim_id) {
              chapterClaimRefs.push(claim.claim_id);
              factualClaimReferences.push({
                chapter_id: chapterPlan.chapter_id,
                claim_id: claim.claim_id,
                statement: claim.claim_text
              });
            }
          }
          break;
        }

        case 'ch-05-controversy': {
          if (dossier.disputed_claims && dossier.disputed_claims.length > 0) {
            for (const disp of dossier.disputed_claims) {
              narrationParagraphs.push(
                `One major area of dispute revolves around this claim: "${disp.statement}". While some sources reported this initially, credible evidence shows conflicting data. We have to be very clear here: this detail remains disputed and unverified.`
              );
              chapterClaimRefs.push(disp.claim_id);
              factualClaimReferences.push({
                chapter_id: chapterPlan.chapter_id,
                claim_id: disp.claim_id,
                statement: disp.statement,
                is_disputed: true
              });
            }
          } else {
            narrationParagraphs.push(
              `While speculation ran rampant on social feeds, the data indicates that early over-exaggerated claims quickly fell apart under rigorous verification.`
            );
          }
          break;
        }

        case 'ch-06-reality-check': {
          narrationParagraphs.push(
            `Let us cut through the noise. Here is what we know for absolute certain versus what is pure speculation.`
          );
          for (const claim of assignedClaims) {
            narrationParagraphs.push(
              `Fact check: ${claim.claim_text} That is verified on record.`
            );
            if (claim.claim_id && !chapterClaimRefs.includes(claim.claim_id)) {
              chapterClaimRefs.push(claim.claim_id);
              factualClaimReferences.push({
                chapter_id: chapterPlan.chapter_id,
                claim_id: claim.claim_id,
                statement: claim.claim_text
              });
            }
          }
          if (dossier.unknowns && dossier.unknowns.length > 0) {
            const unk = dossier.unknowns[0];
            narrationParagraphs.push(
              `On the flip side, here is what remains unknown: ${unk.unverified_assertion}. Anyone telling you that is settled is guessing.`
            );
          }
          break;
        }

        case 'ch-07-takeaway': {
          const mainClaim = assignedClaims[0] || { claim_text: `${topic} remains a landmark case study.` };
          narrationParagraphs.push(
            `When you look at the whole picture—from the initial shock to the confirmed facts—${topic} proves why evidence always beats hype. To recap: ${mainClaim.claim_text}`
          );
          if (mainClaim.claim_id && !chapterClaimRefs.includes(mainClaim.claim_id)) {
            chapterClaimRefs.push(mainClaim.claim_id);
            factualClaimReferences.push({
              chapter_id: chapterPlan.chapter_id,
              claim_id: mainClaim.claim_id,
              statement: mainClaim.claim_text
            });
          }
          break;
        }

        default:
          narrationParagraphs.push(`Continuing the breakdown of ${topic}.`);
      }

      // 3. Closing transition
      narrationParagraphs.push(chapterPlan.closing_transition);

      const combinedNarration = narrationParagraphs.join(' ');
      const spokenWordCount = countSpokenWords(combinedNarration);
      const estimatedDuration = estimateDurationSeconds(spokenWordCount, this.config.narrationWordsPerMinute);

      draftedChapters.push({
        chapter_id: chapterPlan.chapter_id,
        index: chapterPlan.index,
        heading: chapterPlan.heading,
        purpose: chapterPlan.purpose,
        narration: combinedNarration,
        spoken_word_count: spokenWordCount,
        estimated_duration_seconds: estimatedDuration,
        referenced_claim_ids: [...new Set(chapterClaimRefs)],
        opening_transition: chapterPlan.opening_transition,
        closing_transition: chapterPlan.closing_transition
      });
    }

    const fullNarration = draftedChapters.map((c) => `## ${c.heading}\n\n${c.narration}`).join('\n\n');
    const totalWords = draftedChapters.reduce((acc, c) => acc + c.spoken_word_count, 0);
    const totalDuration = estimateDurationSeconds(totalWords, this.config.narrationWordsPerMinute);

    return {
      chapters: draftedChapters,
      full_narration: fullNarration,
      spoken_word_count: totalWords,
      estimated_duration_seconds: totalDuration,
      factual_claim_references: factualClaimReferences
    };
  }
}
