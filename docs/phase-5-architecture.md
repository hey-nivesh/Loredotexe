# Phase 5 — Free/Local Media Generation Engine & Hardware Evaluator

## 1. Overview & Core Mission
Phase 5 implements a **model-independent, free-first, local-first media generation engine** for the YouTube channel *"The 10min Explosion"*. It consumes Phase 4's Canonical Storyboard Package and coordinates deterministic video generation, hardware capability evaluation, resource bounding, SHA-256 asset verification, and manifest packaging.

### Key Tenets
1. **Model Independence**: Business logic, storyboard generation, prompt compilation, queue scheduling, and asset registration are decoupled from underlying video generation models via the `VideoModelAdapter` interface.
2. **Hardware-Aware & Safe**: Strictly enforces that models are only marked `SUPPORTED` if the host machine meets real VRAM, RAM, Python, and OS requirements. On a 6GB GPU machine, models requiring $\ge 8\text{ GB}$ (like Wan2.1 T2V-1.3B) are classified as `UNSUPPORTED` (`INSUFFICIENT_VRAM`).
3. **No Automatic Large Downloads**: Prevents unexpected multi-gigabyte downloads. Model weights must be verified locally before any execution attempt.
4. **Idempotency & Resumability**: Every generation request calculates a deterministic SHA-256 prompt hash and generation key. Re-running a project automatically detects existing valid MP4 assets on disk and skips generation.
5. **Fail-Safe Orchestration**: Operates with a sequential queue (`concurrency: 1`), retry bounds (`maxRetries: 2`), and non-blocking mock/dry-run fallbacks.

---

## 2. Component Architecture

```
                                  +-----------------------------+
                                  | Phase 4 Storyboard Package  |
                                  +--------------+--------------+
                                                 |
                                                 v
                                  +-----------------------------+
                                  |    MediaGenerationPlanner   |
                                  +--------------+--------------+
                                                 |
                   +-----------------------------+-----------------------------+
                   |                                                           |
                   v                                                           v
       +-----------------------+                                   +-----------------------+
       |  ScenePromptCompiler  |                                   | ReferenceAssetRegistry|
       +-----------+-----------+                                   +-----------+-----------+
                   |                                                           |
                   +-----------------------------+-----------------------------+
                                                 |
                                                 v
                                  +-----------------------------+
                                  |       GenerationQueue       |
                                  |   (Sequential Concurrency=1)|
                                  +--------------+--------------+
                                                 |
                   +-----------------------------+-----------------------------+
                   |                             |                             |
                   v                             v                             v
       +-----------------------+   +-----------------------+   +-----------------------+
       | MockVideoModelAdapter |   | LightweightLocalVideo |   |   Wan21VideoAdapter   |
       |  (Deterministic MP4)  |   |   (6GB GPU Eval)      |   | (Safe Unsupported Hub)|
       +-----------+-----------+   +-----------+-----------+   +-----------+-----------+
                   |                             |                             |
                   +-----------------------------+-----------------------------+
                                                 |
                                                 v
                                  +-----------------------------+
                                  |       MediaValidator        |
                                  | (Header, Tolerance, SHA-256)|
                                  +--------------+--------------+
                                                 |
                   +-----------------------------+-----------------------------+
                   |                                                           |
                   v                                                           v
       +-----------------------+                                   +-----------------------+
       |     AssetRegistry     |                                   |    MediaRepository    |
       | (Hierarchical Storage)|                                   |    (SQLite Engine)    |
       +-----------+-----------+                                   +-----------+-----------+
                   |                                                           |
                   +-----------------------------+-----------------------------+
                                                 |
                                                 v
                                  +-----------------------------+
                                  |    MediaManifest Output     |
                                  +-----------------------------+
```

---

## 3. Storage Hierarchy
Generated media files follow a strict, versioned on-disk structure:
```
data/media/
├── generated/
│   └── <PROJECT_ID>/
│       └── <SCENE_ID>/
│           └── v<GENERATION_VERSION>/
│               ├── scene.mp4
│               └── metadata.json
├── temp/
├── references/
└── manifests/
    └── <PROJECT_ID>_manifest.json
```

---

## 4. API Endpoints
- `GET /api/media/hardware`: Returns host hardware inspection and capability status for registered models.
- `POST /api/media/dry-run`: Performs a non-generating dry run that validates prompts, calculates hashes, and estimates resource needs.
- `POST /api/media/generate`: Executes the media generation pipeline (in `mock`, `dry-run`, or `local` mode).
- `GET /api/media/manifest/:projectId`: Retrieves the completed/partial media manifest for a project.
- `GET /api/media/assets/:projectId`: Lists all validated media assets associated with a project.
- `POST /api/media/validate`: Validates an on-disk media file against duration and format tolerances.
