# Loredotexe Architecture Documentation

## 1. System Overview

**Loredotexe** is an automated, modular, free-first AI video production engine designed for the YouTube channel **"The 10min Explosion"**. The system orchestrates end-to-end video generation—from initial content ideation to final YouTube publishing—using **n8n Community Edition** as the central workflow automation hub.

### Core Objectives
- **Zero Budget by Default**: Zero-cost operation utilizing open-source CLI utilities, free-tier cloud APIs, and lightweight local computation.
- **Local-First & Privacy Preserving**: Workflows and sensitive keys remain on the local machine; n8n runs locally on `localhost:5678`.
- **Human-in-the-Loop Safeguards**: Critical milestones (script approval, voiceover review, final video render) require explicit human sign-off before YouTube publishing.
- **Hardware-Aware Design**: Optimized for a 16 GB RAM, NVIDIA GPU, and <30 GB free disk space footprint on Windows 11.

---

## 2. High-Level Architecture Diagram

```
+-------------------------------------------------------------------------------+
|                                n8n Orchestrator                               |
|                         (Localhost Community Edition)                         |
+-------------------------------------------------------------------------------+
        |                     |                     |                     |
        v                     v                     v                     v
+---------------+     +---------------+     +---------------+     +---------------+
| Phase 2       |     | Phase 3       |     | Phase 4       |     | Phase 5 & 6   |
| Script & Lore |     | Free/Local    |     | Visuals &     |     | Human Gate &  |
| Research      |     | Voice Synth   |     | FFmpeg Render |     | YouTube Pub   |
+---------------+     +---------------+     +---------------+     +---------------+
| * Free LLM /  |     | * edge-tts    |     | * Image Prompt|     | * Local Review|
|   Ollama      |     | * Piper TTS   |     | * Stock APIs  |     | * Webhook /   |
| * Scene Plan  |     | * Subtitle    |     | * FFmpeg CLI  |     |   Approval    |
| * Timings     |     |   (SRT/VTT)   |     | * Hardware Acc|     | * YouTube API |
+---------------+     +---------------+     +---------------+     +---------------+
        |                     |                     |                     |
        +---------------------+---------------------+---------------------+
                                         |
                                         v
                         +-------------------------------+
                         | Storage & Asset Management    |
                         | (./storage/temp, output, etc) |
                         +-------------------------------+
```

---

## 3. Pipeline Stages & Workflow Breakdown

### Stage 1: Topic Research & Script Generation (Phase 2)
- **Input**: User topic or automated trend keyword.
- **Engine**: Free-tier cloud LLM (e.g., Gemini Free Tier / Groq) or lightweight local model (e.g., Ollama 3B/8B).
- **Output**: Structured JSON containing narration script, scene-by-scene visual descriptions, and pacing timestamps.

### Stage 2: Voiceover & Audio Synthesis (Phase 3)
- **Engine**: `edge-tts` (high-quality, free Microsoft Edge neural speech synthesis CLI) or offline `piper-tts`.
- **Output**: High-fidelity `.mp3`/`.wav` narration audio and word-aligned `.srt`/`.vtt` subtitle files.
- **Zero Cost**: No ElevenLabs or paid API subscription required.

### Stage 3: Visual Generation & Media Pipeline (Phase 4)
- **Engine**: Free stock media APIs (Pexels / Pixabay / Unsplash) + AI visual asset generators (Free tiers / lightweight local generation).
- **Assembly**: `FFmpeg` CLI orchestration (panning/zooming effects, subtitles burn-in, audio ducking, transition effects).
- **Acceleration**: NVIDIA NVENC hardware acceleration (`h264_nvenc`) where available.

### Stage 4: Human-in-the-Loop Quality Gate (Phase 5)
- **Mechanism**: Local notification (browser prompt / webhook / Discord / local UI).
- **Function**: Prevents unintended video uploads, validates rendering artifacts, and ensures editorial quality.

### Stage 5: YouTube Publishing & Metadata Automation (Phase 6)
- **Engine**: Google YouTube Data API v3 (OAuth2).
- **Payload**: Title, SEO description, tags, custom thumbnail, and 1080p MP4 upload (marked as `Private` or `Unlisted` by default).

---

## 4. Hardware Constraints & Decision Log

| Constraint | Specification | Strategy & Architectural Decision |
|---|---|---|
| **Free Disk Space** | `< 30 GB` | **Defer heavy local video models**: Do not download multi-gigabyte Stable Diffusion checkpoints or Large Video Diffusion weights (SVD/CogVideo) locally. Rely on FFmpeg composition, stock assets, and lightweight generation. |
| **RAM** | `16 GB` | Process video rendering sequentially; avoid parallel rendering workers; use streaming FFmpeg pipelines to prevent memory saturation. |
| **GPU & VRAM** | NVIDIA | Utilize NVIDIA NVENC for fast FFmpeg hardware encoding without requiring high VRAM model weights. |
| **Operating System**| Windows 11 | Use native PowerShell scripts, Node.js, and standard Windows paths; avoid hardcoded UNIX paths. |
| **Budget** | `$0.00` | Exclude all paid SaaS subscriptions and paid API tiers. |
