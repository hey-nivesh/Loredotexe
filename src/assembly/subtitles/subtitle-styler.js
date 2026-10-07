/**
 * Subtitle Styler for Phase 6.
 * Formats FFmpeg subtitle filter strings with configurable font, size, outline, and safe margins.
 */

import { DEFAULT_ASSEMBLY_CONFIG } from '../config/assembly-config.js';

export class SubtitleStyler {
  /**
   * @param {object} [options={}]
   */
  constructor(options = {}) {
    this.font = options.font || DEFAULT_ASSEMBLY_CONFIG.subtitleFont;
    this.fontSize = options.fontSize || DEFAULT_ASSEMBLY_CONFIG.subtitleFontSize;
    this.marginV = options.marginV || DEFAULT_ASSEMBLY_CONFIG.subtitleMargin;
    this.outline = options.outline || DEFAULT_ASSEMBLY_CONFIG.subtitleOutline;
    this.alignment = 2; // Bottom Center (ASS standard)
  }

  /**
   * Builds an FFmpeg `subtitles` filter option string with escaped path.
   * @param {string} srtPath
   * @returns {string} Filter expression string
   */
  buildFilterString(srtPath) {
    // Windows backslashes need forward slashes or escaping for FFmpeg filter parser
    const sanitizedPath = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:');
    const forceStyle = `Fontname=${this.font},Fontsize=${this.fontSize},PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=${this.outline},Alignment=${this.alignment},MarginV=${this.marginV}`;

    return `subtitles='${sanitizedPath}':force_style='${forceStyle}'`;
  }
}
