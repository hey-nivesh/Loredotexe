/**
 * HTML Metadata Extractor (OpenGraph, Twitter Cards, JSON-LD, Standard Meta).
 */

import { decodeHtmlEntities, normalizeUrl, normalizeTitle } from '../discovery/candidate-normalizer.js';
import { parseIsoDate } from '../discovery/rss-provider.js';

/**
 * Extracts structured metadata from raw HTML.
 * @param {string} html
 * @param {string} pageUrl
 * @returns {object}
 */
export function extractMetadata(html, pageUrl) {
  if (!html || typeof html !== 'string') {
    return {
      title: '',
      description: '',
      publisher: getDomainName(pageUrl),
      author: null,
      publishedAt: null,
      canonicalUrl: normalizeUrl(pageUrl),
      language: 'en'
    };
  }

  // 1. Title extraction
  let title = '';
  const ogTitleMatch = html.match(/<meta\b[^>]*\bproperty=["']og:title["'][^>]*\bcontent=["']([^"']+)["'][^>]*>/i)
    || html.match(/<meta\b[^>]*\bcontent=["']([^"']+)["'][^>]*\bproperty=["']og:title["'][^>]*>/i);
  if (ogTitleMatch) {
    title = ogTitleMatch[1];
  } else {
    const titleTagMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    if (titleTagMatch) title = titleTagMatch[1];
  }

  // 2. Description extraction
  let description = '';
  const ogDescMatch = html.match(/<meta\b[^>]*\bproperty=["']og:description["'][^>]*\bcontent=["']([^"']+)["'][^>]*>/i)
    || html.match(/<meta\b[^>]*\bname=["']description["'][^>]*\bcontent=["']([^"']+)["'][^>]*>/i);
  if (ogDescMatch) description = ogDescMatch[1];

  // 3. Publisher / Site Name extraction
  let publisher = '';
  const ogSiteMatch = html.match(/<meta\b[^>]*\bproperty=["']og:site_name["'][^>]*\bcontent=["']([^"']+)["'][^>]*>/i);
  if (ogSiteMatch) {
    publisher = ogSiteMatch[1];
  } else {
    publisher = getDomainName(pageUrl);
  }

  // 4. Author extraction
  let author = null;
  const authorMatch = html.match(/<meta\b[^>]*\bname=["']author["'][^>]*\bcontent=["']([^"']+)["'][^>]*>/i);
  if (authorMatch) author = decodeHtmlEntities(authorMatch[1]).trim();

  // 5. Published Date extraction
  let publishedAt = null;
  const dateMetaMatch = html.match(/<meta\b[^>]*\b(?:property|name)=["'](?:article:published_time|pubdate|date)["'][^>]*\bcontent=["']([^"']+)["'][^>]*>/i)
    || html.match(/<time\b[^>]*\bdatetime=["']([^"']+)["'][^>]*>/i);
  if (dateMetaMatch) {
    publishedAt = parseIsoDate(dateMetaMatch[1]);
  }

  // 6. JSON-LD fallback for rich schema
  try {
    const jsonLdMatch = html.match(/<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
    if (jsonLdMatch) {
      const jsonLd = JSON.parse(jsonLdMatch[1].trim());
      const data = Array.isArray(jsonLd) ? jsonLd[0] : jsonLd;
      if (!title && data.headline) title = data.headline;
      if (!description && data.description) description = data.description;
      if (!author && data.author) {
        author = typeof data.author === 'string' ? data.author : (data.author.name || null);
      }
      if (!publishedAt && data.datePublished) {
        publishedAt = parseIsoDate(data.datePublished);
      }
      if (!publisher && data.publisher) {
        publisher = typeof data.publisher === 'string' ? data.publisher : (data.publisher.name || publisher);
      }
    }
  } catch {
    // Non-fatal JSON-LD parse error
  }

  // 7. Canonical URL
  let canonicalUrl = normalizeUrl(pageUrl);
  const canonicalMatch = html.match(/<link\b[^>]*\brel=["']canonical["'][^>]*\bhref=["']([^"']+)["'][^>]*>/i);
  if (canonicalMatch) {
    canonicalUrl = normalizeUrl(canonicalMatch[1]);
  }

  return {
    title: normalizeTitle(title),
    description: decodeHtmlEntities(description).trim(),
    publisher: decodeHtmlEntities(publisher).trim() || getDomainName(pageUrl),
    author,
    publishedAt,
    canonicalUrl,
    language: 'en'
  };
}

/**
 * Derives a human-readable publisher name from a URL domain.
 * @param {string} rawUrl
 * @returns {string}
 */
export function getDomainName(rawUrl) {
  try {
    const hostname = new URL(rawUrl).hostname.replace(/^www\./i, '');
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      const main = parts[0];
      return main.charAt(0).toUpperCase() + main.slice(1);
    }
    return hostname;
  } catch {
    return 'Unknown Publisher';
  }
}
