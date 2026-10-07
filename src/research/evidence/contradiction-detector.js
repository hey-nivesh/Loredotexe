/**
 * Contradiction Detector: Identifies conflicting dates, numbers, and opposing factual claims.
 */

const POLARITY_PAIRS = [
  ['success', 'failure'],
  ['succeeded', 'failed'],
  ['passed', 'failed'],
  ['working', 'broken'],
  ['approved', 'rejected'],
  ['banned', 'allowed'],
  ['confirmed', 'denied'],
  ['alive', 'dead'],
  ['released', 'cancelled'],
  ['true', 'false'],
  ['safe', 'dangerous'],
  ['lasted', 'died'],
  ['survived', 'died'],
  ['functional', 'corrupted']
];

/**
 * Extracts year numbers (e.g., 2021, 2024).
 * @param {string} text
 * @returns {number[]}
 */
function extractYears(text) {
  const matches = text.match(/\b(19\d\d|20\d\d)\b/g);
  return matches ? matches.map((y) => parseInt(y, 10)) : [];
}

/**
 * Extracts metric quantities (e.g. "48 hours", "1000 users").
 * @param {string} text
 * @returns {Array<{ value: number, unit: string }>}
 */
function extractMetrics(text) {
  const regex = /\b(\d+(?:\.\d+)?)\s*(hours?|days?|years?|miles?|percent|%|users?|dollars?)\b/gi;
  const list = [];
  let m;
  while ((m = regex.exec(text)) !== null) {
    list.push({ value: parseFloat(m[1]), unit: m[2].toLowerCase() });
  }
  return list;
}

/**
 * Checks if two text passages present conflicting factual claims.
 * @param {string} textA
 * @param {string} textB
 * @returns {{ isContradiction: boolean, reason: string|null, type: string|null }}
 */
export function detectTextContradiction(textA, textB) {
  if (!textA || !textB) return { isContradiction: false, reason: null, type: null };

  const aLower = textA.toLowerCase();
  const bLower = textB.toLowerCase();

  // 1. Polarity contradiction check
  for (const [pos, neg] of POLARITY_PAIRS) {
    const aHasPos = new RegExp(`\\b${pos}\\b`, 'i').test(aLower);
    const aHasNeg = new RegExp(`\\b${neg}\\b`, 'i').test(aLower);
    const bHasPos = new RegExp(`\\b${pos}\\b`, 'i').test(bLower);
    const bHasNeg = new RegExp(`\\b${neg}\\b`, 'i').test(bLower);

    if ((aHasPos && bHasNeg) || (aHasNeg && bHasPos)) {
      return {
        isContradiction: true,
        type: 'polarity_conflict',
        reason: `Opposing factual polarity detected ('${pos}' vs '${neg}').`
      };
    }
  }

  // 2. Direct timeline / year contradiction for same event keywords
  const yearsA = extractYears(textA);
  const yearsB = extractYears(textB);
  if (yearsA.length === 1 && yearsB.length === 1 && yearsA[0] !== yearsB[0]) {
    if (/\b(?:released|founded|occurred|launched|happened|discovered)\b/i.test(aLower) && /\b(?:released|founded|occurred|launched|happened|discovered)\b/i.test(bLower)) {
      return {
        isContradiction: true,
        type: 'timeline_conflict',
        reason: `Conflicting timeline dates cited (${yearsA[0]} vs ${yearsB[0]}).`
      };
    }
  }

  // 3. Quantitative metric contradiction
  const metricsA = extractMetrics(textA);
  const metricsB = extractMetrics(textB);
  for (const mA of metricsA) {
    for (const mB of metricsB) {
      if (mA.unit === mB.unit && mA.value !== mB.value) {
        return {
          isContradiction: true,
          type: 'metric_conflict',
          reason: `Conflicting quantitative metrics cited (${mA.value} ${mA.unit} vs ${mB.value} ${mB.unit}).`
        };
      }
    }
  }

  return { isContradiction: false, reason: null, type: null };
}

/**
 * Scans a list of claims and their evidence for contradictions.
 * @param {Array<object>} claimsWithEvidence
 * @returns {Array<object>} Detected contradictions
 */
export function findContradictions(claimsWithEvidence) {
  if (!Array.isArray(claimsWithEvidence)) return [];

  const contradictions = [];

  for (let i = 0; i < claimsWithEvidence.length; i++) {
    const claimA = claimsWithEvidence[i];
    for (let j = i + 1; j < claimsWithEvidence.length; j++) {
      const claimB = claimsWithEvidence[j];

      const check = detectTextContradiction(claimA.claim_text, claimB.claim_text);
      if (check.isContradiction) {
        contradictions.push({
          claim_id_a: claimA.claim_id,
          claim_id_b: claimB.claim_id,
          contradiction_type: check.type,
          statement_a: claimA.claim_text,
          statement_b: claimB.claim_text,
          reason: check.reason
        });
      }
    }
  }

  return contradictions;
}
