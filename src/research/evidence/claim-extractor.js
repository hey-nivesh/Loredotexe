/**
 * Claim Extractor: Extracts structured factual assertions, statistics, and statements from text.
 */

import { createHash } from 'node:crypto';

/**
 * Classifies the type of factual claim based on linguistic patterns.
 * @param {string} sentence
 * @returns {'statistic'|'quote'|'allegation'|'speculation'|'fact'}
 */
export function classifyClaimType(sentence) {
  const lower = sentence.toLowerCase();

  // Statistic detection (numbers with %, $, million, billion, kg, etc.)
  if (/\b\d+(?:\.\d+)?(?:\s*%|\s*percent|\s*million|\s*billion|\s*thousand|\s*dollars|\s*usd|\$)\b/i.test(sentence)) {
    return 'statistic';
  }

  // Direct quote
  if (/["'“”].{5,}["'“”]/.test(sentence) || /\b(?:stated|said|announced|quoted|tweeted)\b/i.test(sentence)) {
    return 'quote';
  }

  // Allegation / unconfirmed report
  if (/\b(?:alleged|reportedly|claims|claimed|rumored|suspected|sources say)\b/i.test(lower)) {
    return 'allegation';
  }

  // Speculation / prediction
  if (/\b(?:might|could|expected to|predicted|future|may|possibly|speculated)\b/i.test(lower)) {
    return 'speculation';
  }

  return 'fact';
}

/**
 * Determines claim importance for the video topic.
 * @param {string} sentence
 * @param {string} topic
 * @returns {'high'|'medium'|'low'}
 */
export function assessClaimImportance(sentence, topic) {
  const topicWords = topic.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const sentenceLower = sentence.toLowerCase();

  let matches = 0;
  for (const w of topicWords) {
    if (sentenceLower.includes(w)) matches++;
  }

  if (matches >= 2 || /\b(?:first time|broke record|discovered|launch|cause|death|founded|banned|created)\b/i.test(sentenceLower)) {
    return 'high';
  }

  if (matches === 1 || sentence.length > 80) {
    return 'medium';
  }

  return 'low';
}

/**
 * Extracts candidate claims deterministically from article paragraphs.
 * @param {Array<{ sourceId: string, paragraphs: string[], sourceUrl: string, publisher: string }>} sourceDocuments
 * @param {string} topic
 * @param {number} [maxClaims=15]
 * @returns {Array<object>}
 */
export function extractClaims(sourceDocuments, topic, maxClaims = 15) {
  if (!Array.isArray(sourceDocuments)) return [];

  const rawClaims = [];
  const seenTexts = new Set();

  for (const doc of sourceDocuments) {
    const paragraphs = doc.paragraphs || [];
    for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
      const paragraph = paragraphs[pIdx];

      // Split paragraph into candidate sentences
      const sentences = paragraph
        .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 15 && s.length <= 500);

      for (const sentence of sentences) {
        const normalized = sentence.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (seenTexts.has(normalized)) continue;
        seenTexts.add(normalized);

        const claimType = classifyClaimType(sentence);
        const importance = assessClaimImportance(sentence, topic);

        const hash = createHash('sha256').update(sentence).digest('hex').slice(0, 12);
        const claimId = `claim-${hash}`;

        rawClaims.push({
          claim_id: claimId,
          claim_text: sentence,
          claim_type: claimType,
          importance,
          extracted_from: {
            source_id: doc.sourceId,
            source_url: doc.sourceUrl,
            publisher: doc.publisher,
            paragraph_index: pIdx + 1
          }
        });

        if (rawClaims.length >= maxClaims * 2) break;
      }
    }
  }

  // Prioritize high importance and distinct claim types
  const sorted = rawClaims.sort((a, b) => {
    const weight = { high: 3, medium: 2, low: 1 };
    return weight[b.importance] - weight[a.importance];
  });

  return sorted.slice(0, maxClaims);
}
