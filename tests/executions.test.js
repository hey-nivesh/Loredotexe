/**
 * Automated Tests: Execution Tracking, Error Handling, and Foreign Key Integrity.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabaseConnection, runMigrations, closeDatabase } from '../src/db/connection.js';
import { ProjectService } from '../src/projects/project.service.js';
import { ExecutionService } from '../src/executions/execution.service.js';
import { ValidationError, DatabaseError, AppError } from '../src/errors/app-errors.js';

function getFreshDb() {
  const db = createDatabaseConnection(':memory:');
  runMigrations(db);
  return db;
}

test('1. Execution lifecycle tracking (start, complete, fail)', () => {
  const db = getFreshDb();
  const projectService = new ProjectService(db);
  const executionService = new ExecutionService(db);

  const project = projectService.createProject({
    title: 'Execution Tracking Test',
    topic: 'Testing operations'
  });

  // Start execution
  const execution = executionService.startExecution({
    projectId: project.id,
    operation: 'generate_script_scenes',
    attemptNumber: 1,
    idempotencyKey: 'op-scenes-001'
  });

  assert.ok(execution.id);
  assert.equal(execution.projectId, project.id);
  assert.equal(execution.status, 'running');
  assert.equal(execution.operation, 'generate_script_scenes');

  // Complete execution
  const completed = executionService.completeExecution(execution.id, {
    sceneCount: 8,
    estimatedDurationSeconds: 600
  });

  assert.equal(completed.status, 'succeeded');
  assert.ok(completed.finishedAt);
  assert.equal(completed.result.sceneCount, 8);

  // Check project executions
  const history = projectService.getProjectExecutions(project.id);
  assert.ok(history.length >= 1);
  assert.equal(history[0].id, execution.id);

  closeDatabase(db);
});

test('2. Execution failure recording with sanitized errors', () => {
  const db = getFreshDb();
  const projectService = new ProjectService(db);
  const executionService = new ExecutionService(db);

  const project = projectService.createProject({
    title: 'Failure Test',
    topic: 'Testing failure handling'
  });

  const exec = executionService.startExecution({
    projectId: project.id,
    operation: 'render_video'
  });

  const appErr = new ValidationError('Invalid video frame rate: -1', { fps: -1 });
  const failed = executionService.failExecution(exec.id, appErr);

  assert.equal(failed.status, 'failed');
  assert.equal(failed.errorCode, 'VALIDATION_ERROR');
  assert.equal(failed.errorMessage, 'Invalid video frame rate: -1');

  closeDatabase(db);
});

test('3. Database foreign key enforcement prevents orphaned executions', () => {
  const db = getFreshDb();
  const executionService = new ExecutionService(db);

  assert.throws(
    () => {
      executionService.startExecution({
        projectId: '11111111-2222-3333-4444-555555555555',
        operation: 'orphan_operation'
      });
    },
    (err) => err instanceof DatabaseError
  );

  closeDatabase(db);
});

test('4. Retry classification: Transient vs Permanent errors', () => {
  const db = getFreshDb();
  const executionService = new ExecutionService(db);

  // Permanent validation / logic errors must NOT be retryable
  const validationError = new ValidationError('Bad title');
  assert.equal(executionService.isRetryable(validationError), false);

  const logicError = new AppError('State machine blocked', 'INVALID_STATE', 409, false);
  assert.equal(executionService.isRetryable(logicError), false);

  // Transient database locks or network timeouts MUST be classified as retryable
  const transientDbError = new DatabaseError('database is locked', true);
  assert.equal(executionService.isRetryable(transientDbError), true);

  const networkTimeoutError = new Error('connect ECONNREFUSED 127.0.0.1:5678');
  assert.equal(executionService.isRetryable(networkTimeoutError), true);

  closeDatabase(db);
});
