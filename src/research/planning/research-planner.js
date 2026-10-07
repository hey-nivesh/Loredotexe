/**
 * Research Planner: Coordinates query planning, question synthesis, and resource budget bounds.
 */

import { buildResearchQueries } from './query-builder.js';
import { logger } from '../../logging/logger.js';

export class ResearchPlanner {
  /**
   * @param {object} [options={}]
   * @param {number} [options.maxQueriesPerTopic=5]
   * @param {number} [options.maxDocumentsPerRun=10]
   */
  constructor({ maxQueriesPerTopic = 5, maxDocumentsPerRun = 10 } = {}) {
    this.maxQueriesPerTopic = maxQueriesPerTopic;
    this.maxDocumentsPerRun = maxDocumentsPerRun;
  }

  /**
   * Generates a structured research plan for a candidate topic.
   * @param {object} candidate
   * @param {object} [adapter] Optional LLM or deterministic adapter
   * @returns {Promise<{ topic: string, category: string, researchQuestions: Array<object>, searchQueries: string[], limits: { maxQueries: number, maxDocuments: number } }>}
   */
  async createPlan(candidate, adapter = null) {
    const topic = candidate.title || candidate.normalized_topic || 'Untitled Topic';
    const summary = candidate.summary || '';
    const category = candidate.category || 'general';

    logger.info('Creating research plan for topic', { topic, category });

    const deterministic = buildResearchQueries(topic, summary, this.maxQueriesPerTopic);

    let finalQuestions = deterministic.questions;
    let finalQueries = deterministic.searchQueries;

    // If an adapter with query refinement is provided
    if (adapter && typeof adapter.refineQueries === 'function') {
      try {
        const refined = await adapter.refineQueries({ topic, summary, questions: deterministic.questions });
        if (refined && Array.isArray(refined.searchQueries) && refined.searchQueries.length > 0) {
          finalQueries = refined.searchQueries.slice(0, this.maxQueriesPerTopic);
        }
      } catch (err) {
        logger.warn('LLM query refinement failed, using deterministic queries', { error: err.message });
      }
    }

    return {
      topic,
      category,
      researchQuestions: finalQuestions,
      searchQueries: finalQueries,
      limits: {
        maxQueries: this.maxQueriesPerTopic,
        maxDocuments: this.maxDocumentsPerRun
      }
    };
  }
}

export const researchPlanner = new ResearchPlanner();
