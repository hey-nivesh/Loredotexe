/**
 * Phase 3 Scriptwriting Module Entry Point.
 */

export { StoryArchitect } from './agents/story-architect.js';
export { Scriptwriter } from './agents/scriptwriter.js';
export { HumorEditor } from './agents/humor-editor.js';
export { EditorialQa } from './agents/editorial-qa.js';
export { ScriptService } from './services/script-service.js';
export { ScriptRepository } from './services/script-repository.js';
export { validateScriptSchema, SCRIPT_SCHEMA_VERSION } from './schema/script-schema.js';
export {
  DEFAULT_SCRIPT_CONFIG,
  HUMOR_TYPES,
  SCRIPT_APPROVAL_STATUS,
  QA_SEVERITY,
  countSpokenWords,
  estimateDurationSeconds
} from './config/tone-config.js';
export * from './errors/script-errors.js';
