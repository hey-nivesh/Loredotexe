# Loredotexe Phase 2: Trend Discovery, Research, Evidence Verification & Topic Ranking

## 1. System Overview

**Phase 2** implements an end-to-end, free-first research and evidence verification pipeline for **Loredotexe**. It discovers high-potential candidate topics across trusted feeds, plans structured investigations, extracts discrete factual assertions, performs multi-source evidence corroboration, detects contradictions, calculates explainable suitability scores, and compiles validated research dossiers for subsequent scriptwriting.

```
+---------------------------------------------------------------------------------------------------+
|                                        n8n Orchestrator                                           |
|                                    (workflows/phase-2-trend-research.json)                        |
+---------------------------------------------------------------------------------------------------+
                                                 |
                                                 | HTTP POST /api/research/pipeline
                                                 v
+---------------------------------------------------------------------------------------------------+
|                                  Loredotexe Research Engine                                       |
+---------------------------------------------------------------------------------------------------+
|  1. Discovery & Normalization  --> RSS/Atom Provider, URL tracking cleaner, Jaccard Deduplication  |
|  2. Research Planning         --> 9 Core Investigation Dimensions, Deterministic Query Builder    |
|  3. Content & Quality Analysis--> Prompt-injection sanitizer, Wire syndication detector           |
|  4. Evidence Verification     --> Conservative multi-source corroboration, Contradiction detector  |
|  5. Explainable Ranking       --> Weighted 6-factor score (0-100), Hard eligibility gates         |
|  6. Dossier Synthesis         --> Schema validation (v1.0.0), Verified facts, Timeline, Context    |
+---------------------------------------------------------------------------------------------------+
                                                 |
                                                 | Parameterized SQL (node:sqlite)
                                                 v
+---------------------------------------------------------------------------------------------------+
|                            Persistent SQLite Store (WAL Mode)                                     |
|                       (research_dossiers, projects, executions)                                   |
+---------------------------------------------------------------------------------------------------+
```

---

## 2. Configured Source Feeds

