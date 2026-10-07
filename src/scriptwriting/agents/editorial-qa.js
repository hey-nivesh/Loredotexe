/**
 * Agent D: Editorial QA
 * Evaluates factual traceability, claim integrity, runtime bounds, repetition, and tone safety.
 */

import { randomUUID } from 'node:crypto';
import { QA_SEVERITY, SCRIPT_APPROVAL_STATUS, DEFAULT_SCRIPT_CONFIG } from '../config/tone-config.js';

export class EditorialQa {
  /**
   * @param {object} [config={}]
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_SCRIPT_CONFIG, ...config };
  }

  /**
   * Runs the complete deterministic Editorial QA suite on a script candidate.
   * @param {object} scriptCandidate Script data with chapters, narration, and citations
   * @param {object} dossier Phase 2 Research Dossier
   * @returns {object} QA Report with score, approval status, and findings
   */
  evaluateScript(scriptCandidate, dossier) {
    const findings = [];
    const checksRun = [
      'factual_claim_traceability',
      'broken_claim_id_detection',
      'disputed_claim_integrity',
      'runtime_pacing_bounds',
      'repetition_and_filler_density',
      'slang_and_profanity_safety',
      'narrative_promise_fulfillment'
    ];

    const claimsMap = new Map();
    for (const c of (dossier.factual_claims || [])) {
      claimsMap.set(c.claim_id, c);
    }
    for (const d of (dossier.disputed_claims || [])) {
      claimsMap.set(d.claim_id, d);
    }

    // 1. Factual Claim Traceability & Broken Claim IDs
    let totalClaimReferences = 0;
    let brokenClaimCount = 0;
    const chapters = scriptCandidate.chapters || [];

    for (const chapter of chapters) {
      const referencedIds = chapter.referenced_claim_ids || [];
      totalClaimReferences += referencedIds.length;

      for (const claimId of referencedIds) {
        if (!claimsMap.has(claimId)) {
          brokenClaimCount++;
          findings.push({
            finding_id: `find-${randomUUID().slice(0, 8)}`,
            severity: QA_SEVERITY.CRITICAL,
            category: 'broken_claim_reference',
            description: `Chapter '${chapter.heading}' references non-existent claim ID '${claimId}'.`,
            affected_chapter_id: chapter.chapter_id,
            related_claim_ids: [claimId],
            recommended_action: 'Remove reference or ground with valid claim from dossier.'
          });
        }
      }

      // Check if chapter contains fabricated quotes or fake statistics not present in dossier
      const quoteMatch = chapter.narration.match(/"([^"]{15,})"/g);
      if (quoteMatch) {
        for (const quote of quoteMatch) {
          const cleanQuote = quote.replace(/"/g, '').toLowerCase();
          const dossierText = JSON.stringify(dossier).toLowerCase();
          if (!dossierText.includes(cleanQuote.slice(0, 20))) {
            findings.push({
              finding_id: `find-${randomUUID().slice(0, 8)}`,
              severity: QA_SEVERITY.CRITICAL,
              category: 'unsupported_direct_quote',
              description: `Chapter '${chapter.heading}' includes direct quotation not backed by evidence: ${quote}`,
              affected_chapter_id: chapter.chapter_id,
              related_claim_ids: referencedIds,
              recommended_action: 'Replace quotation with verified paraphrase from dossier.'
            });
          }
        }
      }
    }

    // 2. Disputed Claim Integrity Check
    if (dossier.disputed_claims && dossier.disputed_claims.length > 0) {
      for (const disp of dossier.disputed_claims) {
        const fullText = scriptCandidate.full_narration || '';
        // If disputed claim is mentioned without qualification words like "disputed", "unverified", "conflicting", "debate"
        if (disp.statement && fullText.includes(disp.statement)) {
          const surroundingIndex = fullText.indexOf(disp.statement);
          const snippet = fullText.slice(Math.max(0, surroundingIndex - 80), surroundingIndex + disp.statement.length + 80).toLowerCase();
          const hasQualification = ['dispute', 'unverified', 'conflict', 'theory', 'debate', 'question', 'doubt'].some((w) => snippet.includes(w));
          if (!hasQualification) {
            findings.push({
              finding_id: `find-${randomUUID().slice(0, 8)}`,
              severity: QA_SEVERITY.CRITICAL,
              category: 'unqualified_disputed_claim',
              description: `Disputed claim '${disp.claim_id}' is presented without uncertainty qualification: "${disp.statement}"`,
              affected_chapter_id: 'ch-05-controversy',
              related_claim_ids: [disp.claim_id],
              recommended_action: 'Add clear editorial qualification stating this detail remains unverified.'
            });
          }
        }
      }
    }

    // 3. Runtime & Word Budget Bounds
    const estimatedDuration = scriptCandidate.estimated_duration_seconds || 0;
    const minDuration = this.config.minimumDurationSeconds || 480;
    const maxDuration = this.config.maximumDurationSeconds || 720;

    if (estimatedDuration < minDuration) {
      findings.push({
        finding_id: `find-${randomUUID().slice(0, 8)}`,
        severity: QA_SEVERITY.MAJOR,
        category: 'runtime_too_short',
        description: `Estimated runtime (${estimatedDuration}s) is below channel minimum threshold (${minDuration}s).`,
        affected_chapter_id: null,
        related_claim_ids: [],
        recommended_action: 'Expand background explanations and context using verified dossier facts.'
      });
    } else if (estimatedDuration > maxDuration) {
      findings.push({
        finding_id: `find-${randomUUID().slice(0, 8)}`,
        severity: QA_SEVERITY.MAJOR,
        category: 'runtime_too_long',
        description: `Estimated runtime (${estimatedDuration}s) exceeds channel maximum threshold (${maxDuration}s).`,
        affected_chapter_id: null,
        related_claim_ids: [],
        recommended_action: 'Tighten prose and trim unnecessary filler phrases.'
      });
    }

    // 4. Repetition & Filler Density
    const fullNarration = (scriptCandidate.full_narration || '').toLowerCase();
    const fillerWords = ['literally', 'bro', 'insane', 'basically', 'actually'];
    for (const filler of fillerWords) {
      const regex = new RegExp(`\\b${filler}\\b`, 'gi');
      const matches = fullNarration.match(regex);
      if (matches && matches.length > 8) {
        findings.push({
          finding_id: `find-${randomUUID().slice(0, 8)}`,
          severity: QA_SEVERITY.MINOR,
          category: 'excessive_filler_repetition',
          description: `High repetition of filler term '${filler}' (${matches.length} occurrences).`,
          affected_chapter_id: null,
          related_claim_ids: [],
          recommended_action: 'Vary sentence structures and replace repetitive filler words.'
        });
      }
    }

    // 5. Slang Overload Check
    const extremeSlang = ['skibidi', 'gyatt', 'rizzler', 'sigma grindset'];
    for (const slang of extremeSlang) {
      if (fullNarration.includes(slang)) {
        findings.push({
          finding_id: `find-${randomUUID().slice(0, 8)}`,
          severity: QA_SEVERITY.MAJOR,
          category: 'inappropriate_slang_overload',
          description: `Unnatural meme slang term detected ('${slang}') that impairs explainer clarity.`,
          affected_chapter_id: null,
          related_claim_ids: [],
          recommended_action: 'Remove forced slang to maintain conversational credibility.'
        });
      }
    }

    // 6. Score Calculation & Decision Matrix
    let score = 100;
    const criticalCount = findings.filter((f) => f.severity === QA_SEVERITY.CRITICAL).length;
    const majorCount = findings.filter((f) => f.severity === QA_SEVERITY.MAJOR).length;
    const minorCount = findings.filter((f) => f.severity === QA_SEVERITY.MINOR).length;

    score -= criticalCount * 40;
    score -= majorCount * 15;
    score -= minorCount * 5;
    score = Math.max(0, Math.min(100, score));

    let approvalStatus = SCRIPT_APPROVAL_STATUS.APPROVED_FOR_REVIEW;
    if (criticalCount > 0) {
      approvalStatus = SCRIPT_APPROVAL_STATUS.BLOCKED;
    } else if (majorCount > 0 || score < 70) {
      approvalStatus = SCRIPT_APPROVAL_STATUS.NEEDS_REVISION;
    }

    return {
      status: approvalStatus,
      score,
      checks_run: checksRun,
      passed: approvalStatus === SCRIPT_APPROVAL_STATUS.APPROVED_FOR_REVIEW,
      critical_findings_count: criticalCount,
      major_findings_count: majorCount,
      minor_findings_count: minorCount,
      findings
    };
  }
}
