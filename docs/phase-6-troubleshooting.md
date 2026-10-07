# Phase 6: Assembly & Audio Troubleshooting Guide

## 1. Common Error Codes & Resolutions

### `FFMPEG_NOT_FOUND`
- **Cause**: FFmpeg executable is not in system PATH or environment variable `FFMPEG_PATH`.
- **Solution**: Install FFmpeg via `winget install Gyan.FFmpeg` or set `FFMPEG_PATH=C:\path\to\ffmpeg.exe`. In development or CI, the engine automatically uses Mock Assembly mode (`useFfmpeg: false` or `ASSEMBLY_MODE=mock`).

### `TTS_MODEL_NOT_INSTALLED`
- **Cause**: Local ONNX / Piper model weights were requested without installing the model file locally.
- **Solution**: Download the model to `data/models/tts/` or configure `TTS_PROVIDER=mock` in `.env`.

### `NARRATION_OVERFLOW`
- **Cause**: Synthesized narration audio for a scene exceeds the planned visual scene duration by more than `maxAllowedOverflowSeconds` (default: 2.0s).
- **Solution**: Shorten the chapter speech in Phase 3 script, or increase the visual scene duration in Phase 4 storyboard.

### `MISSING_SCENE_MEDIA`
- **Cause**: A scene specified in the storyboard does not have a generated video clip in `data/media/generated/`.
- **Solution**: Run Phase 5 media generation first or enable mock fallback clips during assembly dry-run.

### `CORRUPT_AUDIO_FILE`
- **Cause**: An audio segment was written with 0 bytes or an invalid RIFF header.
- **Solution**: The assembly service automatically purges corrupt cache entries and re-synthesizes the segment.

## 2. Running Verification Suite
```powershell
npm run verify:phase-6
```
This runs 13 isolated checks across segmentation, timeline synchronization, subtitle generation, audio ducking, assembly, and database persistence.
