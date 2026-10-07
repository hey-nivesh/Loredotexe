#!/usr/bin/env node
/**
 * Verification Script for Loredotexe Phase 1 Requirements.
 */

import assert from 'node:assert/strict';
import { createDatabaseConnection, runMigrations, closeDatabase } from '../src/db/connection.js';
import { ProjectService } from '../src/projects/project.service.js';
import { ExecutionService } from '../src/executions/execution.service.js';
import { PROJECT_STATUS } from '../src/projects/project.schema.js';
import {
  ValidationError,
  InvalidStateTransitionError,
  VersionConflictError,
  IdempotencyConflictError
} from '../src/errors/app-errors.js';

console.log('===============================================================');
console.log('         Loredotexe — Phase 1 Verification Suite              ');
console.log('===============================================================');
console.log('');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runCheck(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(` [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(` [FAIL] ${name}`);
    console.error(`        Error: ${err.message}`);
    failedTests++;
  }
}

const db = createDatabaseConnection(':memory:');
runMigrations(db);

const projectService = new ProjectService(db);
const executionService = new ExecutionService(db);

console.log('--- 1. Project Creation & Validation ---');

runCheck('Valid project creation succeeds with default channel', () => {
  const project = projectService.createProject({
    title: 'The Fall of Reach: Full Story',
    topic: 'Halo Reach lore breakdown'
  });
  assert.ok(project.id, 'Project should have an ID');
  assert.equal(project.status, PROJECT_STATUS.CREATED);
  assert.equal(project.channelName, 'The 10min Explosion');
  assert.equal(project.version, 1);
});

runCheck('Missing title throws ValidationError', () => {
  assert.throws(
    () => projectService.createProject({ topic: 'Valid topic' }),
    ValidationError
  );
});

runCheck('Missing topic throws ValidationError', () => {
  assert.throws(
    () => projectService.createProject({ title: 'Valid title' }),
    ValidationError
  );
});

runCheck('Invalid UUID retrieval throws ValidationError', () => {
  assert.throws(
    () => projectService.getProject('invalid-not-a-uuid'),
    ValidationError
  );
});

console.log('\n--- 2. Idempotency & Deduplication ---');

runCheck('Duplicate project creation with same key returns identical project', () => {
  const key = 'halo-reach-part-1';
  const p1 = projectService.createProject(
    { title: 'Halo Reach Part 1', topic: 'Noble Team sacrifice' },
    key
  );
  const p2 = projectService.createProject(
    { title: 'Halo Reach Part 1', topic: 'Noble Team sacrifice' },
    key
  );
  assert.equal(p1.id, p2.id, 'Project IDs must match on idempotent replay');
});

runCheck('Conflicting payload with reused idempotency key throws IdempotencyConflictError', () => {
  const key = 'unique-key-123';
  projectService.createProject({ title: 'Topic A', topic: 'Topic A info' }, key);

  assert.throws(
    () => projectService.createProject({ title: 'Topic B - Conflict', topic: 'Topic B info' }, key),
    IdempotencyConflictError
  );
});

console.log('\n--- 3. State Transitions & Lifecycle ---');

runCheck('Valid transition path (CREATED -> PLANNING -> PLANNED) succeeds', () => {
  const project = projectService.createProject({
    title: 'Cybertron Wars',
    topic: 'Transformers lore'
  });

  const pPlanning = projectService.transitionProject(project.id, PROJECT_STATUS.PLANNING);
  assert.equal(pPlanning.status, PROJECT_STATUS.PLANNING);
  assert.equal(pPlanning.version, 2);
  assert.ok(pPlanning.startedAt, 'startedAt should be populated');

  const pPlanned = projectService.transitionProject(project.id, PROJECT_STATUS.PLANNED);
  assert.equal(pPlanned.status, PROJECT_STATUS.PLANNED);
  assert.equal(pPlanned.version, 3);
});

runCheck('Illegal transition (CREATED -> PUBLISHED) throws InvalidStateTransitionError', () => {
  const project = projectService.createProject({
    title: 'Illegal Transition Test',
    topic: 'Testing state machine guard'
  });

  assert.throws(
    () => projectService.transitionProject(project.id, PROJECT_STATUS.PUBLISHED),
    InvalidStateTransitionError
  );
});

runCheck('Stale version transition throws VersionConflictError (Optimistic Concurrency)', () => {
  const project = projectService.createProject({
    title: 'Concurrency Test',
    topic: 'Testing version locking'
  });

  // Project is version 1. Transition with expectedVersion = 99
  assert.throws(
    () => projectService.transitionProject(project.id, PROJECT_STATUS.PLANNING, 99),
    VersionConflictError
  );
});

console.log('\n--- 4. Execution Tracking & Operations ---');

let testExecutionId;
let testProjectId;

runCheck('Execution start creates tracked running record', () => {
  const project = projectService.createProject({
    title: 'Execution Trace Project',
    topic: 'Tracking test'
  });
  testProjectId = project.id;

  const execution = executionService.startExecution({
    projectId: project.id,
    operation: 'generate_script',
    attemptNumber: 1,
    idempotencyKey: 'exec-script-1'
  });

  testExecutionId = execution.id;
  assert.equal(execution.status, 'running');
  assert.equal(execution.operation, 'generate_script');
});

runCheck('Execution complete updates record with result', () => {
  const completed = executionService.completeExecution(testExecutionId, {
    wordCount: 1500,
    scenes: 12
  });
  assert.equal(completed.status, 'succeeded');
  assert.ok(completed.finishedAt);
  assert.equal(completed.result.wordCount, 1500);
});

runCheck('Execution fail records sanitized error code and message', () => {
  const exec2 = executionService.startExecution({
    projectId: testProjectId,
    operation: 'tts_synthesis',
    attemptNumber: 1,
    idempotencyKey: 'exec-tts-1'
  });

  const failed = executionService.failExecution(
    exec2.id,
    new ValidationError('Voice synthesis parameter error', { voice: 'invalid' })
  );

  assert.equal(failed.status, 'failed');
  assert.equal(failed.errorCode, 'VALIDATION_ERROR');
  assert.equal(failed.errorMessage, 'Voice synthesis parameter error');
});

console.log('\n--- 5. Foreign Key Integrity ---');

runCheck('SQLite foreign key enforcement prevents execution with non-existent project', () => {
  assert.throws(() => {
    executionService.startExecution({
      projectId: '00000000-0000-0000-0000-000000000000',
      operation: 'orphan_op'
    });
  });
});

console.log('\n===============================================================');
console.log(` Results: ${passedTests}/${totalTests} checks passed.`);
if (failedTests === 0) {
  console.log(' Phase 1 Verification: ALL CHECKS PASSED');
  console.log('===============================================================\n');
  closeDatabase(db);
  process.exit(0);
} else {
  console.error(` Phase 1 Verification: FAILED (${failedTests} failures)`);
  console.log('===============================================================\n');
  closeDatabase(db);
  process.exit(1);
}
