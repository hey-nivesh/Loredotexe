/**
 * Trend Provider: Discovers, fetches, and aggregates candidate topics across registered feeds.
 */

import { sourceRegistry } from './source-registry.js';
import { fetchFeedXml, parseFeedXml } from './rss-provider.js';
import { deduplicateCandidates } from './candidate-normalizer.js';
import { logger } from '../../logging/logger.js';

export class TrendProvider {
  /**
   * @param {import('./source-registry.js').SourceRegistry} [registry]
   */
  constructor(registry = sourceRegistry) {
    this.registry = registry;
  }

  /**
   * Discovers candidates across registered feeds.
   * @param {object} [options={}]
   * @param {string} [options.category='all']
   * @param {number} [options.maxPerSource=10]
   * @param {number} [options.timeoutMs=6000]
   * @param {Array<string>} [options.sourceIds]
   * @returns {Promise<{ totalDiscovered: number, uniqueCandidates: number, sourcesPolled: number, failedSources: Array<{ id: string, error: string }>, candidates: Array<object> }>}
   */
  async discoverCandidates({ category = 'all', maxPerSource = 10, timeoutMs = 6000, sourceIds = null } = {}) {
    let sources = sourceIds
      ? sourceIds.map((id) => this.registry.getSourceById(id)).filter(Boolean)
      : this.registry.getSourcesByCategory(category);

    if (sources.length === 0) {
      return {
        totalDiscovered: 0,
        uniqueCandidates: 0,
        sourcesPolled: 0,
        failedSources: [],
        candidates: []
      };
    }

    const allRawItems = [];
    const failedSources = [];
    let sourcesPolled = 0;

    // Concurrency limit helper (batches of 4)
    const BATCH_SIZE = 4;
    for (let i = 0; i < sources.length; i += BATCH_SIZE) {
      const batch = sources.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async (src) => {
        sourcesPolled++;
        try {
          const xml = await fetchFeedXml(src.feedUrl, { timeoutMs });
          const items = parseFeedXml(xml, src);
          return { source: src, items: items.slice(0, maxPerSource) };
        } catch (err) {
          logger.warn('Failed to fetch research feed', { sourceId: src.id, error: err.message });
          return { source: src, error: err.message };
        }
      });

      const results = await Promise.allSettled(promises);
      for (const res of results) {
        if (res.status === 'fulfilled') {
          if (res.value.error) {
            failedSources.push({ id: res.value.source.id, error: res.value.error });
          } else if (res.value.items) {
            allRawItems.push(...res.value.items);
          }
        }
      }
    }

    const unique = deduplicateCandidates(allRawItems);

    logger.info('Discovery completed', {
      totalFound: allRawItems.length,
      uniqueCount: unique.length,
      sourcesPolled,
      failedSourcesCount: failedSources.length
    });

    return {
      totalDiscovered: allRawItems.length,
      uniqueCandidates: unique.length,
      sourcesPolled,
      failedSources,
      candidates: unique
    };
  }
}

export const trendProvider = new TrendProvider();
