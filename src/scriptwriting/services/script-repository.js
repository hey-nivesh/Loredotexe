/**
 * SQLite Repository for Script Packages and Revision Audit Trail.
 */

import { randomUUID } from 'node:crypto';
import { DatabaseError } from '../../errors/app-errors.js';

export class ScriptRepository {
  /**
   * @param {import('node:sqlite').DatabaseSync} db
   */
  constructor(db) {
    this.db = db;
  }

  /**
   * Persists a script package to SQLite.
   * @param {object} script
   * @returns {object} Saved record
   */
  saveScript(script) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO scripts (
          id, project_id, dossier_id, version, topic, spoken_word_count,
          estimated_duration_seconds, approval_status, qa_score,
          script_json, content_hash, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
        ON CONFLICT(id) DO UPDATE SET
          version = excluded.version,
          spoken_word_count = excluded.spoken_word_count,
          estimated_duration_seconds = excluded.estimated_duration_seconds,
          approval_status = excluded.approval_status,
          qa_score = excluded.qa_score,
          script_json = excluded.script_json,
          content_hash = excluded.content_hash,
          updated_at = excluded.updated_at
      `);

      const now = new Date().toISOString();
      const scriptId = script.id || randomUUID();

      stmt.run(
        scriptId,
        script.project_id,
        script.research_run_id || null,
        script.script_version || 1,
        script.topic,
        script.spoken_word_count || 0,
        script.estimated_duration_seconds || 0,
        script.approval_status,
        script.qa_report?.score || 0,
        JSON.stringify(script),
        script.content_hash,
        script.created_at || now,
        now
      );

      return {
        id: scriptId,
        projectId: script.project_id,
        version: script.script_version || 1,
        approvalStatus: script.approval_status,
        qaScore: script.qa_report?.score || 0,
        spokenWordCount: script.spoken_word_count,
        estimatedDurationSeconds: script.estimated_duration_seconds,
        contentHash: script.content_hash,
        updatedAt: now
      };
    } catch (err) {
      throw new DatabaseError(`Failed to save script to SQLite: ${err.message}`, { error: err.message });
    }
  }

  /**
   * Records an immutable revision in the audit trail.
   * @param {object} params
   */
  recordRevision({
    scriptId,
    projectId,
    version,
    attempt = 1,
    qaOutcome,
    revisionReason = null,
    scriptJson,
    contentHash
  }) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO script_revisions (
          id, script_id, project_id, version, generation_attempt,
          qa_outcome, revision_reason, script_json, content_hash, created_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `);

      const revisionId = randomUUID();
      const now = new Date().toISOString();

      stmt.run(
        revisionId,
        scriptId,
        projectId,
        version,
        attempt,
        qaOutcome,
        revisionReason,
        typeof scriptJson === 'string' ? scriptJson : JSON.stringify(scriptJson),
        contentHash,
        now
      );

      return { revisionId, scriptId, version, attempt, createdAt: now };
    } catch (err) {
      throw new DatabaseError(`Failed to record script revision: ${err.message}`, { error: err.message });
    }
  }

  /**
   * Finds a script by ID.
   * @param {string} scriptId
   * @returns {object|null}
   */
  findById(scriptId) {
    try {
      const stmt = this.db.prepare('SELECT * FROM scripts WHERE id = ?');
      const row = stmt.get(scriptId);
      if (!row) return null;
      return {
        ...row,
        scriptPackage: JSON.parse(row.script_json)
      };
    } catch (err) {
      throw new DatabaseError(`Failed to find script by ID '${scriptId}': ${err.message}`, { error: err.message });
    }
  }

  /**
   * Finds the latest active script for a project ID.
   * @param {string} projectId
   * @returns {object|null}
   */
  findLatestByProjectId(projectId) {
    try {
      const stmt = this.db.prepare('SELECT * FROM scripts WHERE project_id = ? ORDER BY version DESC LIMIT 1');
      const row = stmt.get(projectId);
      if (!row) return null;
      return {
        ...row,
        scriptPackage: JSON.parse(row.script_json)
      };
    } catch (err) {
      throw new DatabaseError(`Failed to find latest script for project '${projectId}': ${err.message}`, { error: err.message });
    }
  }

  /**
   * Lists all script revisions for a project.
   * @param {string} projectId
   * @returns {Array<object>}
   */
  listRevisionsByProjectId(projectId) {
    try {
      const stmt = this.db.prepare('SELECT id, script_id, project_id, version, generation_attempt, qa_outcome, revision_reason, content_hash, created_at FROM script_revisions WHERE project_id = ? ORDER BY created_at DESC');
      return stmt.all(projectId);
    } catch (err) {
      throw new DatabaseError(`Failed to list revisions for project '${projectId}': ${err.message}`, { error: err.message });
    }
  }
}
