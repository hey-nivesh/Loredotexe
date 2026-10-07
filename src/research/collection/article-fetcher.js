/**
 * Safe HTTP Article Fetcher with timeout, status isolation, size limits, and in-memory caching.
 */

import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
import { normalizeUrl } from '../discovery/candidate-normalizer.js';
import { SourceFetchError } from '../errors/research-errors.js';
import { logger } from '../../logging/logger.js';

export class ArticleFetcher {
  /**
   * @param {object} [options={}]
   * @param {number} [options.timeoutMs=7000]
   * @param {number} [options.maxSizeBytes=1048576] 1MB
   * @param {number} [options.cacheTtlMs=300000] 5 minutes
   */
  constructor({ timeoutMs = 7000, maxSizeBytes = 1048576, cacheTtlMs = 300000 } = {}) {
    this.timeoutMs = timeoutMs;
    this.maxSizeBytes = maxSizeBytes;
    this.cacheTtlMs = cacheTtlMs;
    this.cache = new Map();
  }

  /**
   * Fetches the HTML content of a URL safely.
   * @param {string} rawUrl
   * @returns {Promise<{ url: string, status: 'fetched'|'failed'|'blocked', statusCode: number|null, html: string|null, contentType: string, retrievedAt: string, error: string|null, retryAfter: number|null }>}
   */
  async fetchArticle(rawUrl) {
    const url = normalizeUrl(rawUrl);
    if (!url || !/^https?:\/\//i.test(url)) {
      return {
        url: rawUrl,
        status: 'failed',
        statusCode: null,
        html: null,
        contentType: '',
        retrievedAt: new Date().toISOString(),
        error: 'Invalid or missing HTTP/HTTPS URL.',
        retryAfter: null
      };
    }

    // Check cache
    const now = Date.now();
    if (this.cache.has(url)) {
      const entry = this.cache.get(url);
      if (now - entry.timestamp < this.cacheTtlMs) {
        return entry.data;
      }
    }

    try {
      const res = await this._performGet(url);
      const result = {
        url,
        status: 'fetched',
        statusCode: res.statusCode,
        html: res.body,
        contentType: res.contentType,
        retrievedAt: new Date().toISOString(),
        error: null,
        retryAfter: null
      };

      this.cache.set(url, { timestamp: now, data: result });
      return result;
    } catch (err) {
      logger.warn('Failed to fetch article page', { url, error: err.message });
      const isBlocked = err.statusCode === 403 || err.statusCode === 401 || err.statusCode === 429;
      const result = {
        url,
        status: isBlocked ? 'blocked' : 'failed',
        statusCode: err.statusCode || null,
        html: null,
        contentType: '',
        retrievedAt: new Date().toISOString(),
        error: err.message,
        retryAfter: err.retryAfter || null
      };
      return result;
    }
  }

  /**
   * Performs an HTTP GET with redirect support and size bounds.
   * @private
   */
  _performGet(targetUrl, redirectsLeft = 3) {
    return new Promise((resolve, reject) => {
      try {
        const parsed = new URL(targetUrl);
        const protocol = parsed.protocol === 'https:' ? https : http;

        const req = protocol.get(
          targetUrl,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 (Loredotexe Research Bot)',
              Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9'
            },
            timeout: this.timeoutMs
          },
          (res) => {
            // Handle redirects
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
              if (redirectsLeft <= 0) {
                reject(new SourceFetchError(`Too many redirects fetching article: ${targetUrl}`, { targetUrl }));
                return;
              }
              const nextUrl = new URL(res.headers.location, targetUrl).toString();
              resolve(this._performGet(nextUrl, redirectsLeft - 1));
              return;
            }

            const contentType = (res.headers['content-type'] || '').toLowerCase();
            const retryAfterHeader = res.headers['retry-after'];
            const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) || null : null;

            if (res.statusCode < 200 || res.statusCode >= 300) {
              const fetchErr = new SourceFetchError(`HTTP ${res.statusCode} from ${targetUrl}`, {
                statusCode: res.statusCode,
                targetUrl
              });
              fetchErr.statusCode = res.statusCode;
              fetchErr.retryAfter = retryAfter;
              reject(fetchErr);
              return;
            }

            let body = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
              body += chunk;
              if (body.length > this.maxSizeBytes) {
                req.destroy();
                reject(new SourceFetchError(`Article body exceeds ${this.maxSizeBytes} bytes limit.`, { targetUrl }));
              }
            });

            res.on('end', () => {
              resolve({
                statusCode: res.statusCode,
                contentType,
                body
              });
            });
          }
        );

        req.on('timeout', () => {
          req.destroy();
          reject(new SourceFetchError(`Timeout after ${this.timeoutMs}ms fetching article: ${targetUrl}`, { targetUrl }));
        });

        req.on('error', (err) => {
          reject(new SourceFetchError(`Network error fetching article: ${err.message}`, { targetUrl, error: err.message }));
        });
      } catch (err) {
        reject(new SourceFetchError(`Malformed URL: ${targetUrl}`, { targetUrl, error: err.message }));
      }
    });
  }
}

export const articleFetcher = new ArticleFetcher();
