-- Migration: 005_media_assets.sql
-- Media Generation Jobs, Asset Registry, and Manifests for Phase 5

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS media_jobs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    scene_id TEXT NOT NULL,
    storyboard_version INTEGER NOT NULL DEFAULT 1,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('QUEUED', 'VALIDATING', 'GENERATING', 'VALIDATING_OUTPUT', 'COMPLETED', 'FAILED', 'CANCELLED', 'RETRYING')),
    attempt INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 2,
    prompt_hash TEXT NOT NULL,
    request_json TEXT NOT NULL,
    result_json TEXT,
    error_json TEXT,
    created_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_media_jobs_project_id ON media_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_media_jobs_scene_id ON media_jobs(scene_id);
CREATE INDEX IF NOT EXISTS idx_media_jobs_status ON media_jobs(status);
CREATE INDEX IF NOT EXISTS idx_media_jobs_created_at ON media_jobs(created_at);

CREATE TABLE IF NOT EXISTS media_assets (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    scene_id TEXT NOT NULL,
    asset_type TEXT NOT NULL DEFAULT 'video',
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    file_path TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL DEFAULT 0,
    duration_seconds REAL NOT NULL DEFAULT 0.0,
    width INTEGER NOT NULL DEFAULT 832,
    height INTEGER NOT NULL DEFAULT 480,
    fps INTEGER NOT NULL DEFAULT 16,
    status TEXT NOT NULL CHECK (status IN ('VALID', 'INVALID', 'CORRUPTED', 'PENDING')),
    metadata_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_media_assets_project_id ON media_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_scene_id ON media_assets(scene_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_file_hash ON media_assets(file_hash);
CREATE INDEX IF NOT EXISTS idx_media_assets_status ON media_assets(status);

CREATE TABLE IF NOT EXISTS media_manifests (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    storyboard_version INTEGER NOT NULL DEFAULT 1,
    generation_version INTEGER NOT NULL DEFAULT 1,
    total_scenes INTEGER NOT NULL DEFAULT 0,
    completed_scenes INTEGER NOT NULL DEFAULT 0,
    failed_scenes INTEGER NOT NULL DEFAULT 0,
    pending_scenes INTEGER NOT NULL DEFAULT 0,
    manifest_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_media_manifests_project_id ON media_manifests(project_id);
