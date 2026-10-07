# Loredotexe — n8n Workflows Directory

This directory stores exported n8n workflow definitions (`.json` format) used to orchestrate the video production pipeline for the YouTube channel **"The 10min Explosion"**.

## Workflow Architecture & Organization

When workflows are implemented in subsequent phases, they will be organized as modular, single-responsibility pipelines:

```
workflows/
├── README.md                          # This file
├── phase-1-project-orchestrator.json  # (Phase 1) Project state & lifecycle orchestration
├── phase-2-trend-research.json        # (Phase 2) Trend discovery, evidence verification & dossier
├── 02-script-writing-and-review.json  # (Phase 3) Script drafting & scene breakdown
├── 03-audio-tts-synthesis.json        # (Phase 3) Edge-TTS voice generation & timing
├── 04-visual-prompting-and-media.json # (Phase 4) Asset collection & prompt generation
├── 05-video-assembly-render.json      # (Phase 4) FFmpeg render orchestration
├── 06-approval-gate-notification.json # (Phase 5) Webhook / Human review gating
└── 07-youtube-metadata-and-upload.json# (Phase 6) YouTube API publishing
```

## Guidelines for Workflow Export & Version Control

1. **Separate Credentials from Code**:
   - **NEVER** export credentials or secrets with your workflows.
   - When exporting workflows from the n8n UI, do not include saved credentials. Use environment variable placeholders or generic credential references.

2. **Clean JSON Formatting**:
   - Save exported workflow files with 2-space indentation.
   - Avoid saving workflow execution history or heavy binary payloads in workflow definitions.

3. **Node Naming Conventions**:
   - Name each node descriptively (e.g., `Generate Script Outline (Ollama/Free LLM)`, `Generate Voice (Edge-TTS Command)`, `FFmpeg Assemble Video`).
   - Group related steps with n8n Sticky Notes for clarity.

4. **Approval Gate Requirement**:
   - All destructive or publishing workflows must include an explicit approval gate node before triggering upload or external dispatch.
