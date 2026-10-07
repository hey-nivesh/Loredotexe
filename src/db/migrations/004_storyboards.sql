-- Migration: 004_storyboards.sql
-- Storyboards, Scene Plans, Bibles, and Continuity State for Phase 4

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS storyboards (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    script_id TEXT,
    script_version INTEGER NOT NULL DEFAULT 1,
    storyboard_version INTEGER NOT NULL DEFAULT 1,
    topic TEXT NOT NULL,
    scene_count INTEGER NOT NULL DEFAULT 0,
    total_duration_seconds REAL NOT NULL DEFAULT 0.0,
    validation_status TEXT NOT NULL CHECK (validation_status IN ('VALID', 'WARNINGS', 'INVALID')),
    storyboard_json TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_storyboards_project_id ON storyboards(project_id);
CREATE INDEX IF NOT EXISTS idx_storyboards_validation ON storyboards(validation_status);
CREATE INDEX IF NOT EXISTS idx_storyboards_version ON storyboards(project_id, storyboard_version);
CREATE INDEX IF NOT EXISTS idx_storyboards_created_at ON storyboards(created_at);

CREATE TABLE IF NOT EXISTS storyboard_revisions (
    id TEXT PRIMARY KEY,
    storyboard_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    storyboard_version INTEGER NOT NULL,
    validation_outcome TEXT NOT NULL,
    storyboard_json TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (storyboard_id) REFERENCES storyboards(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_storyboard_revisions_storyboard_id ON storyboard_revisions(storyboard_id);
CREATE INDEX IF NOT EXISTS idx_storyboard_revisions_project_id ON storyboard_revisions(project_id);
