-- Migration: 006_audio_assembly.sql
-- Narration Segments, Audio Timelines, and Video Assemblies for Phase 6

PRAGMA foreign_keys = ON;

-- 1. Narration Segments Table
CREATE TABLE IF NOT EXISTS narration_segments (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    scene_id TEXT NOT NULL,
    sequence INTEGER NOT NULL,
    text TEXT NOT NULL,
    provider TEXT NOT NULL,
    voice TEXT NOT NULL,
    text_hash TEXT NOT NULL,
    audio_path TEXT,
    duration_seconds REAL NOT NULL DEFAULT 0.0,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'SYNTHESIZING', 'COMPLETED', 'FAILED', 'REUSED')),
    error_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_narration_segments_project_id ON narration_segments(project_id);
CREATE INDEX IF NOT EXISTS idx_narration_segments_scene_id ON narration_segments(scene_id);
CREATE INDEX IF NOT EXISTS idx_narration_segments_text_hash ON narration_segments(text_hash);
CREATE INDEX IF NOT EXISTS idx_narration_segments_status ON narration_segments(status);

-- 2. Audio Timelines Table
CREATE TABLE IF NOT EXISTS audio_timelines (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    timeline_version INTEGER NOT NULL DEFAULT 1,
    timeline_json TEXT NOT NULL,
    total_duration_seconds REAL NOT NULL DEFAULT 0.0,
    status TEXT NOT NULL CHECK (status IN ('VALID', 'INVALID', 'CONFLICT')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audio_timelines_project_id ON audio_timelines(project_id);

-- 3. Video Assemblies Table
CREATE TABLE IF NOT EXISTS video_assemblies (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    storyboard_version INTEGER NOT NULL DEFAULT 1,
    media_generation_version INTEGER NOT NULL DEFAULT 1,
    assembly_version INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL CHECK (status IN ('QUEUED', 'ASSEMBLING', 'VALIDATING', 'COMPLETED', 'FAILED')),
    output_video_path TEXT,
    output_audio_path TEXT,
    subtitle_srt_path TEXT,
    subtitle_vtt_path TEXT,
    manifest_json TEXT NOT NULL,
    metadata_json TEXT NOT NULL,
    validation_json TEXT,
    created_at TEXT NOT NULL,
    completed_at TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_video_assemblies_project_id ON video_assemblies(project_id);
CREATE INDEX IF NOT EXISTS idx_video_assemblies_status ON video_assemblies(status);
