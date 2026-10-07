/**
 * Candidate Normalization, URL Sanitization, Keyword Extraction, and Topic Deduplication.
 */

import { createHash } from 'node:crypto';

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  'ref',
  'source',
  'feature',
  'ncid',
  '_hsenc',
  '_hsmi'
]);

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can', 'cannot', 'could',
  'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have',
  'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is',
  'it', 'its', 'itself', 'just', 'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off',
  'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should',
  'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these',
  'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what',
  'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your', 'yours', 'yourself'
]);

/**
 * Strips HTML entity encodings.
 * @param {string} str
 * @returns {string}
 */
export function decodeHtmlEntities(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Normalizes URL by removing tracking query parameters and trailing slashes.
 * @param {string} rawUrl
 * @returns {string}
 */
export function normalizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  try {
    const parsed = new URL(rawUrl.trim());
    // Strip hash fragment
    parsed.hash = '';

    // Filter tracking params
    const keysToDelete = [];
    for (const key of parsed.searchParams.keys()) {
      if (TRACKING_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith('utm_')) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      parsed.searchParams.delete(key);
    }

    // Normalize protocol and host to lowercase
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.host = parsed.host.toLowerCase();

    let clean = parsed.toString();
    if (clean.endsWith('/') && parsed.pathname !== '/') {
      clean = clean.slice(0, -1);
    }
    return clean;
  } catch {
    return rawUrl.trim();
  }
}

/**
 * Normalizes title string by stripping clickbait tags, extra spaces, and standardizing typography.
 * @param {string} rawTitle
 * @returns {string}
 */
export function normalizeTitle(rawTitle) {
  if (!rawTitle || typeof rawTitle !== 'string') return '';
  let clean = decodeHtmlEntities(rawTitle)
    .replace(/\s+/g, ' ')
    .trim();

  // Strip common media prefixes
  clean = clean
    .replace(/^\[(?:WATCH|EXCLUSIVE|BREAKING|REPORT|UPDATE|VIDEO|ANALYSIS)\]\s*/i, '')
    .replace(/^(?:BREAKING|REPORT|UPDATE|WATCH):\s*/i, '')
    .replace(/\s*\|\s*(?:Ars Technica|IGN|BBC News|PC Gamer|ScienceDaily|Phys\.org)$/i, '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-');

  return clean.trim();
}

/**
 * Extracts meaningful keyword tokens from text.
 * @param {string} text
 * @param {number} [maxKeywords=10]
 * @returns {string[]}
 */
export function extractKeywords(text, maxKeywords = 10) {
  if (!text || typeof text !== 'string') return [];
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));

  const freq = new Map();
  for (const w of words) {
    freq.set(w, (freq.get(w) || 0) + 1);
  }

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map((entry) => entry[0]);
}

/**
 * Computes Jaccard token similarity between two titles.
 * @param {string} textA
 * @param {string} textB
 * @returns {number} 0.0 to 1.0
 */
export function calculateTopicSimilarity(textA, textB) {
  const setA = new Set(extractKeywords(textA, 25));
  const setB = new Set(extractKeywords(textB, 25));

  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      intersection++;
    }
  }

  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Generates a deterministic UUID/hash from normalized URL or title.
 * @param {string} input
 * @returns {string}
 */
export function generateCandidateId(input) {
  const hash = createHash('sha256').update(input).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

/**
 * Deduplicates a list of candidates by exact URL, exact title, and near-duplicate topic similarity.
 * @param {Array<object>} candidates
 * @param {number} [similarityThreshold=0.70]
 * @returns {Array<object>}
 */
export function deduplicateCandidates(candidates, similarityThreshold = 0.70) {
  if (!Array.isArray(candidates)) return [];

  const seenUrls = new Set();
  const seenTitles = new Set();
  const uniqueCandidates = [];

  for (const c of candidates) {
    const cleanUrl = normalizeUrl(c.source_url || c.url);
    const cleanTitle = normalizeTitle(c.title);

    if (!cleanTitle || cleanTitle.length < 5) continue;

    // Check exact matches
    if (cleanUrl && seenUrls.has(cleanUrl)) continue;
    if (seenTitles.has(cleanTitle.toLowerCase())) continue;

    // Check near-duplicate fuzzy similarity against already accepted candidates
    let isNearDuplicate = false;
    for (const existing of uniqueCandidates) {
      const sim = calculateTopicSimilarity(cleanTitle, existing.title);
      if (sim >= similarityThreshold) {
        isNearDuplicate = true;
        break;
      }
    }

    if (!isNearDuplicate) {
      if (cleanUrl) seenUrls.add(cleanUrl);
      seenTitles.add(cleanTitle.toLowerCase());

      const keywords = extractKeywords(`${cleanTitle} ${c.summary || ''}`, 8);
      const candidateId = generateCandidateId(cleanUrl || cleanTitle);

      uniqueCandidates.push({
        candidate_id: candidateId,
        title: cleanTitle,
        normalized_topic: cleanTitle,
        summary: decodeHtmlEntities(c.summary || '').slice(0, 500).trim(),
        source_name: c.source_name || 'RSS Feed',
        source_url: cleanUrl,
        published_at: c.published_at || null,
        discovered_at: c.discovered_at || new Date().toISOString(),
        category: (c.category || 'general').toLowerCase(),
        keywords,
        originating_feed: c.originating_feed || null,
        retrieval_status: 'discovered'
      });
    }
  }

  return uniqueCandidates;
}
