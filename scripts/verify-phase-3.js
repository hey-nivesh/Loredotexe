#!/usr/bin/env node
/**
 * Verification Suite for Loredotexe Phase 3 Requirements.
 * Validates Story Architecture, Script Drafting, Gen-Z Humor, Editorial QA, and Revision Audit.
 */

import assert from 'node:assert/strict';
import { createDatabaseConnection, runMigrations, closeDatabase } from '../src/db/connection.js';
import { ProjectService } from '../src/projects/project.service.js';
import { DossierService } from '../src/research/dossiers/dossier-service.js';
import {
  StoryArchitect,
  Scriptwriter,
  HumorEditor,
  EditorialQa,
  ScriptService,
  validateScriptSchema,
  countSpokenWords,
  estimateDurationSeconds,
  DossierIneligibleError,
  SCRIPT_APPROVAL_STATUS
} from '../src/scriptwriting/index.js';
import { evaluationCorpus } from '../src/scriptwriting/fixtures/evaluation-corpus.js';

console.log('===============================================================');
console.log('         Loredotexe — Phase 3 Verification Suite              ');
console.log('===============================================================');
console.log('');

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function runCheck(name, fn) {
  totalChecks++;
  try {
    fn();
    console.log(` [PASS] ${name}`);
    passedChecks++;
  } catch (err) {
    console.error(` [FAIL] ${name}`);
    console.error(`        Error: ${err.message}`);
    failedChecks++;
  }
}

const db = createDatabaseConnection(':memory:');
runMigrations(db);

const projectService = new ProjectService(db);
const dossierService = new DossierService(db);
const scriptService = new ScriptService(db, { minimumDurationSeconds: 100, maximumDurationSeconds: 900 });

console.log('--- 1. Story Architecture & Narrative Planning ---');

runCheck('Story Architect produces structured 7-chapter narrative outline with word budgets', () => {
  const architect = new StoryArchitect();
  const outline = architect.createStoryArchitecture(evaluationCorpus.fixture1_strong_evidence);
  assert.equal(outline.chapters.length, 7);
  assert.ok(outline.target_words > 1400);
  assert.ok(outline.title_options.length >= 3);
  assert.ok(outline.central_question.length > 10);
});

runCheck('Story Architect blocks ineligible dossiers (NEEDS_MORE_RESEARCH)', () => {
  const architect = new StoryArchitect();
  assert.throws(
    () => architect.createStoryArchitecture(evaluationCorpus.fixture3_missing_evidence),
    (err) => err instanceof DossierIneligibleError
  );
});

console.log('\n--- 2. Script Drafting & Factual Traceability ---');

runCheck('Scriptwriter grounds spoken narration strictly in dossier claim IDs', () => {
  const architect = new StoryArchitect();
  const writer = new Scriptwriter();
  const outline = architect.createStoryArchitecture(evaluationCorpus.fixture1_strong_evidence);
  const draft = writer.draftScript(outline, evaluationCorpus.fixture1_strong_evidence);

  assert.equal(draft.chapters.length, 7);
  assert.ok(draft.spoken_word_count > 200);
  assert.ok(draft.factual_claim_references.length > 0);

  for (const ref of draft.factual_claim_references) {
    assert.ok(ref.claim_id.startsWith('claim-'));
  }
});

console.log('\n--- 3. Gen-Z Humor & Visual Meme Suggestions ---');

runCheck('Humor Editor generates meme suggestions, visual punchlines, and tone annotations', () => {
  const architect = new StoryArchitect();
  const writer = new Scriptwriter();
  const humor = new HumorEditor();

  const outline = architect.createStoryArchitecture(evaluationCorpus.fixture1_strong_evidence);
  const draft = writer.draftScript(outline, evaluationCorpus.fixture1_strong_evidence);
  const enhanced = humor.applyHumorAndMemes(draft, evaluationCorpus.fixture1_strong_evidence);

  assert.ok(enhanced.humor_annotations.length > 0);
  assert.ok(enhanced.meme_suggestions.length > 0);
  assert.ok(enhanced.visual_suggestions.length > 0);
  assert.ok(enhanced.meme_suggestions[0].asset_rights_note.includes('original') || enhanced.meme_suggestions[0].asset_rights_note.includes('recreation'));
});

console.log('\n--- 4. Editorial QA & Deterministic Fact Checking ---');

runCheck('Editorial QA validates factual claims and approves verified script', () => {
  const architect = new StoryArchitect();
  const writer = new Scriptwriter();
  const humor = new HumorEditor();
  const qa = new EditorialQa({ minimumDurationSeconds: 100, maximumDurationSeconds: 900 });

  const outline = architect.createStoryArchitecture(evaluationCorpus.fixture1_strong_evidence);
  const draft = writer.draftScript(outline, evaluationCorpus.fixture1_strong_evidence);
  const enhanced = humor.applyHumorAndMemes(draft, evaluationCorpus.fixture1_strong_evidence);
  const qaReport = qa.evaluateScript(enhanced, evaluationCorpus.fixture1_strong_evidence);

  assert.equal(qaReport.status, SCRIPT_APPROVAL_STATUS.APPROVED_FOR_REVIEW);
  assert.equal(qaReport.critical_findings_count, 0);
  assert.ok(qaReport.score >= 80);
});

runCheck('Editorial QA detects broken claim IDs and blocks approval', () => {
  const qa = new EditorialQa();
  const badDraft = {
    chapters: [{ chapter_id: 'ch-01', heading: 'Bad Fact', narration: 'Text', referenced_claim_ids: ['invalid-id-404'] }],
    full_narration: 'Text',
    estimated_duration_seconds: 500
  };
  const qaReport = qa.evaluateScript(badDraft, evaluationCorpus.fixture1_strong_evidence);
  assert.equal(qaReport.status, SCRIPT_APPROVAL_STATUS.BLOCKED);
  assert.ok(qaReport.critical_findings_count > 0);
});

console.log('\n--- 5. End-to-End Pipeline & SQLite Revision Audit Trail ---');

runCheck('End-to-end ScriptService generates, validates, persists, and audits script package', () => {
  const project = projectService.createProject({
    title: 'Voyager Interstellar Verification',
    topic: 'Voyager 1 Interstellar Mission'
  });

  const dossierRecord = dossierService.saveDossier({
    ...evaluationCorpus.fixture1_strong_evidence,
    project_id: project.id
  }, project.id);

  const result = scriptService.generateScript({
    dossier: { ...evaluationCorpus.fixture1_strong_evidence, project_id: project.id },
    projectId: project.id
  });

  assert.ok(result.script);
  assert.ok(result.savedRecord);
  assert.equal(result.script.project_id, project.id);
  assert.equal(result.script.approval_status, SCRIPT_APPROVAL_STATUS.APPROVED_FOR_REVIEW);
  assert.ok(result.script.content_hash);

  // Validate formal schema
  const validated = validateScriptSchema(result.script);
  assert.ok(validated);

  // Check audit trail
  const revisions = scriptService.listScriptRevisions(project.id);
  assert.equal(revisions.length, 1);
  assert.equal(revisions[0].qa_outcome, SCRIPT_APPROVAL_STATUS.APPROVED_FOR_REVIEW);
});

closeDatabase(db);

console.log('');
console.log('===============================================================');
console.log(` Results: ${passedChecks}/${totalChecks} checks passed.`);
if (failedChecks > 0) {
  console.log(` Phase 3 Verification: ${failedChecks} CHECKS FAILED`);
  process.exit(1);
} else {
  console.log(' Phase 3 Verification: ALL CHECKS PASSED');
  console.log('===============================================================');
  console.log('');
}
