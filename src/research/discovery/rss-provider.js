/**
 * Lightweight, zero-dependency RSS and Atom XML Feed Parser and Fetcher.
 */

import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
import { decodeHtmlEntities } from './candidate-normalizer.js';
import { DiscoveryError } from '../errors/research-errors.js';
import { logger } from '../../logging/logger.js';

/**
 * Strips CDATA and XML tags from a string.
 * @param {string} str
 * @returns {string}
 */
export function cleanXmlString(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Safely parses date string to ISO format.
 * @param {string} dateStr
 * @returns {string|null}
 */
export function parseIsoDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  try {
    const d = new Date(dateStr.trim());
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

/**
 * Parses RSS 2.0 or Atom XML string into structured article items.
 * @param {string} xmlString
 * @param {object} [sourceMeta={}]
 * @returns {Array<object>}
 */
export function parseFeedXml(xmlString, sourceMeta = {}) {
  if (!xmlString || typeof xmlString !== 'string') return [];

  const items = [];
  const isAtom = /<feed\b[^>]*>/i.test(xmlString);

  if (isAtom) {
    // Atom feed parser (<entry>...</entry>)
    const entryRegex = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
    let match;
    while ((match = entryRegex.exec(xmlString)) !== null) {
      const entryXml = match[1];

      const titleMatch = entryXml.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
      const title = titleMatch ? cleanXmlString(titleMatch[1]) : '';

      // Link can be <link href="..."/> or <link>...</link>
      let link = '';
      const linkHrefMatch = entryXml.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/i);
      if (linkHrefMatch) {
        link = linkHrefMatch[1];
      } else {
        const linkTagMatch = entryXml.match(/<link\b[^>]*>([\s\S]*?)<\/link>/i);
        if (linkTagMatch) link = cleanXmlString(linkTagMatch[1]);
      }

      const summaryMatch = entryXml.match(/<(?:summary|content)\b[^>]*>([\s\S]*?)<\/(?:summary|content)>/i);
      const summary = summaryMatch ? cleanXmlString(summaryMatch[1]) : '';

      const dateMatch = entryXml.match(/<(?:published|updated)\b[^>]*>([\s\S]*?)<\/(?:published|updated)>/i);
      const publishedAt = dateMatch ? parseIsoDate(cleanXmlString(dateMatch[1])) : null;

      if (title && (link || title.length > 10)) {
        items.push({
          title: decodeHtmlEntities(title),
          url: link,
          source_url: link,
          summary: decodeHtmlEntities(summary),
          published_at: publishedAt,
          discovered_at: new Date().toISOString(),
          source_name: sourceMeta.name || 'Atom Feed',
          category: sourceMeta.category || 'general',
          originating_feed: sourceMeta.feedUrl || null
        });
      }
    }
  } else {
    // RSS 2.0 parser (<item>...</item>)
    const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
    let match;
    while ((match = itemRegex.exec(xmlString)) !== null) {
      const itemXml = match[1];

      const titleMatch = itemXml.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
      const title = titleMatch ? cleanXmlString(titleMatch[1]) : '';

      const linkMatch = itemXml.match(/<link\b[^>]*>([\s\S]*?)<\/link>/i);
      const link = linkMatch ? cleanXmlString(linkMatch[1]) : '';

      const descMatch = itemXml.match(/<(?:description|content:encoded)\b[^>]*>([\s\S]*?)<\/(?:description|content:encoded)>/i);
      const summary = descMatch ? cleanXmlString(descMatch[1]) : '';

      const dateMatch = itemXml.match(/<(?:pubDate|dc:date)\b[^>]*>([\s\S]*?)<\/(?:pubDate|dc:date)>/i);
      const publishedAt = dateMatch ? parseIsoDate(cleanXmlString(dateMatch[1])) : null;

      if (title && (link || title.length > 10)) {
        items.push({
          title: decodeHtmlEntities(title),
          url: link,
          source_url: link,
          summary: decodeHtmlEntities(summary),
          published_at: publishedAt,
          discovered_at: new Date().toISOString(),
          source_name: sourceMeta.name || 'RSS Feed',
          category: sourceMeta.category || 'general',
          originating_feed: sourceMeta.feedUrl || null
        });
      }
    }
  }

  return items;
}

/**
 * Fetches feed text over HTTP/HTTPS with timeout and redirect following.
 * @param {string} feedUrl
 * @param {object} [options={}]
 * @returns {Promise<string>}
 */
export function fetchFeedXml(feedUrl, { timeoutMs = 8000, maxRedirects = 3 } = {}) {
  return new Promise((resolve, reject) => {
    let redirectsCount = 0;

    const executeGet = (currentUrl) => {
      try {
        const parsed = new URL(currentUrl);
        const protocol = parsed.protocol === 'https:' ? https : http;

        const req = protocol.get(
          currentUrl,
          {
            headers: {
              'User-Agent': 'Loredotexe-Research-Bot/1.0 (+https://github.com/loredotexe)',
              Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*'
            },
            timeout: timeoutMs
          },
          (res) => {
            // Handle redirects (301, 302, 307, 308)
            if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
              if (redirectsCount >= maxRedirects) {
                reject(new DiscoveryError(`Too many redirects fetching feed: ${feedUrl}`, { feedUrl }));
                return;
              }
              redirectsCount++;
              const redirectUrl = new URL(res.headers.location, currentUrl).toString();
              executeGet(redirectUrl);
              return;
            }

            if (res.statusCode < 200 || res.statusCode >= 300) {
              reject(
                new DiscoveryError(`HTTP ${res.statusCode} received fetching feed: ${feedUrl}`, {
                  feedUrl,
                  statusCode: res.statusCode
                })
              );
              return;
            }

            let data = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
              data += chunk;
              if (data.length > 5 * 1024 * 1024) {
                req.destroy();
                reject(new DiscoveryError('Feed payload exceeds 5MB limit.', { feedUrl }));
              }
            });
            res.on('end', () => resolve(data));
          }
        );

        req.on('timeout', () => {
          req.destroy();
          reject(new DiscoveryError(`Timeout after ${timeoutMs}ms fetching feed: ${feedUrl}`, { feedUrl }));
        });

        req.on('error', (err) => {
          reject(new DiscoveryError(`Network error fetching feed: ${err.message}`, { feedUrl, error: err.message }));
        });
      } catch (err) {
        reject(new DiscoveryError(`Malformed feed URL: ${feedUrl}`, { feedUrl, error: err.message }));
      }
    };

    executeGet(feedUrl);
  });
}
