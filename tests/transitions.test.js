/**
 * Automated Tests: Project Lifecycle Transitions and State Machine Integrity.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabaseConnection, runMigrations, closeDatabase } from '../src/db/connection.js';
import { ProjectService } from '../src/projects/project.service.js';
import { PROJECT_STATUS } from '../src/projects/project.schema.js';
import {
  InvalidStateTransitionError,
  VersionConflictError
} from '../src/errors/app-errors.js';

function getFreshDb() {
  const db = createDatabaseConnection(':memory:');
  runMigrations(db);
  return db;
}

test('1. Full linear production lifecycle transition from CREATED to PUBLISHED', () => {
  const db = getFreshDb();
  const service = new ProjectService(db);

  let project = service.createProject({
    title: 'The complete timeline of Sauron',
    topic: 'Middle Earth lore'
  });
  assert.equal(project.status, PROJECT_STATUS.CREATED);
  assert.equal(project.version, 1);

  // CREATED -> PLANNING
  project = service.transitionProject(project.id, PROJECT_STATUS.PLANNING, 1);
  assert.equal(project.status, PROJECT_STATUS.PLANNING);
  assert.equal(project.version, 2);
  assert.ok(project.startedAt);

  // PLANNING -> PLANNED
  project = service.transitionProject(project.id, PROJECT_STATUS.PLANNED, 2);
  assert.equal(project.status, PROJECT_STATUS.PLANNED);
  assert.equal(project.version, 3);

  // PLANNED -> GENERATING
  project = service.transitionProject(project.id, PROJECT_STATUS.GENERATING, 3);
  assert.equal(project.status, PROJECT_STATUS.GENERATING);
  assert.equal(project.version, 4);

  // GENERATING -> REVIEW_READY
  project = service.transitionProject(project.id, PROJECT_STATUS.REVIEW_READY, 4);
  assert.equal(project.status, PROJECT_STATUS.REVIEW_READY);
  assert.equal(project.version, 5);

  // REVIEW_READY -> APPROVED
  project = service.transitionProject(project.id, PROJECT_STATUS.APPROVED, 5);
  assert.equal(project.status, PROJECT_STATUS.APPROVED);
  assert.equal(project.version, 6);

  // APPROVED -> PUBLISHING
  project = service.transitionProject(project.id, PROJECT_STATUS.PUBLISHING, 6);
  assert.equal(project.status, PROJECT_STATUS.PUBLISHING);
  assert.equal(project.version, 7);

  // PUBLISHING -> PUBLISHED
  project = service.transitionProject(project.id, PROJECT_STATUS.PUBLISHED, 7);
  assert.equal(project.status, PROJECT_STATUS.PUBLISHED);
  assert.equal(project.version, 8);
  assert.ok(project.completedAt);

  closeDatabase(db);
});

test('2. Review rejection and revision loop (REVIEW_READY -> REJECTED -> PLANNING)', () => {
  const db = getFreshDb();
  const service = new ProjectService(db);

  let p = service.createProject({ title: 'Rejection Test', topic: 'Lore' });
  p = service.transitionProject(p.id, PROJECT_STATUS.PLANNING);
  p = service.transitionProject(p.id, PROJECT_STATUS.PLANNED);
  p = service.transitionProject(p.id, PROJECT_STATUS.GENERATING);
  p = service.transitionProject(p.id, PROJECT_STATUS.REVIEW_READY);

  // Reject
  p = service.transitionProject(p.id, PROJECT_STATUS.REJECTED);
  assert.equal(p.status, PROJECT_STATUS.REJECTED);

  // Revision: Move back to PLANNING
  p = service.transitionProject(p.id, PROJECT_STATUS.PLANNING);
  assert.equal(p.status, PROJECT_STATUS.PLANNING);

  closeDatabase(db);
});

test('3. Illegal direct transition throws InvalidStateTransitionError', () => {
  const db = getFreshDb();
  const service = new ProjectService(db);

  const p = service.createProject({ title: 'Illegal Jump', topic: 'Testing jumps' });

  // Cannot jump CREATED -> PUBLISHED
  assert.throws(
    () => service.transitionProject(p.id, PROJECT_STATUS.PUBLISHED),
    (err) => err instanceof InvalidStateTransitionError && err.code === 'INVALID_STATE_TRANSITION'
  );

  // Cannot jump CREATED -> APPROVED
  assert.throws(
    () => service.transitionProject(p.id, PROJECT_STATUS.APPROVED),
    (err) => err instanceof InvalidStateTransitionError
  );

  // Self-transition returns project idempotently without error
  const same = service.transitionProject(p.id, PROJECT_STATUS.CREATED);
  assert.equal(same.id, p.id);
  assert.equal(same.status, PROJECT_STATUS.CREATED);

  closeDatabase(db);
});

test('4. Terminal states (PUBLISHED, CANCELLED) forbid any further transitions', () => {
  const db = getFreshDb();
  const service = new ProjectService(db);

  let p1 = service.createProject({ title: 'Cancel Test', topic: 'Topic' });
  p1 = service.transitionProject(p1.id, PROJECT_STATUS.CANCELLED);
  assert.equal(p1.status, PROJECT_STATUS.CANCELLED);
  assert.ok(p1.completedAt);

  // Attempting to move CANCELLED -> PLANNING must fail
  assert.throws(
    () => service.transitionProject(p1.id, PROJECT_STATUS.PLANNING),
    (err) => err instanceof InvalidStateTransitionError
  );

  closeDatabase(db);
});

test('5. Optimistic concurrency conflict rejection (stale expectedVersion)', () => {
  const db = getFreshDb();
  const service = new ProjectService(db);

  const project = service.createProject({ title: 'Lock Test', topic: 'Concurrency' });

  // Valid transition from v1 -> v2
  service.transitionProject(project.id, PROJECT_STATUS.PLANNING, 1);

  // Attempting transition with stale version 1 must throw VersionConflictError
  assert.throws(
    () => service.transitionProject(project.id, PROJECT_STATUS.PLANNED, 1),
    (err) => err instanceof VersionConflictError && err.code === 'VERSION_CONFLICT'
  );

  closeDatabase(db);
});
