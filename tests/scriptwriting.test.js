/**
 * Automated Tests: Phase 3 Scriptwriting, Story Architecture, Gen-Z Humor, QA, and Evaluation Corpus.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabaseConnection, runMigrations, closeDatabase } from '../src/db/connection.js';
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
  ScriptValidationError,
  SCRIPT_APPROVAL_STATUS,
  QA_SEVERITY
} from '../src/scriptwriting/index.js';
import { DossierService } from '../src/research/dossiers/dossier-service.js';
import { ProjectService } from '../src/projects/project.service.js';
import { evaluationCorpus } from '../src/scriptwriting/fixtures/evaluation-corpus.js';

function getFreshDb() {
  const db = createDatabaseConnection(':memory:');
  runMigrations(db);
  return db;
}

test('1. StoryArchitect generates 7-chapter outline, word budgets, and title candidates', () => {
  const architect = new StoryArchitect({ targetDurationSeconds: 600, narrationWordsPerMinute: 145 });
  const outline = architect.createStoryArchitecture(evaluationCorpus.fixture1_strong_evidence);

  assert.equal(outline.topic, 'Voyager 1 Interstellar Mission');
  assert.equal(outline.target_words, 1450);
  assert.equal(outline.chapters.length, 7);
  assert.ok(outline.title_options.length >= 3);
  assert.ok(outline.central_question.includes('Voyager 1 Interstellar Mission'));

  const totalBudget = outline.chapters.reduce((acc, c) => acc + c.target_words, 0);
  assert.ok(totalBudget >= 1400 && totalBudget <= 1500, `Expected total words ~1450, got ${totalBudget}`);
});

test('2. StoryArchitect rejects ineligible dossier (NEEDS_MORE_RESEARCH or missing facts)', () => {
  const architect = new StoryArchitect();

  assert.throws(
    () => architect.createStoryArchitecture(evaluationCorpus.fixture3_missing_evidence),
    (err) => err instanceof DossierIneligibleError && err.code === 'DOSSIER_INELIGIBLE_ERROR'
  );

  assert.throws(
    () => architect.createStoryArchitecture(evaluationCorpus.fixture4_malformed_dossier),
    (err) => err instanceof DossierIneligibleError
  );
});

test('3. Scriptwriter drafts narration grounded in dossier claims with sentence-level citations', () => {
  const architect = new StoryArchitect({ targetDurationSeconds: 600, narrationWordsPerMinute: 145 });
  const writer = new Scriptwriter({ narrationWordsPerMinute: 145 });

  const outline = architect.createStoryArchitecture(evaluationCorpus.fixture1_strong_evidence);
  const draft = writer.draftScript(outline, evaluationCorpus.fixture1_strong_evidence);

  assert.equal(draft.chapters.length, 7);
  assert.ok(draft.spoken_word_count > 200);
  assert.ok(draft.estimated_duration_seconds > 0);
  assert.ok(draft.factual_claim_references.length > 0);

  // Check that every claim reference matches a claim from the dossier
  for (const ref of draft.factual_claim_references) {
    assert.ok(['claim-v1-01', 'claim-v1-02'].includes(ref.claim_id));
  }
});

test('4. HumorEditor injects Gen-Z voice, structured humor annotations, and visual punchlines', () => {
  const architect = new StoryArchitect();
  const writer = new Scriptwriter();
  const humor = new HumorEditor();

  const outline = architect.createStoryArchitecture(evaluationCorpus.fixture1_strong_evidence);
  const draft = writer.draftScript(outline, evaluationCorpus.fixture1_strong_evidence);
  const enhanced = humor.applyHumorAndMemes(draft, evaluationCorpus.fixture1_strong_evidence);

  assert.ok(enhanced.humor_annotations.length > 0);
  assert.ok(enhanced.meme_suggestions.length > 0);
  assert.ok(enhanced.visual_suggestions.length > 0);

  // Verify meme suggestion structure
  const meme = enhanced.meme_suggestions[0];
  assert.ok(meme.meme_id);
  assert.ok(meme.chapter_id);
  assert.ok(meme.suggested_format_or_reaction);
  assert.ok(meme.asset_rights_note);
});

test('5. Editorial QA verifies factual traceability and approves valid script', () => {
  const architect = new StoryArchitect();
  const writer = new Scriptwriter();
  const humor = new HumorEditor();
  const qa = new EditorialQa({ minimumDurationSeconds: 100, maximumDurationSeconds: 900 });

  const outline = architect.createStoryArchitecture(evaluationCorpus.fixture1_strong_evidence);
  const draft = writer.draftScript(outline, evaluationCorpus.fixture1_strong_evidence);
  const enhanced = humor.applyHumorAndMemes(draft, evaluationCorpus.fixture1_strong_evidence);

  const report = qa.evaluateScript(enhanced, evaluationCorpus.fixture1_strong_evidence);

  assert.equal(report.status, SCRIPT_APPROVAL_STATUS.APPROVED_FOR_REVIEW);
  assert.ok(report.score >= 80);
  assert.equal(report.critical_findings_count, 0);
});

test('6. Editorial QA detects broken claim IDs and blocks script (Critical Severity)', () => {
  const qa = new EditorialQa();
  const badScript = {
    chapters: [
      {
        chapter_id: 'ch-01',
        heading: 'Broken Fact Test',
        narration: 'A completely unverified claim.',
        referenced_claim_ids: ['claim-does-not-exist-999']
      }
    ],
    full_narration: 'A completely unverified claim.',
    estimated_duration_seconds: 550
  };

  const report = qa.evaluateScript(badScript, evaluationCorpus.fixture1_strong_evidence);

  assert.equal(report.status, SCRIPT_APPROVAL_STATUS.BLOCKED);
  assert.ok(report.critical_findings_count > 0);
  assert.ok(report.findings.some((f) => f.category === 'broken_claim_reference'));
});

test('7. Editorial QA detects unsupported direct quotations and blocks script', () => {
  const qa = new EditorialQa();
  const quoteScript = {
    chapters: [
      {
        chapter_id: 'ch-01',
        heading: 'Fake Quote',
        narration: 'NASA Director secretly declared "The aliens have officially made contact with our satellite instruments" in 2024.',
        referenced_claim_ids: ['claim-v1-01']
      }
    ],
    full_narration: 'NASA Director secretly declared "The aliens have officially made contact with our satellite instruments" in 2024.',
    estimated_duration_seconds: 550
  };

  const report = qa.evaluateScript(quoteScript, evaluationCorpus.fixture1_strong_evidence);

  assert.equal(report.status, SCRIPT_APPROVAL_STATUS.BLOCKED);
  assert.ok(report.findings.some((f) => f.category === 'unsupported_direct_quote'));
});

test('8. End-to-End ScriptService generates, validates, persists, and audits script package', () => {
  const db = getFreshDb();
  const projectService = new ProjectService(db);
  const dossierService = new DossierService(db);
  const scriptService = new ScriptService(db, { minimumDurationSeconds: 100, maximumDurationSeconds: 900 });

  const project = projectService.createProject({
    title: 'Voyager Interstellar Mission',
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

  // Verify retrieval
  const retrieved = scriptService.getScriptByProjectId(project.id);
  assert.ok(retrieved);
  assert.equal(retrieved.topic, 'Voyager 1 Interstellar Mission');
  assert.equal(retrieved.scriptPackage.chapters.length, 7);

  // Verify revision audit trail
  const revisions = scriptService.listScriptRevisions(project.id);
  assert.equal(revisions.length, 1);
  assert.equal(revisions[0].qa_outcome, SCRIPT_APPROVAL_STATUS.APPROVED_FOR_REVIEW);

  closeDatabase(db);
});

// --- Evaluation Corpus Fixture Tests (16 Scenarios) ---

test('Fixture 1: Strong factual evidence produces approved grounded script package', () => {
  const db = getFreshDb();
  const projectService = new ProjectService(db);
  const scriptService = new ScriptService(db, { minimumDurationSeconds: 100, maximumDurationSeconds: 900 });

  const project = projectService.createProject({
    title: evaluationCorpus.fixture1_strong_evidence.topic,
    topic: evaluationCorpus.fixture1_strong_evidence.topic
  });

  const result = scriptService.generateScript({
    dossier: { ...evaluationCorpus.fixture1_strong_evidence, project_id: project.id },
    projectId: project.id
  });

  assert.equal(result.script.approval_status, SCRIPT_APPROVAL_STATUS.APPROVED_FOR_REVIEW);
  assert.ok(result.script.spoken_word_count > 0);
  closeDatabase(db);
});

test('Fixture 2: Disputed claims preserve uncertainty without stating rumors as facts', () => {
  const db = getFreshDb();
  const projectService = new ProjectService(db);
  const scriptService = new ScriptService(db, { minimumDurationSeconds: 100, maximumDurationSeconds: 900 });

  const project = projectService.createProject({
    title: evaluationCorpus.fixture2_disputed_claims.topic,
    topic: evaluationCorpus.fixture2_disputed_claims.topic
  });

  const result = scriptService.generateScript({
    dossier: { ...evaluationCorpus.fixture2_disputed_claims, project_id: project.id },
    projectId: project.id
  });

  assert.equal(result.script.approval_status, SCRIPT_APPROVAL_STATUS.APPROVED_FOR_REVIEW);
  assert.ok(result.script.full_narration.includes('disputed and unverified'));
  closeDatabase(db);
});

test('Fixture 3: Missing evidence dossier rejected with DossierIneligibleError', () => {
  const db = getFreshDb();
  const scriptService = new ScriptService(db);

  assert.throws(
    () => scriptService.generateScript({ dossier: evaluationCorpus.fixture3_missing_evidence }),
    (err) => err instanceof DossierIneligibleError
  );
  closeDatabase(db);
});

test('Fixture 4: Malformed dossier rejected by validator', () => {
  const db = getFreshDb();
  const scriptService = new ScriptService(db);

  assert.throws(
    () => scriptService.generateScript({ dossier: evaluationCorpus.fixture4_malformed_dossier }),
    (err) => err instanceof DossierIneligibleError
  );
  closeDatabase(db);
});

test('Fixture 5: Script with runtime far below target triggers QA major finding', () => {
  const qa = new EditorialQa({ minimumDurationSeconds: 480 });
  const shortScript = {
    chapters: [{ chapter_id: 'ch-01', heading: 'Short', narration: 'Very short text.', referenced_claim_ids: ['claim-v1-01'] }],
    full_narration: 'Very short text.',
    estimated_duration_seconds: 30
  };

  const report = qa.evaluateScript(shortScript, evaluationCorpus.fixture1_strong_evidence);
  assert.ok(report.findings.some((f) => f.category === 'runtime_too_short'));
  assert.equal(report.status, SCRIPT_APPROVAL_STATUS.NEEDS_REVISION);
});

test('Fixture 6: Script with excessive filler repetition triggers minor QA finding', () => {
  const qa = new EditorialQa({ minimumDurationSeconds: 100, maximumDurationSeconds: 900 });
  const repetitiveText = 'literally '.repeat(15) + 'Voyager 1 launched in 1977.';
  const repScript = {
    chapters: [{ chapter_id: 'ch-01', heading: 'Rep', narration: repetitiveText, referenced_claim_ids: ['claim-v1-01'] }],
    full_narration: repetitiveText,
    estimated_duration_seconds: 500
  };

  const report = qa.evaluateScript(repScript, evaluationCorpus.fixture1_strong_evidence);
  assert.ok(report.findings.some((f) => f.category === 'excessive_filler_repetition'));
});

test('Fixture 7: Script with extreme unnatural slang triggers major QA finding', () => {
  const qa = new EditorialQa({ minimumDurationSeconds: 100, maximumDurationSeconds: 900 });
  const slangText = 'NASA had the ultimate skibidi rizzler sigma grindset when Voyager 1 launched in 1977.';
  const slangScript = {
    chapters: [{ chapter_id: 'ch-01', heading: 'Slang', narration: slangText, referenced_claim_ids: ['claim-v1-01'] }],
    full_narration: slangText,
    estimated_duration_seconds: 500
  };

  const report = qa.evaluateScript(slangScript, evaluationCorpus.fixture1_strong_evidence);
  assert.ok(report.findings.some((f) => f.category === 'inappropriate_slang_overload'));
});

test('Fixture 8: Script schema validation rejects missing required properties', () => {
  assert.throws(
    () => validateScriptSchema({ topic: 'Incomplete' }),
    (err) => err instanceof ScriptValidationError
  );
});
