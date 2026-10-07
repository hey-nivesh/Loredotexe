/**
 * Script Service: Master orchestrator for Phase 3 Scriptwriting Pipeline.
 * Coordinates StoryArchitect, Scriptwriter, HumorEditor, and EditorialQa.
 */

import { createHash, randomUUID } from 'node:crypto';
import { StoryArchitect } from '../agents/story-architect.js';
import { Scriptwriter } from '../agents/scriptwriter.js';
import { HumorEditor } from '../agents/humor-editor.js';
import { EditorialQa } from '../agents/editorial-qa.js';
import { ScriptRepository } from './script-repository.js';
import { SCRIPT_SCHEMA_VERSION, validateScriptSchema } from '../schema/script-schema.js';
import { DEFAULT_SCRIPT_CONFIG, SCRIPT_APPROVAL_STATUS } from '../config/tone-config.js';
import { logger } from '../../logging/logger.js';

export class ScriptService {
  /**
   * @param {import('node:sqlite').DatabaseSync} db
   * @param {object} [config={}]
   */
  constructor(db, config = {}) {
    this.db = db;
    this.config = { ...DEFAULT_SCRIPT_CONFIG, ...config };
    this.storyArchitect = new StoryArchitect(this.config);
    this.scriptwriter = new Scriptwriter(this.config);
    this.humorEditor = new HumorEditor(this.config);
    this.editorialQa = new EditorialQa(this.config);
    this.scriptRepo = new ScriptRepository(db);
  }

  /**
   * Generates a complete, validated YouTube narration script package from a Phase 2 research dossier.
   * @param {object} params
   * @param {object} params.dossier Validated Phase 2 Research Dossier
   * @param {string} [params.projectId]
   * @param {number} [params.scriptVersion=1]
   * @param {number} [params.maxRevisions=2]
   * @param {string|null} [params.revisionReason=null]
   * @returns {object} Final validated Script Package
   */
  generateScript({
    dossier,
    projectId = null,
    scriptVersion = 1,
    maxRevisions = 2,
    revisionReason = null
  }) {
    const finalProjectId = projectId || dossier.project_id || randomUUID();
    const researchRunId = dossier.research_run_id || randomUUID();
    const topic = dossier.topic || 'Untitled Topic';

    logger.info('Starting Phase 3 script generation pipeline', {
      projectId: finalProjectId,
      topic,
      scriptVersion
    });

    // 1. Agent A: Story Architect Outline
    const outline = this.storyArchitect.createStoryArchitecture(dossier);

    let currentDraft = null;
    let humorEnhanced = null;
    let qaReport = null;
    let attempt = 1;

    while (attempt <= maxRevisions) {
      // 2. Agent B: Scriptwriter Draft
      currentDraft = this.scriptwriter.draftScript(outline, dossier);

      // 3. Agent C: Humor and Meme Editor
      humorEnhanced = this.humorEditor.applyHumorAndMemes(currentDraft, dossier);

      // 4. Agent D: Editorial QA
      qaReport = this.editorialQa.evaluateScript(humorEnhanced, dossier);

      logger.info('Completed Editorial QA pass', {
        attempt,
        qaScore: qaReport.score,
        approvalStatus: qaReport.status,
        criticalFindings: qaReport.critical_findings_count
      });

      if (qaReport.status === SCRIPT_APPROVAL_STATUS.APPROVED_FOR_REVIEW || qaReport.status === SCRIPT_APPROVAL_STATUS.BLOCKED) {
        break;
      }

      attempt++;
    }

    const scriptId = randomUUID();
    const now = new Date().toISOString();

    // Compute content hash for immutable tracking
    const contentHash = createHash('sha256')
      .update(humorEnhanced.full_narration + JSON.stringify(humorEnhanced.factual_claim_references))
      .digest('hex');

    const scriptPackage = {
      schema_version: SCRIPT_SCHEMA_VERSION,
      id: scriptId,
      project_id: finalProjectId,
      research_run_id: researchRunId,
      script_version: scriptVersion,
      topic,
      title_options: outline.title_options,
      central_question: outline.central_question,
      audience_profile: this.config.audienceLevel,
      target_duration_seconds: this.config.targetDurationSeconds,
      estimated_duration_seconds: humorEnhanced.estimated_duration_seconds,
      spoken_word_count: humorEnhanced.spoken_word_count,
      narration_wpm: this.config.narrationWordsPerMinute,
      outline: outline.chapters.map((c) => ({
        chapter_id: c.chapter_id,
        heading: c.heading,
        purpose: c.purpose,
        target_words: c.target_words
      })),
      chapters: humorEnhanced.chapters,
      full_narration: humorEnhanced.full_narration,
      factual_claim_references: humorEnhanced.factual_claim_references,
      humor_annotations: humorEnhanced.humor_annotations,
      meme_suggestions: humorEnhanced.meme_suggestions,
      visual_suggestions: humorEnhanced.visual_suggestions,
      unresolved_questions: (dossier.unknowns || []).map((u) => u.unverified_assertion),
      qa_report: qaReport,
      approval_status: qaReport.status,
      created_at: now,
      content_hash: contentHash
    };

    // 5. Schema Validation
    const validated = validateScriptSchema(scriptPackage);

    // 6. Persistence in SQLite
    const savedRecord = this.scriptRepo.saveScript(validated);

    // 7. Record Revision in Audit Trail
    this.scriptRepo.recordRevision({
      scriptId,
      projectId: finalProjectId,
      version: scriptVersion,
      attempt,
      qaOutcome: qaReport.status,
      revisionReason,
      scriptJson: validated,
      contentHash
    });

    logger.info('Script package saved and audited successfully', {
      scriptId,
      projectId: finalProjectId,
      version: scriptVersion,
      approvalStatus: validated.approval_status,
      wordCount: validated.spoken_word_count,
      duration: validated.estimated_duration_seconds
    });

    return {
      script: validated,
      savedRecord
    };
  }

  /**
   * Retrieves active script for a project.
   * @param {string} projectId
   */
  getScriptByProjectId(projectId) {
    return this.scriptRepo.findLatestByProjectId(projectId);
  }

  /**
   * Lists script revisions for a project.
   * @param {string} projectId
   */
  listScriptRevisions(projectId) {
    return this.scriptRepo.listRevisionsByProjectId(projectId);
  }
}
