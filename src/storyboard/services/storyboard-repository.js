/**
 * SQLite Repository for Storyboard Packages and Revision Audit Trail.
 */

import { randomUUID } from 'node:crypto';
import { DatabaseError } from '../../errors/app-errors.js';

export class StoryboardRepository {
  /**
   * @param {import('node:sqlite').DatabaseSync} db
   */
  constructor(db) {
    this.db = db;
  }

  /**
   * Persists a storyboard package to SQLite.
   * @param {object} storyboard
   * @returns {object} Saved record metadata
   */
  saveStoryboard(storyboard) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO storyboards (
          id, project_id, script_id, script_version, storyboard_version,
          topic, scene_count, total_duration_seconds, validation_status,
          storyboard_json, content_hash, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
        ON CONFLICT(id) DO UPDATE SET
          storyboard_version = excluded.storyboard_version,
          scene_count = excluded.scene_count,
          total_duration_seconds = excluded.total_duration_seconds,
          validation_status = excluded.validation_status,
          storyboard_json = excluded.storyboard_json,
          content_hash = excluded.content_hash,
          updated_at = excluded.updated_at
      `);

      const now = new Date().toISOString();
      const storyboardId = storyboard.id || randomUUID();
      const totalDuration = storyboard.scenes?.reduce((acc, s) => acc + (s.duration_seconds || 0), 0) || 0;

      stmt.run(
        storyboardId,
        storyboard.project_id,
        storyboard.script_id || null,
        storyboard.script_version || 1,
        storyboard.storyboard_version || 1,
        storyboard.topic,
        storyboard.scenes?.length || 0,
        totalDuration,
        storyboard.validation_report?.status || 'VALID',
        JSON.stringify(storyboard),
        storyboard.content_hash,
        storyboard.created_at || now,
        now
      );

      return {
        id: storyboardId,
        projectId: storyboard.project_id,
        scriptId: storyboard.script_id,
        scriptVersion: storyboard.script_version,
        storyboardVersion: storyboard.storyboard_version,
        sceneCount: storyboard.scenes?.length || 0,
        totalDurationSeconds: totalDuration,
        validationStatus: storyboard.validation_report?.status || 'VALID',
        contentHash: storyboard.content_hash,
        updatedAt: now
      };
    } catch (err) {
      throw new DatabaseError(`Failed to save storyboard to SQLite: ${err.message}`, { error: err.message });
    }
  }

  /**
   * Records an immutable revision in the storyboard audit trail.
   * @param {object} params
   */
  recordRevision({
    storyboardId,
    projectId,
    version,
    validationOutcome,
    storyboardJson,
    contentHash
  }) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO storyboard_revisions (
          id, storyboard_id, project_id, storyboard_version,
          validation_outcome, storyboard_json, content_hash, created_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?
        )
      `);

      const revisionId = randomUUID();
      const now = new Date().toISOString();

      stmt.run(
        revisionId,
        storyboardId,
        projectId,
        version,
        validationOutcome,
        typeof storyboardJson === 'string' ? storyboardJson : JSON.stringify(storyboardJson),
        contentHash,
        now
      );

      return { revisionId, storyboardId, version, createdAt: now };
    } catch (err) {
      throw new DatabaseError(`Failed to record storyboard revision: ${err.message}`, { error: err.message });
    }
  }

  /**
   * Finds a storyboard by ID.
   * @param {string} storyboardId
   * @returns {object|null}
   */
  findById(storyboardId) {
    try {
      const stmt = this.db.prepare('SELECT * FROM storyboards WHERE id = ?');
      const row = stmt.get(storyboardId);
      if (!row) return null;
      return {
        ...row,
        storyboardPackage: JSON.parse(row.storyboard_json)
      };
    } catch (err) {
      throw new DatabaseError(`Failed to find storyboard by ID '${storyboardId}': ${err.message}`, { error: err.message });
    }
  }

  /**
   * Finds the latest active storyboard for a project ID.
   * @param {string} projectId
   * @returns {object|null}
   */
  findLatestByProjectId(projectId) {
    try {
      const stmt = this.db.prepare('SELECT * FROM storyboards WHERE project_id = ? ORDER BY storyboard_version DESC LIMIT 1');
      const row = stmt.get(projectId);
      if (!row) return null;
      return {
        ...row,
        storyboardPackage: JSON.parse(row.storyboard_json)
      };
    } catch (err) {
      throw new DatabaseError(`Failed to find latest storyboard for project '${projectId}': ${err.message}`, { error: err.message });
    }
  }

  /**
   * Lists all storyboard revisions for a project.
   * @param {string} projectId
   * @returns {Array<object>}
   */
  listRevisionsByProjectId(projectId) {
    try {
      const stmt = this.db.prepare('SELECT id, storyboard_id, project_id, storyboard_version, validation_outcome, content_hash, created_at FROM storyboard_revisions WHERE project_id = ? ORDER BY created_at DESC');
      return stmt.all(projectId);
    } catch (err) {
      throw new DatabaseError(`Failed to list storyboard revisions for project '${projectId}': ${err.message}`, { error: err.message });
    }
  }
}
