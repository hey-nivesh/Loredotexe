/**
 * Subtitle Generator for Phase 6.
 * Generates SubRip (.srt) and WebVTT (.vtt) subtitle files from synchronized narration timeline.
 */

import fs from 'node:fs';
import path from 'node:path';
import { SubtitleChunker } from './subtitle-chunker.js';
import { SubtitleError, ASSEMBLY_ERROR_CODES } from '../errors/assembly-errors.js';

export class SubtitleGenerator {
  /**
   * @param {object} [options={}]
   */
  constructor(options = {}) {
    this.chunker = new SubtitleChunker(options);
  }

  /**
   * Formats seconds into SRT timestamp (HH:MM:SS,mmm).
   * @param {number} totalSeconds
   * @returns {string}
   */
  formatSrtTimestamp(totalSeconds) {
    const sec = Math.max(0, totalSeconds);
    const totalMillis = Math.round(sec * 1000);
    const hours = Math.floor(totalMillis / 3600000);
    const minutes = Math.floor((totalMillis % 3600000) / 60000);
    const seconds = Math.floor((totalMillis % 60000) / 1000);
    const millis = totalMillis % 1000;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
  }

  /**
   * Formats seconds into WebVTT timestamp (HH:MM:SS.mmm).
   * @param {number} totalSeconds
   * @returns {string}
   */
  formatVttTimestamp(totalSeconds) {
    return this.formatSrtTimestamp(totalSeconds).replace(',', '.');
  }

  /**
   * Builds cues array from timeline segments.
   * @param {object} timeline Canonical narration timeline
   * @returns {Array<object>} Subtitle cues
   */
  buildCues(timeline) {
    if (!timeline || !Array.isArray(timeline.segments)) {
      throw new SubtitleError('Invalid timeline provided for subtitle generation.', ASSEMBLY_ERROR_CODES.INVALID_INPUT);
    }

    const cues = [];
    let cueIndex = 1;

    for (const seg of timeline.segments) {
      const text = (seg.text || '').trim();
      if (!text) continue;

      const chunks = this.chunker.chunkText(text);
      if (chunks.length === 0) continue;

      const segStart = seg.start_seconds;
      const segEnd = seg.end_seconds;
      const totalDur = Math.max(0.1, segEnd - segStart);
      const chunkDur = totalDur / chunks.length;

      for (let i = 0; i < chunks.length; i++) {
        const cStart = segStart + (i * chunkDur);
        const cEnd = segStart + ((i + 1) * chunkDur);

        cues.push({
          index: cueIndex++,
          startSeconds: Math.round(cStart * 1000) / 1000,
          endSeconds: Math.round(cEnd * 1000) / 1000,
          text: chunks[i]
        });
      }
    }

    return cues;
  }

  /**
   * Generates standard SRT string.
   * @param {Array<object>} cues
   * @returns {string}
   */
  toSrtString(cues) {
    return cues.map((cue) => {
      const start = this.formatSrtTimestamp(cue.startSeconds);
      const end = this.formatSrtTimestamp(cue.endSeconds);
      return `${cue.index}\n${start} --> ${end}\n${cue.text}\n`;
    }).join('\n');
  }

  /**
   * Generates standard WebVTT string.
   * @param {Array<object>} cues
   * @returns {string}
   */
  toVttString(cues) {
    const body = cues.map((cue) => {
      const start = this.formatVttTimestamp(cue.startSeconds);
      const end = this.formatVttTimestamp(cue.endSeconds);
      return `${cue.index}\n${start} --> ${end}\n${cue.text}\n`;
    }).join('\n');

    return `WEBVTT\n\n${body}`;
  }

  /**
   * Writes SRT and WebVTT files to destination folder.
   * @param {object} timeline
   * @param {string} outputDir
   * @returns {{ srtPath: string, vttPath: string, cueCount: number }}
   */
  generateFiles(timeline, outputDir) {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const cues = this.buildCues(timeline);
    const srtContent = this.toSrtString(cues);
    const vttContent = this.toVttString(cues);

    const srtPath = path.join(outputDir, 'subtitles.srt');
    const vttPath = path.join(outputDir, 'subtitles.vtt');

    fs.writeFileSync(srtPath, srtContent, 'utf8');
    fs.writeFileSync(vttPath, vttContent, 'utf8');

    return {
      srtPath,
      vttPath,
      cueCount: cues.length
    };
  }
}
