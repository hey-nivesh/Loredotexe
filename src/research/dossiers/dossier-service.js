/**
 * Dossier Service: Assembles, validates, and persists complete Research Dossiers.
 */

import { randomUUID } from 'node:crypto';
import { DOSSIER_SCHEMA_VERSION, validateDossierSchema } from './dossier-schema.js';
import { VERIFICATION_STATUS } from '../evidence/claim-verifier.js';
import { DatabaseError } from '../../errors/app-errors.js';
import { logger } from '../../logging/logger.js';

export class DossierService {
  /**
   * @param {import('node:sqlite').DatabaseSync} db
   */
  constructor(db) {
    this.db = db;
  }

  /**
   * Assembles a structured, validated research dossier from raw research artifacts.
   * @param {object} params
   * @param {string} params.topic
   * @param {string} [params.category='general']
   * @param {object} [params.candidate={}]
   * @param {object} [params.plan={}]
   * @param {Array<object>} [params.sourceDocuments=[]]
   * @param {Array<object>} [params.verifiedClaims=[]]
   * @param {object} [params.topicScore={}]
   * @param {string|null} [params.projectId=null]
   * @returns {object}
   */
  assembleDossier({
    topic,
    category = 'general',
    candidate = {},
    plan = {},
    sourceDocuments = [],
    verifiedClaims = [],
    topicScore = {},
    projectId = null
  }) {
    const runId = randomUUID();
    const now = new Date().toISOString();

    const verifiedFacts = verifiedClaims
      .filter((c) => c.verification_status === VERIFICATION_STATUS.SUPPORTED)
      .map((c) => ({
        claim_id: c.claim_id,
        statement: c.claim_text,
        confidence: c.confidence,
        primary_evidence_source: c.evidence_items[0]?.source_url || 'Unknown'
      }));

    const disputedClaims = verifiedClaims
      .filter((c) => c.verification_status === VERIFICATION_STATUS.DISPUTED)
      .map((c) => ({
        claim_id: c.claim_id,
        statement: c.claim_text,
        contradictions: c.contradictions,
        notes: c.reviewer_notes
      }));

    const unknowns = verifiedClaims
      .filter((c) => [VERIFICATION_STATUS.UNSUPPORTED, VERIFICATION_STATUS.UNVERIFIABLE].includes(c.verification_status))
      .map((c) => ({
        claim_id: c.claim_id,
        unverified_assertion: c.claim_text,
        reason: c.reviewer_notes
      }));

    // Build timeline from date-bearing facts
    const timeline = [];
    for (const c of verifiedClaims) {
      const yearMatch = c.claim_text.match(/\b(19\d\d|20\d\d)\b/);
      if (yearMatch && c.verification_status === VERIFICATION_STATUS.SUPPORTED) {
        timeline.push({
          period: yearMatch[1],
          event: c.claim_text,
          evidence_id: c.claim_id
        });
      }
    }
    timeline.sort((a, b) => parseInt(a.period, 10) - parseInt(b.period, 10));

    // Source registry summary
    const sourceRegistrySummary = sourceDocuments.map((doc, idx) => ({
      source_id: doc.sourceId || `src-${idx + 1}`,
      url: doc.sourceUrl,
      publisher: doc.publisher,
      status: doc.status || 'fetched',
      published_at: doc.publishedAt || null
    }));

    // Quality metrics summary
    const allEvidence = verifiedClaims.flatMap((c) => c.evidence_items || []);
    const sourceQualitySummary = {
      total_sources_consulted: sourceDocuments.length,
      primary_sources_count: allEvidence.filter((e) => e.source_type === 'primary').length,
      secondary_sources_count: allEvidence.filter((e) => e.source_type === 'secondary_reporting').length,
      commentary_count: allEvidence.filter((e) => e.source_type === 'commentary').length,
      average_evidence_reliability:
        allEvidence.length > 0
          ? Math.round((allEvidence.reduce((acc, e) => acc + (e.reliability_score || 0), 0) / allEvidence.length) * 100) / 100
          : 0.0
    };

    const dossier = {
      schema_version: DOSSIER_SCHEMA_VERSION,
      research_run_id: runId,
      project_id: projectId,
      generated_at: now,
      topic: (topic || '').trim(),
      category: (category || 'general').toLowerCase(),
      discovery_signals: {
        originating_feed: candidate.originating_feed || null,
        discovered_at: candidate.discovered_at || now,
        keywords: candidate.keywords || []
      },
      research_questions: plan.researchQuestions || [],
      source_registry: sourceRegistrySummary,
      factual_claims: verifiedClaims,
      verified_facts: verifiedFacts,
      disputed_claims: disputedClaims,
      unknowns,
      timeline,
      important_entities: candidate.keywords || [],
      background_context: candidate.summary || `Extensive lore and technical investigation into ${topic}.`,
      audience_relevance: `High-value explainer topic for "The 10min Explosion" viewers interested in ${category}.`,
      common_misconceptions: [
        'Assuming unverified early reports represent the final official outcome.'
      ],
      source_quality_summary: sourceQualitySummary,
      topic_score: topicScore.overall_score || 0,
      score_explanations: topicScore.score_explanations || {},
      eligibility_status: topicScore.eligibility_status || 'NEEDS_MORE_RESEARCH',
      rejection_reasons: topicScore.rejection_reasons || [],
      suggested_explainer_angles: [
        `The complete origins and breakdown of ${topic}`,
        `Why ${topic} changes everything for ${category}`,
        `The untold story and verified timeline behind ${topic}`
      ],
      limitations: [
        'Based on publicly available web documentation and RSS reporting.',
        'Deterministic evidence extraction mode utilized.'
      ]
    };

    return validateDossierSchema(dossier);
  }

