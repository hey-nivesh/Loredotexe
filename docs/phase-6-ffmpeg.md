# Phase 6: FFmpeg Video Assembly & Encoding

## 1. Overview
The Video Assembly engine normalizes video clips from Phase 5, stitches sequential scenes into a continuous timeline, and mixes master narration and audio into the final MP4 container.

## 2. Binary Detection (`FFmpegDetector`)
- Executes quick non-blocking version checks for `ffmpeg` and `ffprobe`.
- Inspects system `PATH` and optional configuration overrides (`FFMPEG_PATH`, `FFPROBE_PATH`).
- Seamlessly falls back to mock binary assembly mode if system encoders are not installed.

## 3. Media Normalization (`MediaNormalizer`)
Each scene video clip is normalized prior to concatenation:
- **Pixel Format**: `yuv420p`
- **Video Codec**: `libx264` (H.264 CPU encoding)
- **Audio Codec**: `aac` / 48kHz stereo
- **Profiles**:
  - `LOW`: 854x480 @ 24fps
  - `MEDIUM`: 1280x720 @ 30fps (Default)
  - `HIGH`: 1920x1080 @ 30fps

## 4. Final Video Delivery Structure
Outputs are saved into:
`data/media/final/<PROJECT_ID>/v<VERSION>/`
- `final.mp4`: Assembled video with synchronized audio and optional burned-in subtitles.
- `subtitles.srt`: SubRip subtitle file.
- `subtitles.vtt`: WebVTT subtitle file.
- `narration.wav`: Clean, concatenated speech audio.
- `mixed_audio.m4a`: Master mixed audio with music ducking and SFX.
- `timeline.json`: Complete segment-by-scene timing map.
- `assembly_manifest.json`: Input clips, settings, file hashes, and metadata.
- `validation.json`: Validation status and container stream diagnostics.
