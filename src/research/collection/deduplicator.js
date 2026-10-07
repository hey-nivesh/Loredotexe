/**
 * Source Deduplication, Domain Grouping, and Wire-Report Syndication Detector.
 */

import { getDomainName } from './metadata-extractor.js';

const WIRE_PATTERNS = [
  { group: 'wire:ap', pattern: /\b(?:Associated Press|\bAP\b|via AP|AP Photo)\b/i },
  { group: 'wire:reuters', pattern: /\b(?:Reuters|via Reuters)\b/i },
  { group: 'wire:afp', pattern: /\b(?:Agence France-Presse|\bAFP\b)\b/i },
  { group: 'wire:prnewswire', pattern: /\b(?:PR Newswire|PRNewswire)\b/i },
  { group: 'wire:businesswire', pattern: /\b(?:Business Wire|BusinessWire)\b/i },
  { group: 'wire:globenewswire', pattern: /\b(?:GlobeNewswire|Globe Newswire)\b/i },
  { group: 'wire:bloomberg', pattern: /\b(?:Bloomberg News|via Bloomberg)\b/i }
];

/**
 * Detects if content is a syndicated wire report and returns the independence group identifier.
 * @param {string} text
 * @param {string} url
 * @param {string} [publisher]
 * @returns {{ independenceGroup: string, isSyndicated: boolean, wireService: string|null }}
 */
export function classifySourceIndependence(text, url, publisher) {
  const domain = getDomainName(url).toLowerCase();
  const sample = `${publisher || ''} ${text ? text.slice(0, 1000) : ''}`;

  for (const wire of WIRE_PATTERNS) {
    if (wire.pattern.test(sample)) {
      return {
        independenceGroup: wire.group,
        isSyndicated: true,
        wireService: wire.group.replace('wire:', '').toUpperCase()
      };
    }
  }

  return {
    independenceGroup: `domain:${domain}`,
    isSyndicated: false,
    wireService: null
  };
}

/**
 * Deduplicates sources and groups them by independence group.
 * @param {Array<object>} sources
 * @returns {Array<object>}
 */
export function deduplicateSources(sources) {
  if (!Array.isArray(sources)) return [];

  const seenUrls = new Set();
  const unique = [];

  for (const s of sources) {
    const url = (s.source_url || s.url || '').trim().toLowerCase();
    if (!url || seenUrls.has(url)) continue;
    seenUrls.add(url);
    unique.push(s);
  }

  return unique;
}
