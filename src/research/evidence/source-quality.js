/**
 * Explainable Source Quality Assessment and Provenance Scoring.
 */

const HIGH_RELIABILITY_DOMAINS = new Set([
  'bbc.com', 'bbc.co.uk', 'reuters.com', 'arstechnica.com', 'technologyreview.com',
  'nature.com', 'science.org', 'nasa.gov', 'phys.org', 'sciencedaily.com'
]);

const MEDIUM_RELIABILITY_DOMAINS = new Set([
  'ign.com', 'pcgamer.com', 'theverge.com', 'engadget.com', 'techcrunch.com',
  'wired.com', 'polygon.com', 'eurogamer.net', 'gamespot.com'
]);

/**
 * Assesses the quality and classification of an evidence source.
 * @param {object} params
 * @param {string} params.url
 * @param {string} params.publisher
 * @param {string} [params.publishedDate]
 * @param {string} [params.excerpt]
 * @param {boolean} [params.isPrimary=false]
 * @returns {{ sourceType: 'primary'|'secondary_reporting'|'commentary'|'weak', reliabilityScore: number, explanation: string, factors: object }}
 */
export function assessSourceQuality({ url, publisher, publishedDate, excerpt = '', isPrimary = false }) {
  let hostname = '';
  try {
    hostname = new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    hostname = (publisher || '').toLowerCase();
  }

  let sourceType = 'secondary_reporting';
  let baseScore = 0.70;
  const factors = {
    hasPublisher: Boolean(publisher && publisher !== 'Unknown Publisher'),
    hasDate: Boolean(publishedDate),
    excerptLength: excerpt.length,
    isHighTrustDomain: HIGH_RELIABILITY_DOMAINS.has(hostname),
    isMediumTrustDomain: MEDIUM_RELIABILITY_DOMAINS.has(hostname)
  };

  const explanations = [];

  if (isPrimary || /\b(?:press release|official announcement|whitepaper|peer-reviewed|court filing)\b/i.test(excerpt)) {
    sourceType = 'primary';
    baseScore = 0.95;
    explanations.push('Primary documentation or direct official statement.');
  } else if (factors.isHighTrustDomain) {
    sourceType = 'secondary_reporting';
    baseScore = 0.90;
    explanations.push(`Established high-reputation journalistic outlet (${hostname}).`);
  } else if (factors.isMediumTrustDomain) {
    sourceType = 'secondary_reporting';
    baseScore = 0.80;
    explanations.push(`Recognized industry publication (${hostname}).`);
  } else if (/\b(?:opinion|commentary|forum|reddit|tweet|post|blog)\b/i.test(url) || /\b(?:in my opinion|i believe|hot take)\b/i.test(excerpt)) {
    sourceType = 'commentary';
    baseScore = 0.50;
    explanations.push('Commentary or subjective opinion piece.');
  } else {
    sourceType = 'secondary_reporting';
    baseScore = 0.65;
    explanations.push('Standard web reporting.');
  }

  // Modifiers
  if (factors.hasDate) {
    baseScore += 0.05;
  } else {
    baseScore -= 0.10;
    explanations.push('Missing publication date penalizes reliability.');
  }

  if (excerpt.length < 40) {
    baseScore -= 0.15;
    explanations.push('Short or vague excerpt provides weak direct evidence.');
  }

  const finalScore = Math.max(0.1, Math.min(1.0, Math.round(baseScore * 100) / 100));

  return {
    sourceType,
    reliabilityScore: finalScore,
    explanation: explanations.join(' '),
    factors
  };
}
