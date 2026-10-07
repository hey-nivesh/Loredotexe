# Loredotexe 🎬⚡

> **Free-First, n8n-Orchestrated AI Video Production Automation**  
> Tailored for the YouTube channel: **"The 10min Explosion"**

---

## Overview

**Loredotexe** is an automated video production system engineered to generate 10-minute lore and storytelling videos using an orchestration layer powered by **n8n Community Edition**, free neural text-to-speech (`edge-tts`), automated visual sourcing, and **FFmpeg** rendering—with zero required software or API subscription budget.

---

## Current Status: Phase 6 — Voice + Subtitles + Final Video Assembly ✅

- **Phase 0 (Environment Foundation)**: ✅ Complete
- **Phase 1 (Core Orchestration & Persistent State)**: ✅ Complete
- **Phase 2 (Trend Discovery & Evidence Verification)**: ✅ Complete
- **Phase 3 (Scriptwriting, Gen-Z Humor & Editorial QA)**: ✅ Complete
- **Phase 4 (Storyboard, Character/World Bibles & Continuity Engine)**: ✅ Complete
- **Phase 5 (Free/Local Media Generation Engine & Hardware Evaluator)**: ✅ Complete
- **Phase 6 (Voice, Subtitles & Final Video Assembly)**: ✅ Complete

```
loredotexe/
├── README.md                          # Project documentation and quickstart
├── package.json                       # ES Module scripts & project metadata
├── docs/
│   ├── phase-1.md                     # Phase 1 state machine & persistence guide
│   ├── phase-2.md                     # Phase 2 research, scoring & dossier guide
│   ├── phase-3-architecture.md        # Phase 3 scriptwriting architecture guide
│   ├── phase-3-schema.md              # Phase 3 scriptwriting schema specification
│   ├── phase-4-architecture.md        # Phase 4 storyboard & continuity architecture
│   ├── phase-4-schema.md              # Phase 4 canonical scene & bible schemas
│   ├── phase-4-continuity.md          # Phase 4 deterministic continuity rules
│   ├── phase-5-architecture.md        # Phase 5 media generation architecture
│   ├── phase-5-media-schema.md        # Phase 5 canonical request & manifest schemas
│   ├── phase-5-hardware.md            # Phase 5 hardware policy & compatibility matrix
│   ├── phase-5-troubleshooting.md     # Phase 5 diagnostic & troubleshooting guide
│   ├── phase-6-architecture.md        # Phase 6 assembly architecture guide
│   ├── phase-6-audio.md               # Phase 6 voice synthesis & audio mixing guide
│   ├── phase-6-subtitles.md           # Phase 6 subtitle engine & styling guide
│   ├── phase-6-ffmpeg.md              # Phase 6 FFmpeg assembly & render profiles
│   └── phase-6-troubleshooting.md     # Phase 6 assembly troubleshooting guide
├── src/
│   ├── db/                            # SQLite database connection & 001-006 migrations
│   ├── projects/                      # Project lifecycle, transitions, repository & service
│   ├── executions/                    # Execution repository & tracking service
│   ├── research/                      # Trend discovery, evidence engine & dossier service
│   ├── scriptwriting/                 # Story architect, scriptwriter, humor editor & editorial QA
│   ├── storyboard/                    # Bibles, visual beat extractor, scene planner & continuity engine
│   ├── media/                         # Hardware detector, model registry, adapters, queue & validator
│   ├── assembly/                      # TTS, narration segmenter, audio mixer, subtitle generator & FFmpeg assembler
│   ├── server.js                      # Localhost REST API for n8n orchestrator
│   └── logging/                       # Structured JSON logging & redaction
├── workflows/
│   ├── loredotexe-pipeline.json       # Master unified end-to-end n8n workflow (Phases 1-6)
│   ├── phase-5-media-generation.json  # Standalone Phase 5 media generation workflow
│   └── phase-6-video-assembly.json    # Standalone Phase 6 video assembly workflow
├── scripts/
│   ├── verify-phase-1.js              # Phase 1 verification suite
│   ├── verify-phase-2.js              # Phase 2 verification suite
│   ├── verify-phase-3.js              # Phase 3 verification suite
│   ├── verify-phase-4.js              # Phase 4 verification suite
│   ├── verify-phase-5.js              # Phase 5 verification suite
│   └── verify-phase-6.js              # Phase 6 verification suite (13/13 passing)
└── tests/                             # Full automated test suite (108/108 passing)
```

---

## Quickstart & Verification

### 1. Initialize Database & Migrations
```powershell
npm run db:init
```

### 2. Run All Automated Unit & Integration Tests (108 Tests)
```powershell
npm test
```

### 3. Run Verification Suites
```powershell
# Phase 1 verification
npm run verify:phase-1

# Phase 2 research verification
npm run verify:phase-2

# Phase 3 scriptwriting verification
npm run verify:phase-3

# Phase 4 storyboard verification
npm run verify:phase-4

# Phase 5 media generation verification
npm run verify:phase-5

# Phase 6 assembly & voice verification (13/13 passing)
npm run verify:phase-6
```

### 4. Start Local State & Research API Server
```powershell
npm run server
```

### 5. Launch n8n Locally
Start local n8n Community Edition in a separate terminal:
```powershell
npx n8n
```
Then visit: [http://localhost:5678](http://localhost:5678)

---

## Detailed Documentation

- 🎬 [Phase 6 Architecture & Assembly Specification](file:///e:/Personal%20Projects/Loredotexe/docs/phase-6-architecture.md)
- 🎙️ [Phase 6 Voice & Audio Mixing Guide](file:///e:/Personal%20Projects/Loredotexe/docs/phase-6-audio.md)
- 📝 [Phase 6 Subtitles & Styling Guide](file:///e:/Personal%20Projects/Loredotexe/docs/phase-6-subtitles.md)
- 🎞️ [Phase 6 FFmpeg Normalization & Profiles](file:///e:/Personal%20Projects/Loredotexe/docs/phase-6-ffmpeg.md)
- 🛠️ [Phase 6 Assembly Troubleshooting](file:///e:/Personal%20Projects/Loredotexe/docs/phase-6-troubleshooting.md)
- 🎨 [Phase 5 Media Generation Architecture](file:///e:/Personal%20Projects/Loredotexe/docs/phase-5-architecture.md)
- 🎬 [Phase 4 Storyboard & Continuity Engine](file:///e:/Personal%20Projects/Loredotexe/docs/phase-4-architecture.md)
- ✍️ [Phase 3 Scriptwriting Architecture](file:///e:/Personal%20Projects/Loredotexe/docs/phase-3-architecture.md)
- 🔬 [Phase 2 Research & Dossiers Guide](file:///e:/Personal%20Projects/Loredotexe/docs/phase-2.md)
- 📘 [Phase 1 Implementation Guide](file:///e:/Personal%20Projects/Loredotexe/docs/phase-1.md)
- 📐 [Architecture Documentation](file:///e:/Personal%20Projects/Loredotexe/docs/architecture.md)
- 🖥️ [Windows Setup & Operations Guide](file:///e:/Personal%20Projects/Loredotexe/docs/setup-windows.md)
- 🗺️ [Project Phase Roadmap](file:///e:/Personal%20Projects/Loredotexe/docs/phase-roadmap.md)
- 🔒 [Security & Secrets Policy](file:///e:/Personal%20Projects/Loredotexe/docs/security.md)
- ⚡ [Workflows Guide](file:///e:/Personal%20Projects/Loredotexe/workflows/README.md)
