-- Migration: 002_research_dossiers.sql
-- Research Dossiers persistence for Phase 2

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS research_dossiers (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    topic TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    overall_score REAL NOT NULL DEFAULT 0.0,
    eligibility_status TEXT NOT NULL CHECK (eligibility_status IN ('READY_FOR_REVIEW', 'NEEDS_MORE_RESEARCH', 'REJECTED')),
    dossier_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_research_dossiers_project_id ON research_dossiers(project_id);
CREATE INDEX IF NOT EXISTS idx_research_dossiers_topic ON research_dossiers(topic);
CREATE INDEX IF NOT EXISTS idx_research_dossiers_eligibility ON research_dossiers(eligibility_status);
CREATE INDEX IF NOT EXISTS idx_research_dossiers_created_at ON research_dossiers(created_at);