The source registry ([src/research/discovery/source-registry.js](file:///e:/Personal%20Projects/Loredotexe/src/research/discovery/source-registry.js)) configures accessible, public RSS and Atom feeds:

| Category | Source Name | Feed Endpoint | Baseline Reliability |
|---|---|---|:---:|
| **Technology & AI** | Ars Technica | `https://feeds.arstechnica.com/arstechnica/technology-lab` | 0.90 |
| **Technology & AI** | MIT Technology Review | `https://www.technologyreview.com/feed/` | 0.95 |
| **Technology & AI** | Hacker News Frontpage | `https://news.ycombinator.com/rss` | 0.75 |
| **Science & Space** | Phys.org | `https://phys.org/rss-feed/` | 0.90 |
| **Science & Space** | ScienceDaily | `https://www.sciencedaily.com/rss/all.xml` | 0.85 |
| **Gaming & Lore** | IGN News | `https://feeds.feedburner.com/ign/all` | 0.80 |
| **Gaming & Lore** | PC Gamer | `https://www.pcgamer.com/rss/` | 0.80 |
| **Culture & Society** | BBC News Technology | `https://feeds.bbci.co.uk/news/technology/rss.xml` | 0.95 |

---

## 3. The 9 Research Dimensions & Query Planning

For every investigated topic, the query planner deterministically structures 9 investigative dimensions:

1. **What Happened?**: Core event summary and official announcement details.
2. **When Did It Happen?**: Exact release dates, milestones, and chronological timeline.
3. **Who Is Involved?**: Key figures, companies, developers, or historical factions.
4. **Original Source**: Primary documentation, papers, changelogs, or court filings.
5. **Evidence**: Verified empirical facts, numbers, and data points.
6. **Context & Lore**: Historical background lore and necessary technical foundation.
7. **Uncertainty**: Unconfirmed rumors, active disputes, or pending litigation.
8. **Misconceptions**: Debunking common viral myths or exaggerated claims.
9. **Audience Relevance**: Explaining why the topic matters to "The 10min Explosion" viewers.

---

## 4. Evidence Verification & Contradiction Detection

Verification is strictly conservative:
- **`SUPPORTED`**: At least two independent reporting groups or one authoritative primary document confirms the assertion.
- **`PARTIALLY_SUPPORTED`**: Supported by a single secondary reporting source without independent corroboration.
- **`DISPUTED`**: Direct factual conflict (polarity inversion, numerical difference, or timeline contradiction) detected between sources.
- **`UNSUPPORTED`**: Claim lacks cited evidence or only exists in low-trust commentary.
- **`UNVERIFIABLE`**: Inaccessible URLs or empty text snippets.

> [!IMPORTANT]
> **Wire Syndication Protection**:
> When multiple news sites republish the identical Associated Press (AP), Reuters, or PR Newswire release, the system classifies them under the same `independence_group` (`wire:ap`, `wire:reuters`) so syndicated duplicates are not falsely counted as independent confirmations.

---

## 5. Topic Scoring & Eligibility Gating

Topics are scored on a **0–100 scale** using transparent, explainable weights:
- **Freshness (25%)**: Age of discovery and publication recency.
- **Evidence Quality (25%)**: Ratio of supported claims and presence of high-importance facts.
- **Audience Interest (20%)**: High-engagement keywords and lore appeal.
- **Explainer Potential (15%)**: Depth of narrative and technical complexity suitable for 10-minute videos.
- **Channel Relevance (10%)**: Fit for "The 10min Explosion" channel themes.
- **Production Feasibility (5%)**: Ease of FFmpeg visual assembly and voice narration.

### Hard Eligibility Gates
- If **0 verified facts** are found -> `REJECTED`.
- If **> 2 major unresolved contradictions** exist -> `NEEDS_MORE_RESEARCH`.
- If **overall score < 50** -> `NEEDS_MORE_RESEARCH`.

---

## 6. Research Dossier Schema (v1.0.0)

Example dossier structure produced by [`src/research/dossiers/dossier-service.js`](file:///e:/Personal%20Projects/Loredotexe/src/research/dossiers/dossier-service.js):

```json
{
  "schema_version": "1.0.0",
  "research_run_id": "ad6e6026-2489-492b-8108-3957aa786778",
  "project_id": "d4b3c5d5-b54c-4370-a4e5-78157ae75e09",
  "generated_at": "2026-10-05T00:50:00.000Z",
  "topic": "James Webb Deep Field Discovery",
  "category": "science",
  "discovery_signals": {
    "originating_feed": "https://phys.org/rss-feed/",
    "keywords": ["jwst", "galaxy", "astronomy", "telescope"]
  },
  "factual_claims": [
    {
      "claim_id": "claim-4f8a12e89",
      "claim_text": "The James Webb Space Telescope detected the earliest confirmed galaxy candidate dating back to 300 million years after the Big Bang.",
      "claim_type": "fact",
      "importance": "high",
      "verification_status": "SUPPORTED",
      "confidence": 0.90,
      "evidence_items": [
        {
          "source_id": "src-nasa-jwst",
          "source_url": "https://nasa.gov/jwst/deep-field",
          "publisher": "NASA",
          "source_type": "primary",
          "reliability_score": 0.95,
          "independence_group": "domain:nasa.gov"
        }
      ]
    }
  ],
  "verified_facts": [
    {
      "claim_id": "claim-4f8a12e89",
      "statement": "The James Webb Space Telescope detected the earliest confirmed galaxy candidate dating back to 300 million years after the Big Bang.",
      "confidence": 0.90,
      "primary_evidence_source": "https://nasa.gov/jwst/deep-field"
    }
  ],
  "disputed_claims": [],
  "unknowns": [],
  "timeline": [
    { "period": "2026", "event": "Spectroscopic confirmation completed in April 2026." }
  ],
  "topic_score": 84.5,
  "eligibility_status": "READY_FOR_REVIEW",
  "suggested_explainer_angles": [
    "The complete origins and breakdown of James Webb Deep Field Discovery",
    "Why this discovery rewrites early cosmic history"
  ]
}
```

---

## 7. How to Import and Run the Phase 2 n8n Workflow

1. Start the local server:
   ```powershell
   npm run server
   ```
2. Start n8n:
   ```powershell
   npx n8n
   ```
3. Open `http://localhost:5678` in your browser.
4. Click **Workflows** -> **Import from File...** -> Select [`workflows/phase-2-trend-research.json`](file:///e:/Personal%20Projects/Loredotexe/workflows/phase-2-trend-research.json).
5. Click **"Execute workflow"**.
6. The workflow executes the full pipeline:
   - Sets candidate topic input.
   - Idempotently creates the project in SQLite.
   - Transitions state to `PLANNING`.
   - Executes the research pipeline and verifies claims.
   - Transitions state to `PLANNED` upon successful eligibility.
   - Saves the verified research dossier to SQLite and outputs a structured summary.
