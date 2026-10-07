# Phase 6: Subtitle Engine & Styling

## 1. Overview
The Subtitle subsystem generates formatted, accurate subtitle tracks from the synchronized narration timeline. It produces standard SubRip (`.srt`) and WebVTT (`.vtt`) files for YouTube closed-captioning, and configures ASS/FFmpeg burn-in styling.

## 2. Components
- **`SubtitleChunker` (`src/assembly/subtitles/subtitle-chunker.js`)**:
  - Splits long narration blocks into natural, readable subtitle cues.
  - Constraints: Max 42 characters per line, max 2 lines per cue.
  - Prioritizes sentence boundaries (`.`, `!`, `?`), punctuation commas, and word boundaries.
- **`SubtitleGenerator` (`src/assembly/subtitles/subtitle-generator.js`)**:
  - Maps chunked cues across speech duration windows.
  - Computes exact millisecond timestamps (`00:00:00,000` / `00:00:00.000`).
  - Outputs `subtitles.srt` and `subtitles.vtt` in the final delivery package.
- **`SubtitleStyler` (`src/assembly/subtitles/subtitle-styler.js`)**:
  - Formats FFmpeg subtitle filter arguments:
    `subtitles=subtitles.srt:force_style='Fontname=Inter,Fontsize=28,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=1,Alignment=2,MarginV=35'`

## 3. Formatting Standards
- **SRT Format**:
  ```srt
  1
  00:00:00,000 --> 00:00:04,500
  In 2012, NASA detected an anomaly

  2
  00:00:04,500 --> 00:00:09,000
  beyond the heliosphere edge.
  ```
- **VTT Format**:
  ```vtt
  WEBVTT

  1
  00:00:00.000 --> 00:00:04.500
  In 2012, NASA detected an anomaly
  ```
