/**
 * HTML Content & Evidence Excerpt Extractor with Prompt-Injection Defense.
 */

import { decodeHtmlEntities } from '../discovery/candidate-normalizer.js';

const INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?previous\s+(?:instructions|prompts)/gi,
  /system\s*prompt\s*override/gi,
  /you\s+are\s+now\s+(?:an?\s+)?(?:unrestricted|admin|god|jailbroken)/gi,
  /<\|(?:im_start|im_end|endoftext)\|>/gi,
  /execute\s+(?:shell|command|sql|terminal)/gi,
  /disregard\s+(?:safety|verification|rules)/gi
];

/**
 * Neutralizes potential prompt-injection attack strings in external text.
 * @param {string} text
 * @returns {string}
 */
export function sanitizeUntrustedText(text) {
  if (!text || typeof text !== 'string') return '';
  let clean = text;
  for (const pattern of INJECTION_PATTERNS) {
    clean = clean.replace(pattern, '[INJECTION_ATTEMPT_REDACTED]');
  }
  return clean;
}

/**
 * Extracts readable article text paragraphs and evidence excerpts from raw HTML.
 * @param {string} html
 * @param {object} [options={}]
 * @param {number} [options.maxCharacters=15000]
 * @returns {{ paragraphs: string[], plainText: string, excerpts: Array<{ id: string, text: string, paragraphIndex: number }> }}
 */
export function extractArticleContent(html, { maxCharacters = 15000 } = {}) {
  if (!html || typeof html !== 'string') {
    return { paragraphs: [], plainText: '', excerpts: [] };
  }

  // 1. Strip non-content blocks
  let stripped = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside\b[^>]*>[\s\S]*?<\/aside>/gi, '')
    .replace(/<form\b[^>]*>[\s\S]*?<\/form>/gi, '')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '');

  // 2. Extract paragraph-level tags
  const paragraphMatches = stripped.match(/<(?:p|h1|h2|h3|li|blockquote)\b[^>]*>([\s\S]*?)<\/(?:p|h1|h2|h3|li|blockquote)>/gi) || [];

  const rawParagraphs = [];
  let currentChars = 0;

  for (const pTag of paragraphMatches) {
    const textOnly = pTag
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const decoded = decodeHtmlEntities(textOnly);
    const sanitized = sanitizeUntrustedText(decoded);

    // Keep meaningful paragraphs (> 25 characters, not navigation snippets)
    if (sanitized.length >= 25) {
      if (currentChars + sanitized.length > maxCharacters) {
        const remaining = maxCharacters - currentChars;
        if (remaining > 50) {
          rawParagraphs.push(sanitized.slice(0, remaining));
        }
        break;
      }
      rawParagraphs.push(sanitized);
      currentChars += sanitized.length;
    }
  }

  // Fallback if no paragraph tags matched
  if (rawParagraphs.length === 0) {
    const plainFallback = decodeHtmlEntities(
      stripped.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    );
    const sanitizedFallback = sanitizeUntrustedText(plainFallback).slice(0, maxCharacters);
    if (sanitizedFallback.length > 25) {
      rawParagraphs.push(sanitizedFallback);
    }
  }

  const excerpts = rawParagraphs.map((text, idx) => ({
    id: `excerpt-${idx + 1}`,
    text: text.slice(0, 400).trim(),
    paragraphIndex: idx + 1
  }));

  return {
    paragraphs: rawParagraphs,
    plainText: rawParagraphs.join('\n\n'),
    excerpts
  };
}
