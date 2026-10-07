/**
 * Project Repository: Parameterized SQLite data access for projects.
 */

import { DatabaseError } from '../errors/app-errors.js';

/**
 * Transforms a raw database row into a structured Project entity.
 * @param {any} row
 * @returns {any}
 */
export function mapRowToProject(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    title: row.title,
    topic: row.topic,
    channelName: row.channel_name,
    status: row.status,
    input: typeof row.input_json === 'string' ? JSON.parse(row.input_json) : row.input_json,
    metadata: typeof row.metadata_json === 'string' ? JSON.parse(row.metadata_json) : row.metadata_json,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    version: row.version
  };
}

export class ProjectRepository {
  /**
   * @param {import('node:sqlite').DatabaseSync} db
   */
  constructor(db) {
    this.db = db;
  }

  /**
   * Inserts a new project.
   * @param {object} project
   */
  create(project) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO projects (
          id, title, topic, channel_name, status, input_json, metadata_json,
          error_message, created_at, updated_at, started_at, completed_at, version
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `);

      stmt.run(
        project.id,
        project.title,
        project.topic,
        project.channelName,
        project.status,
        JSON.stringify(project.input),
        JSON.stringify(project.metadata || {}),
        project.errorMessage || null,
        project.createdAt,
        project.updatedAt,
        project.startedAt || null,
        project.completedAt || null,
        project.version || 1
      );

      return this.findById(project.id);
    } catch (err) {
      throw new DatabaseError(`Failed to insert project: ${err.message}`, false, { projectId: project.id });
    }
  }

  /**
   * Finds a project by ID.
   * @param {string} id
   * @returns {object|null}
   */
  findById(id) {
    try {
      const stmt = this.db.prepare('SELECT * FROM projects WHERE id = ?');
      const row = stmt.get(id);
      return mapRowToProject(row);
    } catch (err) {
      throw new DatabaseError(`Failed to find project by id: ${err.message}`, true, { projectId: id });
    }
  }

  /**
   * Lists projects with filtering and pagination.
   * @param {object} params
   * @param {string} [params.status]
   * @param {string} [params.topic]
   * @param {number} [params.limit=20]
   * @param {number} [params.offset=0]
   * @returns {{ total: number, limit: number, offset: number, items: any[] }}
   */
  list({ status, topic, limit = 20, offset = 0 } = {}) {
    try {
      const safeLimit = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);
      const safeOffset = Math.max(0, parseInt(offset, 10) || 0);

      const whereClauses = [];
      const queryParams = [];

      if (status) {
        whereClauses.push('status = ?');
        queryParams.push(status);
      }

      if (topic) {
        whereClauses.push('topic LIKE ?');
        queryParams.push(`%${topic}%`);
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      // Count query
      const countStmt = this.db.prepare(`SELECT COUNT(*) as count FROM projects ${whereSql}`);
      const countResult = countStmt.get(...queryParams);
      const total = countResult ? countResult.count : 0;

      // Select query with consistent sorting
      const selectSql = `
        SELECT * FROM projects
        ${whereSql}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;
      const selectStmt = this.db.prepare(selectSql);
      const rows = selectStmt.all(...queryParams, safeLimit, safeOffset);

      return {
        total,
        limit: safeLimit,
        offset: safeOffset,
        items: rows.map(mapRowToProject)
      };
    } catch (err) {
      throw new DatabaseError(`Failed to list projects: ${err.message}`, true);
    }
  }

  /**
   * Atomically transitions status and increments version with optimistic locking.
   * @param {string} id
   * @param {string} targetStatus
   * @param {number} expectedVersion
   * @param {object} [extraUpdates={}]
   * @returns {number} Number of rows updated (1 on success, 0 on conflict/not found)
   */
  updateStatus(id, targetStatus, expectedVersion, extraUpdates = {}) {
    try {
      const now = new Date().toISOString();
      let sql = `
        UPDATE projects
        SET status = ?,
            version = version + 1,
            updated_at = ?,
            started_at = COALESCE(?, started_at),
            completed_at = COALESCE(?, completed_at),
            metadata_json = COALESCE(?, metadata_json),
            error_message = ?
        WHERE id = ? AND version = ?
      `;

      const metadataParam = extraUpdates.metadata ? JSON.stringify(extraUpdates.metadata) : null;
      const startedAtParam = extraUpdates.startedAt || null;
      const completedAtParam = extraUpdates.completedAt || null;
      const errorMsgParam = extraUpdates.errorMessage !== undefined ? extraUpdates.errorMessage : null;

      const stmt = this.db.prepare(sql);
      const result = stmt.run(
        targetStatus,
        now,
        startedAtParam,
        completedAtParam,
        metadataParam,
        errorMsgParam,
        id,
        expectedVersion
      );

      return result.changes;
    } catch (err) {
      throw new DatabaseError(`Failed to update project status: ${err.message}`, true, { projectId: id });
    }
  }

  /**
   * Records project failure.
   * @param {string} id
   * @param {string} errorMessage
   * @param {number} [expectedVersion]
   * @returns {number}
   */
  recordFailure(id, errorMessage, expectedVersion) {
    try {
      const now = new Date().toISOString();
      let sql;
      let params;

      if (expectedVersion !== undefined && expectedVersion !== null) {
        sql = `
          UPDATE projects
          SET status = 'FAILED',
              version = version + 1,
              updated_at = ?,
              error_message = ?
          WHERE id = ? AND version = ?
        `;
        params = [now, errorMessage, id, expectedVersion];
      } else {
        sql = `
          UPDATE projects
          SET status = 'FAILED',
              version = version + 1,
              updated_at = ?,
              error_message = ?
          WHERE id = ?
        `;
        params = [now, errorMessage, id];
      }

      const stmt = this.db.prepare(sql);
      const result = stmt.run(...params);
      return result.changes;
    } catch (err) {
      throw new DatabaseError(`Failed to record project failure: ${err.message}`, true, { projectId: id });
    }
  }
}
