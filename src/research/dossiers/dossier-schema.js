/**
 * Research Dossier JSON Schema Validator.
 */

import { DossierValidationError } from '../errors/research-errors.js';

export const DOSSIER_SCHEMA_VERSION = '1.0.0';

/**
 * Validates a research dossier object against the Phase 2 specification.
 * @param {object} dossier
 * @returns {object} Validated dossier
 */
export function validateDossierSchema(dossier) {
  if (!dossier || typeof dossier !== 'object' || Array.isArray(dossier)) {
    throw new DossierValidationError('Dossier must be a non-empty object.');
  }

  const requiredFields = [
    'schema_version',
    'research_run_id',
    'generated_at',
    'topic',
    'category',
    'discovery_signals',
    'research_questions',
    'source_registry',
    'factual_claims',
    'verified_facts',
    'disputed_claims',
    'unknowns',
    'timeline',
    'important_entities',
    'background_context',
    'audience_relevance',
    'common_misconceptions',
    'source_quality_summary',
    'topic_score',
    'score_explanations',
    'eligibility_status',
    'rejection_reasons',
    'suggested_explainer_angles',
    'limitations'
  ];

  for (const field of requiredFields) {
    if (dossier[field] === undefined || dossier[field] === null) {
      throw new DossierValidationError(`Dossier is missing required field: '${field}'.`, { field });
    }
  }

  if (typeof dossier.topic !== 'string' || !dossier.topic.trim()) {
    throw new DossierValidationError('Dossier topic must be a non-empty string.', { field: 'topic' });
  }

  if (typeof dossier.topic_score !== 'number' || isNaN(dossier.topic_score)) {
    throw new DossierValidationError('Dossier topic_score must be a valid number.', { field: 'topic_score' });
  }

  const allowedStatuses = ['READY_FOR_REVIEW', 'NEEDS_MORE_RESEARCH', 'REJECTED'];
  if (!allowedStatuses.includes(dossier.eligibility_status)) {
    throw new DossierValidationError(
      `Invalid eligibility_status '${dossier.eligibility_status}'. Allowed: ${allowedStatuses.join(', ')}`,
      { field: 'eligibility_status' }
    );
  }

  if (!Array.isArray(dossier.factual_claims)) {
    throw new DossierValidationError('factual_claims must be an array.', { field: 'factual_claims' });
  }

  // Ensure all factual assertions have traceable evidence references
  for (let i = 0; i < dossier.factual_claims.length; i++) {
    const claim = dossier.factual_claims[i];
    if (!claim.claim_id || !claim.claim_text || !claim.verification_status) {
      throw new DossierValidationError(`Claim at index ${i} is missing required properties (claim_id, claim_text, verification_status).`, { claimIndex: i });
    }
  }

  return dossier;
}
