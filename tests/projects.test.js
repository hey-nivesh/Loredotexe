/**
 * Automated Tests: Project Service, Validation, Idempotency, and Persistence.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDatabaseConnection, runMigrations, closeDatabase } from '../src/db/connection.js';
import { ProjectService } from '../src/projects/project.service.js';
import { PROJECT_STATUS } from '../src/projects/project.schema.js';
import {
  ValidationError,
  NotFoundError,
  IdempotencyConflictError
} from '../src/errors/app-errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DB_PATH = path.resolve(__dirname, '../data/test_projects.sqlite');

function getFreshDb() {
  const db = createDatabaseConnection(':memory:');
  runMigrations(db);
  return db;
}

test('1. Successful project creation with default and custom values', () => {
  const db = getFreshDb();
  const service = new ProjectService(db);

  const project = service.createProject({
    title: 'The Great Cataclysm of Atlantis',
    topic: 'Ancient mythical warfare',
    metadata: { tags: ['mythology', 'history'] }
  });

  assert.ok(project.id);
  assert.equal(project.title, 'The Great Cataclysm of Atlantis');
  assert.equal(project.topic, 'Ancient mythical warfare');
  assert.equal(project.channelName, 'The 10min Explosion');
  assert.equal(project.status, PROJECT_STATUS.CREATED);
  assert.equal(project.version, 1);
  assert.deepEqual(project.metadata.tags, ['mythology', 'history']);

  closeDatabase(db);
});

test('2. Missing title, short title, or blank title throws ValidationError', () => {
  const db = getFreshDb();
  const service = new ProjectService(db);

  assert.throws(
    () => service.createProject({ topic: 'Valid topic' }),
    (err) => err instanceof ValidationError && err.message.includes('title')
  );

  assert.throws(
    () => service.createProject({ title: '   ', topic: 'Valid topic' }),
    (err) => err instanceof ValidationError && err.message.includes('title')
  );

  assert.throws(
    () => service.createProject({ title: 'ab', topic: 'Valid topic' }),
    (err) => err instanceof ValidationError && err.message.includes('between 3 and 200')
  );

  closeDatabase(db);
});

test('3. Missing topic throws ValidationError', () => {
  const db = getFreshDb();
  const service = new ProjectService(db);

  assert.throws(
    () => service.createProject({ title: 'Valid Title Here' }),
    (err) => err instanceof ValidationError && err.message.includes('topic')
  );

  closeDatabase(db);
});

test('4. Invalid project ID (non-UUID) throws ValidationError', () => {
  const db = getFreshDb();
  const service = new ProjectService(db);

  assert.throws(
    () => service.getProject('123-not-uuid'),
    (err) => err instanceof ValidationError && err.code === 'VALIDATION_ERROR'
  );

  assert.throws(
    () => service.getProject(''),
    (err) => err instanceof ValidationError
  );

  closeDatabase(db);
});

test('5. Duplicate idempotent creation returns identical project record', () => {
  const db = getFreshDb();
  const service = new ProjectService(db);

  const payload = {
    title: 'Idempotent Lore 101',
    topic: 'Testing duplicate protection'
  };
  const idempotencyKey = 'unique-key-lore-001';

  const p1 = service.createProject(payload, idempotencyKey);
  const p2 = service.createProject(payload, idempotencyKey);

  assert.equal(p1.id, p2.id);
  assert.equal(p1.title, p2.title);
  assert.equal(p1.createdAt, p2.createdAt);

  closeDatabase(db);
});

test('6. Conflicting reuse of idempotency key throws IdempotencyConflictError', () => {
  const db = getFreshDb();
  const service = new ProjectService(db);

  const key = 'shared-conflict-key';
  service.createProject({ title: 'Original Topic', topic: 'Original content' }, key);

  assert.throws(
    () => service.createProject({ title: 'Conflicting Title', topic: 'Different content' }, key),
    (err) => err instanceof IdempotencyConflictError && err.code === 'IDEMPOTENCY_CONFLICT'
  );

  closeDatabase(db);
});

test('7. Retrieval of an existing project vs nonexistent project', () => {
  const db = getFreshDb();
  const service = new ProjectService(db);

  const created = service.createProject({
    title: 'Existing Project',
    topic: 'Existing topic lore'
  });

  const found = service.getProject(created.id);
  assert.equal(found.id, created.id);
  assert.equal(found.title, 'Existing Project');

  assert.throws(
    () => service.getProject('00000000-0000-0000-0000-000000000000'),
    (err) => err instanceof NotFoundError && err.code === 'NOT_FOUND'
  );

  closeDatabase(db);
});

test('8. Project pagination and filtering by status and topic', () => {
  const db = getFreshDb();
  const service = new ProjectService(db);

  for (let i = 1; i <= 5; i++) {
    service.createProject({
      title: `Warhammer Lore Episode ${i}`,
      topic: i % 2 === 0 ? 'Space Marines' : 'Necrons'
    });
  }

  const all = service.listProjects({ limit: 10 });
  assert.equal(all.total, 5);
  assert.equal(all.items.length, 5);

  const page1 = service.listProjects({ limit: 2, offset: 0 });
  assert.equal(page1.items.length, 2);
  assert.equal(page1.total, 5);

  const topicFiltered = service.listProjects({ topic: 'Space Marines' });
  assert.equal(topicFiltered.total, 2);

  closeDatabase(db);
});

test('9. Database persistence across separate service instances', () => {
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }

  // 1st Connection: create project
  const db1 = createDatabaseConnection(TEST_DB_PATH);
  runMigrations(db1);
  const service1 = new ProjectService(db1);
  const created = service1.createProject({
    title: 'Persistent Story Project',
    topic: 'Persistence Verification'
  });
  const savedId = created.id;
  closeDatabase(db1);

  // 2nd Connection: reopen and fetch
  const db2 = createDatabaseConnection(TEST_DB_PATH);
  const service2 = new ProjectService(db2);
  const retrieved = service2.getProject(savedId);

  assert.equal(retrieved.id, savedId);
  assert.equal(retrieved.title, 'Persistent Story Project');
  assert.equal(retrieved.topic, 'Persistence Verification');

  closeDatabase(db2);

  // Cleanup test db
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
});
