/**
 * Execution Repository: Parameterized SQLite queries for workflow execution tracking.
 */

import { DatabaseError } from '../errors/app-errors.js';

export function mapRowToExecution(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    projectId: row.project_id,
    operation: row.operation,
    status: row.status,
    attemptNumber: row.attempt_number,
    idempotencyKey: row.idempotency_key,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    result: typeof row.result_json === 'string' ? JSON.parse(row.result_json) : row.result_json
  };
}

export class ExecutionRepository {
  /**
   * @param {import('node:sqlite').DatabaseSync} db
   */
  constructor(db) {
    this.db = db;
  }

  /**
   * Inserts a new execution record.
   * @param {object} execution
   */
  create(execution) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO executions (
          id, project_id, operation, status, attempt_number, idempotency_key,
          started_at, finished_at, error_code, error_message, result_json
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `);

      stmt.run(
        execution.id,
        execution.projectId,
        execution.operation,
        execution.status,
        execution.attemptNumber || 1,
        execution.idempotencyKey || null,
        execution.startedAt,
        execution.finishedAt || null,
        execution.errorCode || null,
        execution.errorMessage || null,
        execution.result ? JSON.stringify(execution.result) : null
      );

      return this.findById(execution.id);
    } catch (err) {
      throw new DatabaseError(`Failed to create execution: ${err.message}`, false, { executionId: execution.id });
    }
  }

  /**
   * Finds execution by ID.
   * @param {string} id
   * @returns {object|null}
   */
  findById(id) {
    try {
      const stmt = this.db.prepare('SELECT * FROM executions WHERE id = ?');
      const row = stmt.get(id);
      return mapRowToExecution(row);
    } catch (err) {
      throw new DatabaseError(`Failed to find execution by id: ${err.message}`, true, { executionId: id });
    }
  }

  /**
   * Finds execution by idempotency key.
   * @param {string} key
   * @returns {object|null}
   */
  findByIdempotencyKey(key) {
    try {
      const stmt = this.db.prepare('SELECT * FROM executions WHERE idempotency_key = ?');
      const row = stmt.get(key);
      return mapRowToExecution(row);
    } catch (err) {
      throw new DatabaseError(`Failed to find execution by idempotency key: ${err.message}`, true, { idempotencyKey: key });
    }
  }

  /**
   * Finds all executions for a project, sorted newest first.
   * @param {string} projectId
   * @returns {object[]}
   */
  findByProjectId(projectId) {
    try {
      const stmt = this.db.prepare('SELECT * FROM executions WHERE project_id = ? ORDER BY started_at DESC');
      const rows = stmt.all(projectId);
      return rows.map(mapRowToExecution);
    } catch (err) {
      throw new DatabaseError(`Failed to find executions by projectId: ${err.message}`, true, { projectId });
    }
  }

  /**
   * Updates execution status and completion details.
   * @param {string} id
   * @param {object} updates
   */
  update(id, { status, finishedAt, errorCode, errorMessage, result }) {
    try {
      const stmt = this.db.prepare(`
        UPDATE executions
        SET status = ?,
            finished_at = ?,
            error_code = ?,
            error_message = ?,
            result_json = ?
        WHERE id = ?
      `);

      stmt.run(
        status,
        finishedAt || new Date().toISOString(),
        errorCode || null,
        errorMessage || null,
        result ? JSON.stringify(result) : null,
        id
      );

      return this.findById(id);
    } catch (err) {
      throw new DatabaseError(`Failed to update execution: ${err.message}`, true, { executionId: id });
    }
  }
}
