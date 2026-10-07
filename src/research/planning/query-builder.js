/**
 * Deterministic Query Builder for the 9 Core Research Dimensions.
 */

import { extractKeywords } from '../discovery/candidate-normalizer.js';

export const RESEARCH_DIMENSIONS = Object.freeze([
  { id: 'q_what', prompt: 'What happened?', category: 'event_summary' },
  { id: 'q_when', prompt: 'When did it happen?', category: 'timeline' },
  { id: 'q_who', prompt: 'Who or what is involved?', category: 'key_entities' },
  { id: 'q_source', prompt: 'What is the original primary source or documentation?', category: 'primary_source' },
  { id: 'q_evidence', prompt: 'What empirical evidence or data supports the main claims?', category: 'evidence' },
  { id: 'q_context', prompt: 'What background lore or technical context is needed to understand it?', category: 'context' },
  { id: 'q_uncertainty', prompt: 'What remains disputed or unconfirmed?', category: 'uncertainty' },
  { id: 'q_misconception', prompt: 'What common misconception should be checked?', category: 'misconceptions' },
  { id: 'q_audience', prompt: 'Why does this matter to the audience of "The 10min Explosion"?', category: 'audience_relevance' }
]);

/**
 * Builds structured research questions and search queries for a topic.
 * @param {string} topic
 * @param {string} [summary]
 * @param {number} [maxQueries=5]
 * @returns {{ questions: Array<{ id: string, prompt: string, category: string, query: string }>, searchQueries: string[] }}
 */
export function buildResearchQueries(topic, summary = '', maxQueries = 5) {
  const cleanTopic = (topic || '').trim();
  const keywords = extractKeywords(`${cleanTopic} ${summary || ''}`, 5);
  const keywordPhrase = keywords.slice(0, 3).join(' ');

  const questions = [
    {
      id: 'q_what',
      prompt: 'What happened?',
      category: 'event_summary',
      query: `${cleanTopic} official announcement details`
    },
    {
      id: 'q_when',
      prompt: 'When did it happen?',
      category: 'timeline',
      query: `${cleanTopic} timeline date release`
    },
    {
      id: 'q_who',
      prompt: 'Who or what is involved?',
      category: 'key_entities',
      query: `${cleanTopic} key people company creators`
    },
    {
      id: 'q_source',
      prompt: 'What is the original primary source or documentation?',
      category: 'primary_source',
      query: `${cleanTopic} original source document report`
    },
    {
      id: 'q_evidence',
      prompt: 'What empirical evidence or data supports the main claims?',
      category: 'evidence',
      query: `${cleanTopic} verified facts data statistics`
    },
    {
      id: 'q_context',
      prompt: 'What background context is needed to understand it?',
      category: 'context',
      query: `${cleanTopic} background lore history explainer`
    },
    {
      id: 'q_uncertainty',
      prompt: 'What remains disputed or unconfirmed?',
      category: 'uncertainty',
      query: `${cleanTopic} controversy criticism disputed`
    },
    {
      id: 'q_misconception',
      prompt: 'What common misconception should be checked?',
      category: 'misconceptions',
      query: `${cleanTopic} myth misconception debunked`
    },
    {
      id: 'q_audience',
      prompt: 'Why does this matter to the audience of "The 10min Explosion"?',
      category: 'audience_relevance',
      query: `${cleanTopic} impact breakdown summary`
    }
  ];

  // Select top bounded queries
  const selectedQueries = questions.slice(0, maxQueries).map((q) => q.query);

  return {
    questions,
    searchQueries: selectedQueries
  };
}
