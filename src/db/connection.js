/**
 * SQLite Database Connection and Migration Manager using Node.js native node:sqlite.
 */

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config/load-config.js';
import { logger } from '../logging/logger.js';
import { DatabaseError } from '../errors/app-errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.resolve(__dirname, 'migrations');

/**
 * Creates and initializes a new SQLite database connection.
 * @param {string} [customPath]
 * @returns {DatabaseSync}
 */
export function createDatabaseConnection(customPath = config.databasePath) {
  try {
    const isMemory = customPath === ':memory:';

    if (!isMemory) {
      const dbDir = path.dirname(customPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
    }

    const db = new DatabaseSync(customPath);

    // Apply performance and integrity pragmas
    db.exec('PRAGMA foreign_keys = ON;');
    if (!isMemory) {
      db.exec('PRAGMA journal_mode = WAL;');
      db.exec('PRAGMA synchronous = NORMAL;');
      db.exec('PRAGMA busy_timeout = 5000;');
    }

    return db;
  } catch (err) {
    logger.error('Failed to create SQLite database connection', { error: err.message, path: customPath });
    throw new DatabaseError(`Could not open database at ${customPath}: ${err.message}`, true, { path: customPath });
  }
}

/**
 * Executes a function within an explicit SQLite transaction.
 * Rolls back on error and commits on success.
 * @template T
 * @param {DatabaseSync} db
 * @param {() => T} fn
 * @returns {T}
 */
export function withTransaction(db, fn) {
  db.exec('BEGIN IMMEDIATE TRANSACTION;');
  try {
    const result = fn();
    db.exec('COMMIT;');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK;');
    } catch (rollbackErr) {
      logger.error('Transaction rollback failed', { error: rollbackErr.message });
    }
    throw err;
  }
}

/**
 * Runs pending schema migrations from src/db/migrations.
 * @param {DatabaseSync} db
 * @returns {Array<{ version: number, name: string }>} Applied migrations
 */
export function runMigrations(db) {
  // Ensure schema_migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = db.prepare('SELECT version FROM schema_migrations ORDER BY version ASC').all();
  const appliedVersions = new Set(appliedRows.map((r) => r.version));

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }

  const migrationFiles = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const newlyApplied = [];

  for (const file of migrationFiles) {
    const match = file.match(/^(\d+)_(.+)\.sql$/);
    if (!match) {
      continue;
    }

    const version = parseInt(match[1], 10);
    const name = match[2];

    if (appliedVersions.has(version)) {
      continue;
    }

    const filePath = path.join(MIGRATIONS_DIR, file);
    const sqlContent = fs.readFileSync(filePath, 'utf8');

    withTransaction(db, () => {
      db.exec(sqlContent);
      const insertStmt = db.prepare(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)'
      );
      insertStmt.run(version, name, new Date().toISOString());
    });

    logger.info('Applied database migration', { version, name, file });
    newlyApplied.push({ version, name });
  }

  return newlyApplied;
}

/**
 * Creates a transactionally safe online backup of the SQLite database.
 * Uses SQLite VACUUM INTO command.
 * @param {DatabaseSync} db
 * @param {string} destinationPath
 */
export function backupDatabase(db, destinationPath) {
  try {
    const destDir = path.dirname(destinationPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    if (fs.existsSync(destinationPath)) {
      fs.unlinkSync(destinationPath);
    }

    // Prepare parameterized VACUUM INTO statement
    const backupStmt = db.prepare('VACUUM INTO ?');
    backupStmt.run(destinationPath);
    logger.info('Database backed up successfully', { destination: destinationPath });
    return { success: true, destination: destinationPath };
  } catch (err) {
    logger.error('Database backup failed', { error: err.message, destination: destinationPath });
    throw new DatabaseError(`Database backup failed: ${err.message}`, false, { destination: destinationPath });
  }
}

/**
 * Safely closes the database connection.
 * @param {DatabaseSync} db
 */
export function closeDatabase(db) {
  if (db && typeof db.close === 'function') {
    db.close();
  }
}
