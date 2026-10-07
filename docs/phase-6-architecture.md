# Phase 6 — Voice + Subtitles + Final Video Assembly Architecture

## 1. Overview & Core Mission
Phase 6 completes the production pipeline of **Loredotexe** for the YouTube channel *"The 10min Explosion"*. It consumes:
1. **Phase 3 Script** (chapters, narration texts, WPM targets, narrative tone)
2. **Phase 4 Storyboard** (canonical scenes, visual durations, camera motions, transitions, continuity)
3. **Phase 5 Generated Scene Media & Manifest** (scene MP4 video clips, SHA-256 hashes, metadata)

And produces:
- **Narration Audio** via model-independent, cached, segment-level TTS (Mock / Piper / Local)
- **Subtitles** in standard SRT and WebVTT formats with readability chunking
- **Narration Timeline & Audio/Video Synchronization** reconciling speech and visual pacing
- **Audio Mix** featuring speech ducking with user-provided background music and sound effects
- **Normalized Video Assembly** concatenating scene clips, applying transitions (cut/fade/crossfade), and muxing audio/subtitles
- **Final Output Deliverable**: `data/media/final/<PROJECT_ID>/v<VERSION>/final.mp4`
- **Validation Report & Manifest**: Technical compliance checking (video streams, audio streams, codecs, durations, zero black frames)

---

## 2. Component Pipeline Diagram

```
+---------------------------------------------------------------------------------------------------+
|                                      PHASE 6 INPUTS                                               |
|  Phase 3 Script (Narration)  |  Phase 4 Storyboard (Scenes)  |  Phase 5 Media Manifest (Clips)    |
+---------------------------------------------------------------------------------------------------+
                                                 |
                                                 v
                                  +-----------------------------+
                                  |    NarrationSegmenter       |
                                  | (Scene-linked segment units)|
                                  +--------------+--------------+
                                                 |
                                                 v
                                  +-----------------------------+
                                  |    TTS Service + Caching    |
                                  |  (Mock / Local / Piper)     |
                                  +--------------+--------------+
                                                 |
                                                 v
                                  +-----------------------------+
                                  |   TimelineSynchronizer      |
                                  |  (Sync Speech & Visuals)    |
                                  +--------------+--------------+
                                                 |
                   +-----------------------------+-----------------------------+
                   |                                                           |
                   v                                                           v
       +-----------------------+                                   +-----------------------+
       |   SubtitleGenerator   |                                   |  Music & SFX Manager  |
       |  (SRT / WebVTT format)|                                   | (Audio Ducking 15-20%)|
       +-----------+-----------+                                   +-----------+-----------+
                   |                                                           |
                   +-----------------------------+-----------------------------+
                                                 |
                                                 v
                                  +-----------------------------+
                                  |         AudioMixer          |
                                  | (Narration + Music + SFX)   |
                                  +--------------+--------------+
                                                 |
                                                 v
                                  +-----------------------------+
                                  |      MediaNormalizer        |
                                  | (Resolution, FPS, Codecs)   |
                                  +--------------+--------------+
                                                 |
                                                 v
                                  +-----------------------------+
                                  |      FFmpegAssembler        |
                                  | (Concatenate, Transitions,  |
                                  |   Mux Audio & Subtitles)    |
                                  +--------------+--------------+
                                                 |
                                                 v
                                  +-----------------------------+
                                  |     FinalVideoValidator     |
                                  | (Inspect streams, duration) |
                                  +--------------+--------------+
                                                 |
                                                 v
                                  +-----------------------------+
                                  | Output Deliverables Package |
                                  | (final.mp4, subtitles, meta)|
                                  +-----------------------------+
```

---

## 3. Storage Hierarchy & Deliverables Structure
All Phase 6 outputs are written deterministically under `data/media/final/`:

```
data/media/final/
└── <PROJECT_ID>/
    └── v<ASSEMBLY_VERSION>/
        ├── final.mp4             # High-quality assembled 16:9 video
        ├── narration.wav         # Pure concatenated voice narration
        ├── mixed_audio.m4a       # Mixed master audio (narration + ducked music + SFX)
        ├── subtitles.srt         # SubRip format subtitles
        ├── subtitles.vtt         # WebVTT format subtitles
        ├── timeline.json         # Master synchronization timeline
        ├── metadata.json         # Final video technical metadata
        ├── assembly_manifest.json# Comprehensive assembly manifest
        └── validation.json       # Quality and compliance validation report
```

---

## 4. Resource & Isolation Policy
1. **Free-First & Safe**: 100% executable without cloud APIs or paid services.
2. **Deterministic Mock & Dry-Run Modes**: Full testability and dry-run planning without requiring local GPU or external binaries.
3. **CPU-First FFmpeg Encoding**: Avoids GPU VRAM contention with local generation models; respects host hardware (16GB RAM, RTX 3050 6GB).
4. **Resumable & Idempotent**: TTS synthesis and assembly steps check SQLite asset registry and file system hashes before generating.
