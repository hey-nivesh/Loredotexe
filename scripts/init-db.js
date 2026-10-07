#!/usr/bin/env node
/**
 * Database Initialization and Migration Script for Loredotexe.
 */

import { config } from '../src/config/load-config.js';
import { createDatabaseConnection, runMigrations, closeDatabase } from '../src/db/connection.js';
import { logger } from '../src/logging/logger.js';

console.log('===============================================================');
console.log('       Loredotexe — SQLite Database Initializer               ');
console.log('===============================================================');
console.log(`Database Path: ${config.databasePath}`);
console.log(`Data Directory: ${config.dataDir}`);
console.log('');

try {
  const db = createDatabaseConnection();
  console.log('Connection established successfully.');

  const applied = runMigrations(db);
  if (applied.length === 0) {
    console.log('Database is already up to date. No new migrations applied.');
  } else {
    console.log(`Applied ${applied.length} new migration(s):`);
    for (const m of applied) {
      console.log(` - Version ${m.version}: ${m.name}`);
    }
  }

  // Quick sanity query
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
  console.log(`\nVerified database tables: ${tables.map(t => t.name).join(', ')}`);

  closeDatabase(db);
  console.log('\n[PASS] Database initialized successfully.\n');
  process.exit(0);
} catch (err) {
  logger.error('Database initialization failed', { error: err.message, stack: err.stack });
  console.error(`\n[FAIL] Database initialization failed: ${err.message}\n`);
  process.exit(1);
}
