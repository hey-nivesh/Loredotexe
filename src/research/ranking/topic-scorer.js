/**
 * Topic Scoring, Suitability Evaluation, and Eligibility Gating.
 */

import { VERIFICATION_STATUS } from '../evidence/claim-verifier.js';

export const DEFAULT_WEIGHTS = Object.freeze({
  freshness: 0.25,
  evidenceQuality: 0.25,
  audienceInterest: 0.20,
  explainerPotential: 0.15,
  channelRelevance: 0.10,
  productionFeasibility: 0.05
});

/**
 * Calculates freshness score (0–100) based on publication age.
 * @param {string|null} publishedAt
 * @returns {{ score: number, daysOld: number|null, explanation: string }}
 */
export function scoreFreshness(publishedAt) {
  if (!publishedAt) {
    return { score: 50, daysOld: null, explanation: 'Missing publication date defaults to baseline freshness (50).' };
  }

  const pubTime = new Date(publishedAt).getTime();
  const now = Date.now();
  const diffHours = Math.max(0, (now - pubTime) / (1000 * 60 * 60));
  const daysOld = Math.round((diffHours / 24) * 10) / 10;

  if (diffHours <= 24) {
    return { score: 100, daysOld, explanation: 'Breaking / published within last 24 hours (100).' };
  }
  if (diffHours <= 72) {
    return { score: 90, daysOld, explanation: 'Very fresh / published within last 3 days (90).' };
  }
  if (diffHours <= 168) {
    return { score: 75, daysOld, explanation: 'Published within past week (75).' };
  }
  if (diffHours <= 720) {
    return { score: 55, daysOld, explanation: 'Published within past month (55).' };
  }

  return { score: 30, daysOld, explanation: `Evergreen / older topic (${daysOld} days old) (30).` };
}

/**
 * Calculates evidence quality score (0–100) based on verified claims and corroboration.
 * @param {Array<object>} verifiedClaims
 * @returns {{ score: number, supportedCount: number, disputedCount: number, completenessRatio: number, explanation: string }}
 */
export function scoreEvidenceQuality(verifiedClaims = []) {
  if (!verifiedClaims || verifiedClaims.length === 0) {
    return {
      score: 0,
      supportedCount: 0,
      disputedCount: 0,
      completenessRatio: 0,
      explanation: 'No factual claims were extracted from source documents (0).'
    };
  }

  const supported = verifiedClaims.filter((c) => c.verification_status === VERIFICATION_STATUS.SUPPORTED);
  const partiallySupported = verifiedClaims.filter((c) => c.verification_status === VERIFICATION_STATUS.PARTIALLY_SUPPORTED);
  const disputed = verifiedClaims.filter((c) => c.verification_status === VERIFICATION_STATUS.DISPUTED);

  const total = verifiedClaims.length;
  const weightedSupported = supported.length * 1.0 + partiallySupported.length * 0.5;
  const completenessRatio = Math.round((weightedSupported / total) * 100) / 100;

  let score = completenessRatio * 85;

  // Bonus for multiple well-supported high importance claims
  const highImportanceSupported = supported.filter((c) => c.importance === 'high').length;
  score += Math.min(15, highImportanceSupported * 5);

  // Penalty for unresolved contradictions
  if (disputed.length > 0) {
    score -= disputed.length * 15;
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score: finalScore,
    supportedCount: supported.length,
    disputedCount: disputed.length,
    completenessRatio,
    explanation: `${supported.length}/${total} claims verified as SUPPORTED (${completenessRatio * 100}% completeness), ${disputed.length} disputed.`
  };
}

/**
 * Calculates audience interest score based on keywords and topic breadth.
 * @param {string} topic
 * @param {string[]} keywords
 * @returns {{ score: number, signalStrength: 'high'|'medium'|'low', explanation: string }}
 */
