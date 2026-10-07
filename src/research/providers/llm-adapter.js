/**
 * Optional Free-Tier LLM Adapter with automatic fallback to Deterministic Adapter.
 */

import { deterministicAdapter } from './deterministic-adapter.js';
import { logger } from '../../logging/logger.js';

export class LlmAdapter {
  /**
   * @param {object} [options={}]
   * @param {string} [options.provider='deterministic'] 'ollama' | 'gemini' | 'groq' | 'deterministic'
   * @param {string} [options.baseUrl]
   * @param {string} [options.apiKey]
   * @param {string} [options.model]
   */
  constructor({
    provider = process.env.RESEARCH_LLM_PROVIDER || 'deterministic',
    baseUrl = process.env.LOCAL_LLM_BASE_URL || 'http://localhost:11434',
    apiKey = process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY || null,
    model = process.env.LOCAL_LLM_MODEL || 'llama3.2:3b'
  } = {}) {
    this.provider = provider.toLowerCase();
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.model = model;
    this.fallback = deterministicAdapter;
  }

  /**
   * Refines queries using LLM if available, otherwise falls back to deterministic rules.
   * @param {object} params
   */
  async refineQueries(params) {
    if (this.provider === 'deterministic' || (!this.apiKey && this.provider !== 'ollama')) {
      return this.fallback.refineQueries(params);
    }

    try {
      if (this.provider === 'ollama') {
        const prompt = `Given the topic: "${params.topic}" and summary: "${params.summary}", generate 5 specific factual search queries. Return JSON only: { "searchQueries": ["query 1", "query 2", ...] }`;
        const res = await fetch(`${this.baseUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: this.model, prompt, stream: false, format: 'json' }),
          signal: AbortSignal.timeout(8000)
        });

        if (res.ok) {
          const json = await res.json();
          const parsed = JSON.parse(json.response);
          if (Array.isArray(parsed.searchQueries) && parsed.searchQueries.length > 0) {
            return { searchQueries: parsed.searchQueries };
          }
        }
      }
    } catch (err) {
      logger.warn('LLM query refinement failed, using deterministic fallback', { error: err.message });
    }

    return this.fallback.refineQueries(params);
  }

  /**
   * Extracts claims from text.
   * @param {object} params
   */
  async extractClaims(params) {
    // Deterministic extractor is authoritative for grounded evidence matching
    return this.fallback.extractClaims(params);
  }
}

export const llmAdapter = new LlmAdapter();
