/**
 * Deterministic Research Adapter: 100% offline, zero-API dependency implementation.
 */

import { buildResearchQueries } from '../planning/query-builder.js';
import { extractClaims } from '../evidence/claim-extractor.js';

export class DeterministicAdapter {
  constructor() {
    this.name = 'deterministic';
    this.isLlm = false;
  }

  /**
   * Refines queries deterministically.
   * @param {object} params
   * @param {string} params.topic
   * @param {string} [params.summary]
   * @returns {Promise<{ searchQueries: string[] }>}
   */
  async refineQueries({ topic, summary = '' }) {
    const built = buildResearchQueries(topic, summary, 5);
    return { searchQueries: built.searchQueries };
  }

  /**
   * Extracts claims deterministically from text.
   * @param {object} params
   * @param {Array<object>} params.sourceDocuments
   * @param {string} params.topic
   * @returns {Promise<Array<object>>}
   */
  async extractClaims({ sourceDocuments, topic }) {
    return extractClaims(sourceDocuments, topic, 15);
  }
}

export const deterministicAdapter = new DeterministicAdapter();