export function scoreAudienceInterest(topic, keywords = []) {
  const highInterestTerms = [
    'ai', 'model', 'breakthrough', 'secret', 'timeline', 'lore', 'war', 'fall', 'rise',
    'origin', 'explained', 'mystery', 'leak', 'disaster', 'scandal', 'banned', 'crisis'
  ];

  const lowerTopic = topic.toLowerCase();
  let matches = 0;
  for (const term of highInterestTerms) {
    if (lowerTopic.includes(term) || keywords.includes(term)) matches++;
  }

  let score = 50 + matches * 12;
  score = Math.min(100, Math.max(20, score));

  const signalStrength = score >= 75 ? 'high' : score >= 50 ? 'medium' : 'low';

  return {
    score,
    signalStrength,
    explanation: `Interest signal is ${signalStrength} based on keyword alignment (${matches} high-engagement triggers).`
  };
}

/**
 * Scores a candidate topic comprehensively across all dimensions.
 * @param {object} params
 * @param {string} params.topic
 * @param {string|null} [params.publishedAt]
 * @param {Array<object>} [params.verifiedClaims=[]]
 * @param {string[]} [params.keywords=[]]
 * @param {string} [params.category='general']
 * @param {object} [customWeights]
 * @returns {object}
 */
export function scoreTopic({
  topic,
  publishedAt = null,
  verifiedClaims = [],
  keywords = [],
  category = 'general',
  customWeights = DEFAULT_WEIGHTS
}) {
  const weights = { ...DEFAULT_WEIGHTS, ...customWeights };

  const freshness = scoreFreshness(publishedAt);
  const evidence = scoreEvidenceQuality(verifiedClaims);
  const interest = scoreAudienceInterest(topic, keywords);

  // Explainer potential: topics with rich narrative/lore or structured facts
  const explainerPotentialScore = verifiedClaims.length >= 4 ? 85 : verifiedClaims.length >= 2 ? 65 : 40;

  // Channel relevance ("The 10min Explosion" favors lore, tech breakthroughs, explainers)
  const channelCategories = ['technology', 'gaming', 'science', 'culture'];
  const channelRelevanceScore = channelCategories.includes(category.toLowerCase()) ? 90 : 60;

  // Production feasibility: text-rich topics are easy to script and render with FFmpeg
  const productionFeasibilityScore = 85;

  const componentScores = {
    freshness: freshness.score,
    evidenceQuality: evidence.score,
    audienceInterest: interest.score,
    explainerPotential: explainerPotentialScore,
    channelRelevance: channelRelevanceScore,
    productionFeasibility: productionFeasibilityScore
  };

  const weightedSum =
    componentScores.freshness * weights.freshness +
    componentScores.evidenceQuality * weights.evidenceQuality +
    componentScores.audienceInterest * weights.audienceInterest +
    componentScores.explainerPotential * weights.explainerPotential +
    componentScores.channelRelevance * weights.channelRelevance +
    componentScores.productionFeasibility * weights.productionFeasibility;

  const overallScore = Math.round(weightedSum * 10) / 10;

  // Hard eligibility gating
  const rejectionReasons = [];
  let eligibilityStatus = 'READY_FOR_REVIEW';

  if (evidence.supportedCount === 0) {
    eligibilityStatus = 'REJECTED';
    rejectionReasons.push('Critical Failure: Zero verified factual claims found in research sources.');
  } else if (evidence.disputedCount > 2) {
    eligibilityStatus = 'NEEDS_MORE_RESEARCH';
    rejectionReasons.push('Unresolved Contradictions: Multiple conflicting claims detected across sources.');
  } else if (overallScore < 50) {
    eligibilityStatus = 'NEEDS_MORE_RESEARCH';
    rejectionReasons.push(`Low Overall Suitability Score (${overallScore} / 100).`);
  }

  return {
    overall_score: overallScore,
    component_scores: componentScores,
    score_explanations: {
      freshness: freshness.explanation,
      evidenceQuality: evidence.explanation,
      audienceInterest: interest.explanation,
      explainerPotential: `Explainer depth evaluated based on ${verifiedClaims.length} extracted claims.`,
      channelRelevance: `Category '${category}' evaluated against channel programming baseline.`
    },
    evidence_completeness: evidence.completenessRatio,
    freshness_assessment: freshness.daysOld !== null ? `${freshness.daysOld} days old` : 'Unknown age',
    trend_signal_strength: interest.signalStrength,
    eligibility_status: eligibilityStatus,
    rejection_reasons: rejectionReasons
  };
}
