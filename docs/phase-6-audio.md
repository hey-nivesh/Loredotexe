# Phase 6: Voice & Audio Pipeline Architecture

## 1. Overview
The Audio subsystem of Phase 6 synthesizes chapter and scene narration, synchronizes speech durations with visual scene timing, and mixes speech, background music, and sound effects into a master audio track.

## 2. Component Hierarchy
- **`NarrationSegmenter` (`src/assembly/narration/narration-segmenter.js`)**:
  - Parses script chapters and storyboard visual scenes.
  - Maps speech units to scene identifiers (`scene_id`).
  - Estimates word count, speaking rates (~150 WPM default), and initial segment durations.
- **`TTSService` (`src/assembly/tts/tts-service.js`)**:
  - Orchestrates TTS adapters with caching and retry logic.
  - Generates deterministic RIFF/WAV audio buffers in mock mode.
  - Protects system resources in local mode with strict model availability validation.
- **`TTSCache` (`src/assembly/tts/tts-cache.js`)**:
  - Computes a SHA-256 fingerprint: `SHA256(text + voice + provider + speed + sampleRate)`.
  - Avoids redundant audio generation during pipeline reruns.
- **`TimelineBuilder` (`src/assembly/narration/timeline-builder.js`)**:
  - Calculates sequential cumulative start and end timestamps.
  - Establishes canonical narration timelines.
- **`TimelineSynchronizer` (`src/assembly/narration/timeline-synchronizer.js`)**:
  - Compares visual scene durations with synthesized speech lengths.
  - Flags pacing mismatches (`NARRATION_OVERFLOW`, `SHORT_NARRATION`, `LONG_SCENE`).
- **`MusicManager` (`src/assembly/audio/music-manager.js`)**:
  - Scans local background music directory (`data/media/audio/music/`).
  - Applies automatic volume ducking (default: 15% volume under 100% speech).
- **`SFXManager` (`src/assembly/audio/sfx-manager.js`)**:
  - Resolves sound effects matching scene action descriptions.
  - Defaults to non-blocking operation when audio library is empty.
- **`AudioMixer` (`src/assembly/audio/audio-mixer.js`)**:
  - Stitches sequential narration WAV segments.
  - Renders master mixed audio tracks (`narration.wav` and `mixed_audio.m4a`).

## 3. Pacing & Timing Rules
| Condition | Trigger | Action / Warning |
| :--- | :--- | :--- |
| **Normal** | Speech duration $\le$ Scene duration | Narration plays within scene window |
| **Narration Overflow** | Speech duration $>$ Scene duration + 2.0s | System logs `NARRATION_OVERFLOW` conflict |
| **Short Narration** | Speech duration $<$ 50% of Scene duration | System logs `SHORT_NARRATION` notice |
| **Long Scene** | Scene duration $>$ Speech duration + 5.0s | Visual scene holds or loops ambient video |

## 4. Volume Ducking Standard
- **Narration**: `1.0` (100%)
- **Background Music**: `0.15` (15%)
- **Sound Effects (SFX)**: `0.20` (20%)
