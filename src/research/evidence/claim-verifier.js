/**
 * Conservative Claim Verification Engine with Provenance and Multi-Source Corroboration.
 */

import { assessSourceQuality } from './source-quality.js';
import { classifySourceIndependence } from '../collection/deduplicator.js';
import { detectTextContradiction } from './contradiction-detector.js';

export const VERIFICATION_STATUS = Object.freeze({
  SUPPORTED: 'SUPPORTED',
  PARTIALLY_SUPPORTED: 'PARTIALLY_SUPPORTED',
  DISPUTED: 'DISPUTED',
  UNSUPPORTED: 'UNSUPPORTED',
  UNVERIFIABLE: 'UNVERIFIABLE'
});

/**
 * Matches a claim against available source document paragraphs and returns matching evidence items.
 * @param {object} claim
 * @param {Array<object>} sourceDocuments
 * @returns {Array<object>}
 */
export function findMatchingEvidence(claim, sourceDocuments) {
  if (!claim || !Array.isArray(sourceDocuments)) return [];

  const claimWords = claim.claim_text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3);

  const matchedItems = [];

  for (const doc of sourceDocuments) {
    if (!doc.paragraphs || doc.paragraphs.length === 0) continue;

    const independence = classifySourceIndependence(doc.plainText || '', doc.sourceUrl, doc.publisher);

    for (let pIdx = 0; pIdx < doc.paragraphs.length; pIdx++) {
      const paragraph = doc.paragraphs[pIdx];
      const pLower = paragraph.toLowerCase();

      // Count keyword overlap
      let matchCount = 0;
      for (const w of claimWords) {
        if (pLower.includes(w)) matchCount++;
      }

      const matchRatio = claimWords.length > 0 ? matchCount / claimWords.length : 0;

      // Meaningful match threshold (>= 40% overlap or >= 4 key terms)
      if (matchRatio >= 0.40 || matchCount >= 4) {
        const quality = assessSourceQuality({
          url: doc.sourceUrl,
          publisher: doc.publisher,
          publishedDate: doc.publishedAt,
          excerpt: paragraph
        });

        matchedItems.push({
          source_id: doc.sourceId,
          source_url: doc.sourceUrl,
          publisher: doc.publisher,
          publication_date: doc.publishedAt || null,
          retrieved_at: doc.retrievedAt || new Date().toISOString(),
          evidence_excerpt: paragraph.slice(0, 400).trim(),
          evidence_location: `Paragraph ${pIdx + 1}`,
          source_type: quality.sourceType,
          reliability_score: quality.reliabilityScore,
          independence_group: independence.independenceGroup
        });
        break; // One strong excerpt per document is sufficient
      }
    }
  }

  return matchedItems;
}

/**
 * Verifies a claim against gathered evidence.
 * @param {object} claim
 * @param {Array<object>} sourceDocuments
 * @param {Array<object>} [otherClaims=[]]
 * @returns {object} Verified claim object
 */
export function verifyClaim(claim, sourceDocuments, otherClaims = []) {
  const evidenceItems = findMatchingEvidence(claim, sourceDocuments);

  // Check for contradictions against other claims
  const contradictions = [];
  for (const other of otherClaims) {
    if (other.claim_id === claim.claim_id) continue;
    const check = detectTextContradiction(claim.claim_text, other.claim_text);
    if (check.isContradiction) {
      contradictions.push({
        conflicting_claim_id: other.claim_id,
        conflicting_text: other.claim_text,
        reason: check.reason
      });
    }
  }

  let status = VERIFICATION_STATUS.UNSUPPORTED;
  let confidence = 0.0;
  const notes = [];

  if (contradictions.length > 0) {
    status = VERIFICATION_STATUS.DISPUTED;
    confidence = 0.50;
    notes.push(`Disputed: Contradictory reporting detected (${contradictions[0].reason}).`);
  } else if (evidenceItems.length === 0) {
    status = VERIFICATION_STATUS.UNSUPPORTED;
    confidence = 0.0;
    notes.push('No direct evidence found in retrieved source documents.');
  } else {
    // Count distinct independent groups
    const uniqueGroups = new Set(evidenceItems.map((e) => e.independence_group));
    const maxReliability = Math.max(...evidenceItems.map((e) => e.reliability_score));
    const hasPrimary = evidenceItems.some((e) => e.source_type === 'primary');

    if (uniqueGroups.size >= 2 && maxReliability >= 0.80) {
      status = VERIFICATION_STATUS.SUPPORTED;
      confidence = Math.min(0.95, 0.75 + uniqueGroups.size * 0.10);
      notes.push(`Corroborated by ${uniqueGroups.size} independent source groups.`);
    } else if (hasPrimary || maxReliability >= 0.85) {
      status = VERIFICATION_STATUS.SUPPORTED;
      confidence = 0.80;
      notes.push('Supported by authoritative or primary source documentation.');
    } else if (maxReliability >= 0.60) {
      status = VERIFICATION_STATUS.PARTIALLY_SUPPORTED;
      confidence = 0.60;
      notes.push('Partially supported by single secondary source without independent corroboration.');
    } else {
      status = VERIFICATION_STATUS.UNSUPPORTED;
      confidence = 0.35;
      notes.push('Citations are from low-reliability or commentary sources only.');
    }
  }

  return {
    claim_id: claim.claim_id,
    claim_text: claim.claim_text,
    claim_type: claim.claim_type,
    importance: claim.importance,
    evidence_items: evidenceItems,
    verification_status: status,
    confidence,
    contradictions,
    reviewer_notes: notes.join(' ')
  };
}

/**
 * Verifies all claims extracted from a corpus of source documents.
 * @param {Array<object>} rawClaims
 * @param {Array<object>} sourceDocuments
 * @returns {Array<object>}
 */
export function verifyAllClaims(rawClaims, sourceDocuments) {
  if (!Array.isArray(rawClaims)) return [];
  return rawClaims.map((c) => verifyClaim(c, sourceDocuments, rawClaims));
}
