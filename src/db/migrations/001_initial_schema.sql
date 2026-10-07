-- Migration: 001_initial_schema.sql
-- Initial Schema for Loredotexe Projects and Execution Lifecycle

PRAGMA foreign_keys = ON;

-- Schema migrations tracker
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    topic TEXT NOT NULL,
    channel_name TEXT NOT NULL DEFAULT 'The 10min Explosion',
    status TEXT NOT NULL,
    input_json TEXT NOT NULL,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    error_message TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    version INTEGER NOT NULL DEFAULT 1
);

-- Executions tracking table
CREATE TABLE IF NOT EXISTS executions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'cancelled')),
    attempt_number INTEGER NOT NULL DEFAULT 1,
    idempotency_key TEXT UNIQUE,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    error_code TEXT,
    error_message TEXT,
    result_json TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Performance and lookup indexes
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);
CREATE INDEX IF NOT EXISTS idx_projects_topic ON projects(topic);
CREATE INDEX IF NOT EXISTS idx_executions_project_id ON executions(project_id);
CREATE INDEX IF NOT EXISTS idx_executions_idempotency_key ON executions(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);
