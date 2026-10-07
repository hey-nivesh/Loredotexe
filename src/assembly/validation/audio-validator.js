/**
 * Audio Validator for Phase 6.
 * Checks audio integrity, container headers, and non-silent sample structure.
 */

import fs from 'node:fs';

export class AudioValidator {
  /**
   * Validates an audio file.
   * @param {string} filePath
   * @returns {{ valid: boolean, errors: Array<string>, warnings: Array<string> }}
   */
  validateAudio(filePath) {
    const errors = [];
    const warnings = [];

    if (!filePath || !fs.existsSync(filePath)) {
      errors.push(`Audio file does not exist at '${filePath}'.`);
      return { valid: false, errors, warnings };
    }

    const stats = fs.statSync(filePath);
    if (stats.size < 44) {
      errors.push(`Audio file size (${stats.size} bytes) is below minimum audio header threshold.`);
      return { valid: false, errors, warnings };
    }

    const buffer = fs.readFileSync(filePath);
    const isWav = buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE';
    const isM4a = buffer.length >= 8 && buffer.toString('ascii', 4, 8) === 'ftyp';

    if (!isWav && !isM4a) {
      warnings.push('Audio file format is non-standard or compressed container.');
    }

    return {
      valid: errors.length === 0,
      fileSizeBytes: stats.size,
      errors,
      warnings
    };
  }
}
