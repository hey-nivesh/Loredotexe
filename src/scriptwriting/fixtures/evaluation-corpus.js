/**
 * Evaluation Corpus: 16 Deterministic Test Fixtures for Phase 3 Scriptwriting.
 */

import { DOSSIER_SCHEMA_VERSION } from '../../research/dossiers/dossier-schema.js';

export const evaluationCorpus = {
  // 1. A dossier with strong factual evidence
  fixture1_strong_evidence: {
    schema_version: DOSSIER_SCHEMA_VERSION,
    research_run_id: 'run-strong-001',
    project_id: '11111111-1111-4111-8111-111111111111',
    generated_at: '2026-10-06T12:00:00Z',
    topic: 'Voyager 1 Interstellar Mission',
    category: 'science',
    discovery_signals: { originating_feed: 'NASA RSS', discovered_at: '2026-10-06T12:00:00Z', keywords: ['voyager', 'nasa', 'space'] },
    research_questions: ['What happened to Voyager 1 thrusters?'],
    source_registry: [{ source_id: 'src-1', url: 'https://nasa.gov/voyager', publisher: 'NASA', status: 'fetched' }],
    factual_claims: [
      {
        claim_id: 'claim-v1-01',
        claim_text: 'Voyager 1 launched in 1977 and is currently located over 15 billion miles from Earth.',
        verification_status: 'SUPPORTED',
        confidence: 0.99,
        evidence_items: [{ source_id: 'src-1', source_url: 'https://nasa.gov', reliability_score: 0.98, excerpt: 'Voyager 1 launched in 1977.' }]
      },
      {
        claim_id: 'claim-v1-02',
        claim_text: 'Engineers successfully restored scientific communications using backup memory chips.',
        verification_status: 'SUPPORTED',
        confidence: 0.95,
        evidence_items: [{ source_id: 'src-1', source_url: 'https://nasa.gov', reliability_score: 0.95, excerpt: 'Communications restored via backup memory.' }]
      }
    ],
    verified_facts: [
      { claim_id: 'claim-v1-01', statement: 'Voyager 1 launched in 1977 and is over 15 billion miles away.', confidence: 0.99 },
      { claim_id: 'claim-v1-02', statement: 'Engineers restored scientific readouts.', confidence: 0.95 }
    ],
    disputed_claims: [],
    unknowns: [{ claim_id: 'unk-01', unverified_assertion: 'Exact lifespan of remaining radioactive power generators beyond 2030.' }],
    timeline: [{ period: '1977', event: 'Voyager 1 launch', evidence_id: 'claim-v1-01' }],
    important_entities: ['Voyager 1', 'NASA JPL'],
    background_context: 'NASA launched the twin Voyager probes in 1977 to explore the outer solar system.',
    audience_relevance: 'Space exploration enthusiasts and lore fans.',
    common_misconceptions: ['Assuming Voyager 1 is completely dead.'],
    source_quality_summary: { total_sources_consulted: 2, primary_sources_count: 2, average_evidence_reliability: 0.97 },
    topic_score: 92,
    score_explanations: { factuality: 95, interest: 90 },
    eligibility_status: 'READY_FOR_REVIEW',
    rejection_reasons: [],
    suggested_explainer_angles: ['How NASA resurrected Voyager from 15 billion miles away'],
    limitations: []
  },

  // 2. A dossier with disputed claims
  fixture2_disputed_claims: {
    schema_version: DOSSIER_SCHEMA_VERSION,
    research_run_id: 'run-disputed-002',
    project_id: '22222222-2222-4222-8222-222222222222',
    generated_at: '2026-10-06T12:00:00Z',
    topic: 'Atlantis Sunken Megacity Discovery',
    category: 'mythology',
    discovery_signals: { originating_feed: 'ArcheoFeed', discovered_at: '2026-10-06T12:00:00Z', keywords: ['atlantis'] },
    research_questions: ['Was Atlantis discovered in the Atlantic?'],
    source_registry: [{ source_id: 'src-2', url: 'https://archeo.org/atlantis', publisher: 'ArcheoFeed', status: 'fetched' }],
    factual_claims: [
      {
        claim_id: 'claim-at-01',
        claim_text: 'Sonar mapping identified geometric seafloor formations near the Azores.',
        verification_status: 'SUPPORTED',
        confidence: 0.85,
        evidence_items: [{ source_id: 'src-2', source_url: 'https://archeo.org', reliability_score: 0.85, excerpt: 'Sonar showed formations.' }]
      }
    ],
    verified_facts: [{ claim_id: 'claim-at-01', statement: 'Sonar mapping identified geometric formations.', confidence: 0.85 }],
    disputed_claims: [
      {
        claim_id: 'claim-at-disp-01',
        statement: 'Submersible teams recovered gold artifacts directly from the ruins.',
        contradictions: ['Geological surveys found only volcanic basalt.'],
        notes: 'Unverified tabloid report contradicted by scientific survey.'
      }
    ],
    unknowns: [{ claim_id: 'unk-at-01', unverified_assertion: 'Whether geometric formations are artificial or natural basalt column cooling.' }],
    timeline: [],
    important_entities: ['Azores', 'Sonar Survey'],
    background_context: 'Plato first recorded the myth of Atlantis in 360 BC.',
    audience_relevance: 'Mythology and history mystery buffs.',
    common_misconceptions: ['Assuming ancient myths are literal historical maps.'],
    source_quality_summary: { total_sources_consulted: 2, average_evidence_reliability: 0.70 },
    topic_score: 75,
    score_explanations: {},
    eligibility_status: 'READY_FOR_REVIEW',
    rejection_reasons: [],
    suggested_explainer_angles: ['The real geology behind the new Atlantis sonar discovery'],
    limitations: []
  },

  // 3. A dossier with missing evidence (needs more research)
  fixture3_missing_evidence: {
    schema_version: DOSSIER_SCHEMA_VERSION,
    research_run_id: 'run-missing-003',
    project_id: '33333333-3333-4333-8333-333333333333',
    generated_at: '2026-10-06T12:00:00Z',
    topic: 'Secret Antigravity Engine Patent',
    category: 'technology',
    discovery_signals: { originating_feed: 'TechForum', discovered_at: '2026-10-06T12:00:00Z', keywords: ['antigravity'] },
    research_questions: ['Is the patent legitimate?'],
    source_registry: [],
    factual_claims: [],
    verified_facts: [],
    disputed_claims: [],
    unknowns: [],
    timeline: [],
    important_entities: [],
    background_context: 'Unverified online rumors.',
    audience_relevance: 'Tech fans.',
    common_misconceptions: [],
    source_quality_summary: { total_sources_consulted: 0, average_evidence_reliability: 0.0 },
    topic_score: 35,
    score_explanations: {},
    eligibility_status: 'NEEDS_MORE_RESEARCH',
    rejection_reasons: ['No primary technical sources found.'],
    suggested_explainer_angles: [],
    limitations: []
  },

  // 4. A malformed dossier (missing required fields)
  fixture4_malformed_dossier: {
    topic: 'Malformed Data without schema',
    broken: true
  }
};