  /**
   * Persists a dossier to SQLite database.
   * @param {object} dossier
   * @param {string} [projectId]
   * @returns {object} Saved record metadata
   */
  saveDossier(dossier, projectId = null) {
    const validated = validateDossierSchema(dossier);
    const dossierId = validated.research_run_id || randomUUID();
    const finalProjectId = projectId || validated.project_id;

    if (!finalProjectId) {
      throw new Error('A valid project_id is required to persist a research dossier.');
    }

    try {
      const stmt = this.db.prepare(`
        INSERT INTO research_dossiers (
          id, project_id, topic, category, overall_score, eligibility_status,
          dossier_json, created_at, updated_at, version
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, 1
        )
      `);

      const now = new Date().toISOString();
      stmt.run(
        dossierId,
        finalProjectId,
        validated.topic,
        validated.category,
        validated.topic_score,
        validated.eligibility_status,
        JSON.stringify(validated),
        now,
        now
      );

      logger.info('Research dossier saved to SQLite', { dossierId, projectId: finalProjectId, topic: validated.topic });
      return {
        id: dossierId,
        projectId: finalProjectId,
        topic: validated.topic,
        score: validated.topic_score,
        eligibilityStatus: validated.eligibility_status,
        createdAt: now
      };
    } catch (err) {
      throw new DatabaseError(`Failed to save research dossier: ${err.message}`, true, { dossierId });
    }
  }

  /**
   * Finds a research dossier by ID.
   * @param {string} id
   * @returns {object|null}
   */
  getDossierById(id) {
    try {
      const stmt = this.db.prepare('SELECT * FROM research_dossiers WHERE id = ?');
      const row = stmt.get(id);
      if (!row) return null;
      return {
        id: row.id,
        projectId: row.project_id,
        topic: row.topic,
        category: row.category,
        overallScore: row.overall_score,
        eligibilityStatus: row.eligibility_status,
        dossier: JSON.parse(row.dossier_json),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } catch (err) {
      throw new DatabaseError(`Failed to get research dossier: ${err.message}`, true, { id });
    }
  }

  /**
   * Finds a research dossier by project ID.
   * @param {string} projectId
   * @returns {object|null}
   */
  getDossierByProjectId(projectId) {
    try {
      const stmt = this.db.prepare('SELECT * FROM research_dossiers WHERE project_id = ? ORDER BY created_at DESC LIMIT 1');
      const row = stmt.get(projectId);
      if (!row) return null;
      return {
        id: row.id,
        projectId: row.project_id,
        topic: row.topic,
        category: row.category,
        overallScore: row.overall_score,
        eligibilityStatus: row.eligibility_status,
        dossier: JSON.parse(row.dossier_json),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } catch (err) {
      throw new DatabaseError(`Failed to get dossier by project ID: ${err.message}`, true, { projectId });
    }
  }
}
