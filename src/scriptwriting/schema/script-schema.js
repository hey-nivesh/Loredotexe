/**
 * Script Package JSON Schema Validator and Serializer.
 */

import { ScriptValidationError } from '../errors/script-errors.js';
import { SCRIPT_APPROVAL_STATUS } from '../config/tone-config.js';

export const SCRIPT_SCHEMA_VERSION = '1.0.0';

/**
 * Validates a script package object against the Phase 3 specification.
 * @param {object} scriptPackage
 * @returns {object} Validated script package
 */
export function validateScriptSchema(scriptPackage) {
  if (!scriptPackage || typeof scriptPackage !== 'object' || Array.isArray(scriptPackage)) {
    throw new ScriptValidationError('Script package must be a non-empty JSON object.');
  }

  const requiredFields = [
    'schema_version',
    'project_id',
    'research_run_id',
    'script_version',
    'topic',
    'title_options',
    'central_question',
    'audience_profile',
    'target_duration_seconds',
    'estimated_duration_seconds',
    'spoken_word_count',
    'outline',
    'chapters',
    'full_narration',
    'factual_claim_references',
    'humor_annotations',
    'meme_suggestions',
    'visual_suggestions',
    'unresolved_questions',
    'qa_report',
    'approval_status',
    'created_at',
    'content_hash'
  ];

  for (const field of requiredFields) {
    if (scriptPackage[field] === undefined || scriptPackage[field] === null) {
      throw new ScriptValidationError(`Script package is missing required field: '${field}'.`, { field });
    }
  }

  if (typeof scriptPackage.topic !== 'string' || !scriptPackage.topic.trim()) {
    throw new ScriptValidationError('Script topic must be a non-empty string.', { field: 'topic' });
  }

  if (!Array.isArray(scriptPackage.title_options) || scriptPackage.title_options.length === 0) {
    throw new ScriptValidationError('title_options must be a non-empty array of candidate titles.', { field: 'title_options' });
  }

  if (!Array.isArray(scriptPackage.chapters) || scriptPackage.chapters.length === 0) {
    throw new ScriptValidationError('chapters must be a non-empty array of chapter objects.', { field: 'chapters' });
  }

  // Validate each chapter
  for (let i = 0; i < scriptPackage.chapters.length; i++) {
    const ch = scriptPackage.chapters[i];
    if (!ch || typeof ch !== 'object') {
      throw new ScriptValidationError(`Chapter at index ${i} is invalid.`, { chapterIndex: i });
    }
    const chapterFields = [
      'chapter_id',
      'heading',
      'purpose',
      'narration',
      'spoken_word_count',
      'estimated_duration_seconds',
      'referenced_claim_ids'
    ];
    for (const cf of chapterFields) {
      if (ch[cf] === undefined || ch[cf] === null) {
        throw new ScriptValidationError(`Chapter '${ch.chapter_id || i}' is missing required field '${cf}'.`, {
          chapterIndex: i,
          field: cf
        });
      }
    }
    if (!Array.isArray(ch.referenced_claim_ids)) {
      throw new ScriptValidationError(`Chapter '${ch.chapter_id}' referenced_claim_ids must be an array.`, {
        chapterId: ch.chapter_id
      });
    }
  }

  // Validate humor annotations
  if (!Array.isArray(scriptPackage.humor_annotations)) {
    throw new ScriptValidationError('humor_annotations must be an array.', { field: 'humor_annotations' });
  }
  for (let i = 0; i < scriptPackage.humor_annotations.length; i++) {
    const h = scriptPackage.humor_annotations[i];
    if (!h.annotation_id || !h.chapter_id || !h.humor_type) {
      throw new ScriptValidationError(`Humor annotation at index ${i} is missing annotation_id, chapter_id, or humor_type.`, { index: i });
    }
  }

  // Validate meme suggestions
  if (!Array.isArray(scriptPackage.meme_suggestions)) {
    throw new ScriptValidationError('meme_suggestions must be an array.', { field: 'meme_suggestions' });
  }
  for (let i = 0; i < scriptPackage.meme_suggestions.length; i++) {
    const m = scriptPackage.meme_suggestions[i];
    if (!m.meme_id || !m.chapter_id || !m.suggested_format_or_reaction) {
      throw new ScriptValidationError(`Meme suggestion at index ${i} is missing meme_id, chapter_id, or suggested_format_or_reaction.`, { index: i });
    }
  }

  // Validate QA report
  const qa = scriptPackage.qa_report;
  if (!qa || typeof qa !== 'object' || !Array.isArray(qa.findings) || typeof qa.score !== 'number') {
    throw new ScriptValidationError('qa_report must be an object with score number and findings array.', { field: 'qa_report' });
  }

  // Validate approval status
  if (!Object.values(SCRIPT_APPROVAL_STATUS).includes(scriptPackage.approval_status)) {
    throw new ScriptValidationError(`Invalid approval_status '${scriptPackage.approval_status}'. Allowed: ${Object.values(SCRIPT_APPROVAL_STATUS).join(', ')}`, {
      field: 'approval_status'
    });
  }

  return scriptPackage;
}
