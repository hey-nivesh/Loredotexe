/**
 * Subtitle Chunker for Phase 6.
 * Splits text into readable 1-2 line subtitle blocks respecting character limits and sentence pauses.
 */

import { DEFAULT_ASSEMBLY_CONFIG } from '../config/assembly-config.js';

export class SubtitleChunker {
  /**
   * @param {object} [options={}]
   */
  constructor(options = {}) {
    this.maxCharsPerLine = options.maxCharsPerLine || DEFAULT_ASSEMBLY_CONFIG.subtitleMaxCharsPerLine;
    this.maxLines = options.maxLines || DEFAULT_ASSEMBLY_CONFIG.subtitleMaxLines;
  }

  /**
   * Chunks a text string into readable lines.
   * @param {string} text
   * @returns {Array<string>} Array of chunked subtitle blocks (each block has 1-2 lines joined by \n)
   */
  chunkText(text) {
    if (!text || typeof text !== 'string') return [];
    const clean = text.trim();
    if (clean.length <= this.maxCharsPerLine) {
      return [clean];
    }

    const words = clean.split(/\s+/).filter(Boolean);
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      const prospective = currentLine ? `${currentLine} ${word}` : word;
      if (prospective.length <= this.maxCharsPerLine) {
        currentLine = prospective;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);

    // Group into chunks of maxLines (e.g., 2 lines per subtitle cue)
    const chunks = [];
    for (let i = 0; i < lines.length; i += this.maxLines) {
      chunks.push(lines.slice(i, i + this.maxLines).join('\n'));
    }

    return chunks;
  }
}
