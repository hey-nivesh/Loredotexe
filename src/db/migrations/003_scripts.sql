-- Migration: 003_scripts.sql
-- Script packages and revision audit trail for Phase 3

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS scripts (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    dossier_id TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    topic TEXT NOT NULL,
    spoken_word_count INTEGER NOT NULL DEFAULT 0,
    estimated_duration_seconds REAL NOT NULL DEFAULT 0.0,
    approval_status TEXT NOT NULL CHECK (approval_status IN ('APPROVED_FOR_REVIEW', 'NEEDS_REVISION', 'BLOCKED')),
    qa_score REAL NOT NULL DEFAULT 0.0,
    script_json TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scripts_project_id ON scripts(project_id);
CREATE INDEX IF NOT EXISTS idx_scripts_approval ON scripts(approval_status);
CREATE INDEX IF NOT EXISTS idx_scripts_version ON scripts(project_id, version);
CREATE INDEX IF NOT EXISTS idx_scripts_created_at ON scripts(created_at);

CREATE TABLE IF NOT EXISTS script_revisions (
    id TEXT PRIMARY KEY,
    script_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    generation_attempt INTEGER NOT NULL DEFAULT 1,
    qa_outcome TEXT NOT NULL,
    revision_reason TEXT,
    script_json TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (script_id) REFERENCES scripts(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_script_revisions_script_id ON script_revisions(script_id);
CREATE INDEX IF NOT EXISTS idx_script_revisions_project_id ON script_revisions(project_id);
