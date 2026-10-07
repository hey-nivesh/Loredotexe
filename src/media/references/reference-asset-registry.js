/**
 * Reference Asset Registry for Phase 5 Media Generation Engine.
 * Resolves character, location, prop, and style reference assets with support for TEXT_ONLY and REFERENCE_AWARE modes.
 */

import fs from 'node:fs';
import path from 'node:path';

export const REFERENCE_STATUSES = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  MISSING: 'MISSING',
  INVALID: 'INVALID',
  GENERATING: 'GENERATING',
  FAILED: 'FAILED'
});

export class ReferenceAssetRegistry {
  /**
   * @param {string} [baseDir]
   */
  constructor(baseDir = path.join(process.cwd(), 'data', 'media', 'references')) {
    this.baseDir = baseDir;
    this.references = new Map();
  }

  /**
   * Registers or updates a reference asset record.
   * @param {object} item
   */
  registerReference(item) {
    const refId = item.reference_id || item.id;
    this.references.set(refId, {
      reference_id: refId,
      type: item.type || 'character',
      entity_id: item.entity_id,
      path: item.path || null,
      version: item.version || 1,
      status: item.status || REFERENCE_STATUSES.MISSING,
      metadata: item.metadata || {}
    });
  }

  /**
   * Resolves reference requirements from Phase 4 manifest against available assets on disk.
   * @param {object} referenceRequirements Phase 4 reference_requirements object
   * @param {string} [projectId]
   * @returns {object} Manifest resolution report
   */
  resolveReferences(referenceRequirements = {}, projectId = null) {
    const required = referenceRequirements.manifest || referenceRequirements.items || [];
    const resolved = [];
    let availableCount = 0;
    let missingCount = 0;

    for (const req of required) {
      const refId = req.asset_id || req.reference_id;
      const expectedPath = req.expected_path || (projectId ? path.join(this.baseDir, projectId, `${refId}.png`) : null);
      
      const exists = expectedPath && fs.existsSync(expectedPath);
      const status = exists ? REFERENCE_STATUSES.AVAILABLE : REFERENCE_STATUSES.MISSING;

      if (exists) availableCount++;
      else missingCount++;

      resolved.push({
        reference_id: refId,
        type: req.entity_type || req.type || 'character',
        entity_id: req.entity_id,
        path: exists ? expectedPath : null,
        status,
        prompt_guide: req.prompt_guide || ''
      });
    }

    return {
      mode: availableCount > 0 ? 'REFERENCE_AWARE' : 'TEXT_ONLY',
      total_required: required.length,
      available_count: availableCount,
      missing_count: missingCount,
      references: resolved
    };
  }
}
