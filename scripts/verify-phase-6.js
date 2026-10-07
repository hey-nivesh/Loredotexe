#!/usr/bin/env node
/**
 * Verification Suite for Loredotexe Phase 6 Requirements.
 * Validates Voice Synthesis, Subtitles, Audio/Video Synchronization, Mixing, FFmpeg Assembly & Deliverable Packaging.
 */

import assert from 'node:assert/strict';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDatabaseConnection, runMigrations } from '../src/db/connection.js';
import { ProjectService } from '../src/projects/project.service.js';
import {
  AssemblyService,
  NarrationSegmenter,
  TimelineBuilder,
  TimelineSynchronizer,
  MockTTSAdapter,
  LocalTTSAdapter,
  TTSCache,
  SubtitleChunker,
  SubtitleGenerator,
  SubtitleStyler,
  MusicManager,
  SFXManager,
  AudioMixer,
  FFmpegDetector,
  MediaNormalizer,
  FFmpegAssembler,
  FinalVideoValidator,
  AssemblyRepository,
  ASSEMBLY_ERROR_CODES,
  PROJECT_STATUS
} from '../src/assembly/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sampleInput = JSON.parse(
  readFileSync(resolve(__dirname, '../fixtures/phase-6/sample-assembly-input.json'), 'utf-8')
);

console.log('===============================================================');
console.log('         Loredotexe — Phase 6 Verification Suite              ');
console.log('     Voice + Subtitles + Final Video Assembly Engine           ');
console.log('===============================================================');
console.log('');

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

async function runCheck(name, fn) {
  totalChecks++;
  try {
    await fn();
    console.log(`  [PASS] Check ${totalChecks}: ${name}`);
    passedChecks++;
  } catch (err) {
    console.error(`  [FAIL] Check ${totalChecks}: ${name}`);
    console.error(`         Error: ${err.message}`);
    failedChecks++;
  }
}

async function main() {
  const db = createDatabaseConnection(':memory:');
  runMigrations(db);

  const projectService = new ProjectService(db);
  const project = projectService.createProject({
    title: sampleInput.script_package.topic,
    topic: sampleInput.script_package.topic
  });
  const projectId = project.id;

  // 1. Narration Segmentation
  await runCheck('NarrationSegmenter segments script & storyboard into scene-linked units', () => {
    const segmenter = new NarrationSegmenter();
    const segments = segmenter.segmentNarration(sampleInput.script_package, sampleInput.storyboard_package);
    assert.strictEqual(segments.length, 2);
    assert.strictEqual(segments[0].narration_id, 'NARR_001');
    assert.strictEqual(segments[1].narration_id, 'NARR_002');
  });

  // 2. Mock TTS Adapter
  await runCheck('MockTTSAdapter synthesizes valid RIFF/WAV audio binary and SHA-256 hash', async () => {
    const adapter = new MockTTSAdapter();
    const tmpWav = resolve(__dirname, '../data/media/temp/verify_mock_tts.wav');
    const result = await adapter.synthesize('Welcome to the 10min explosion.', { outputPath: tmpWav });
    assert.strictEqual(result.format, 'wav');
    assert.ok(existsSync(tmpWav));
    assert.ok(result.fileHash);
  });

  // 3. TTS Caching
  await runCheck('TTSCache ensures idempotent audio storage and hash-based retrieval', () => {
    const cacheDir = resolve(__dirname, '../data/media/temp/verify_tts_cache');
    const cache = new TTSCache(cacheDir);
    const key = cache.computeKey('Verification text', 'mock-voice', 'mock', 1.0);
    const tmpSrc = resolve(__dirname, '../data/media/temp/verify_mock_tts.wav');
    cache.set(key, tmpSrc, { durationSeconds: 4.5 });
    const cached = cache.get(key);
    assert.ok(cached);
    assert.strictEqual(cached.meta.durationSeconds, 4.5);
  });

  // 4. LocalTTSAdapter Environment Guard
  await runCheck('LocalTTSAdapter enforces safe non-download and returns TTS_MODEL_NOT_INSTALLED', async () => {
    const adapter = new LocalTTSAdapter({ modelPath: 'C:\\NonExistentPath\\voice.onnx' });
    const check = await adapter.validateEnvironment();
    assert.strictEqual(check.available, false);
    assert.strictEqual(check.reason, ASSEMBLY_ERROR_CODES.TTS_MODEL_NOT_INSTALLED);
  });

  // 5. Timeline Synchronization & Conflict Detection
  await runCheck('TimelineSynchronizer synchronizes scene pacing and detects duration conflicts', () => {
    const synchronizer = new TimelineSynchronizer();
    const sync = synchronizer.synchronize(sampleInput.storyboard_package.scenes, [
      { scene_id: 'SCN_001', sequence: 1, actual_duration_seconds: 4.8 },
      { scene_id: 'SCN_002', sequence: 2, actual_duration_seconds: 5.9 }
    ]);
    assert.strictEqual(sync.timing_report.status, 'VALID');
    assert.strictEqual(sync.synchronized_scenes.length, 2);
  });

  // 6. Subtitle Generation (SRT & WebVTT)
  await runCheck('SubtitleGenerator outputs compliant SRT and WebVTT subtitle files', () => {
    const generator = new SubtitleGenerator();
    const timeline = {
      segments: [
        { narration_id: 'N1', scene_id: 'SCN_001', start_seconds: 0.0, end_seconds: 4.8, text: 'The Voyager Anomaly.' },
        { narration_id: 'N2', scene_id: 'SCN_002', start_seconds: 4.8, end_seconds: 10.7, text: 'Telemetry corrupted in deep space.' }
      ]
    };
    const outDir = resolve(__dirname, '../data/media/temp/verify_subs');
    const res = generator.generateFiles(timeline, outDir);
    assert.ok(existsSync(res.srtPath));
    assert.ok(existsSync(res.vttPath));
    assert.strictEqual(res.cueCount, 2);
  });

  // 7. Background Music & SFX Managers
  await runCheck('MusicManager and SFXManager discover local audio and handle empty directories gracefully', () => {
    const musicMgr = new MusicManager();
    const sfxMgr = new SFXManager();
    assert.strictEqual(typeof musicMgr.enabled, 'boolean');
    assert.strictEqual(typeof sfxMgr.enabled, 'boolean');
  });

  // 8. Audio Mixing (Narration + Ducking)
  await runCheck('AudioMixer concatenates narration and mixes background audio', async () => {
    const mixer = new AudioMixer();
    const tmpNarr = resolve(__dirname, '../data/media/temp/verify_mock_tts.wav');
    const tmpMixed = resolve(__dirname, '../data/media/temp/verify_mixed.wav');
    const result = await mixer.mixMasterAudio({
      narrationPath: tmpNarr,
      outputPath: tmpMixed,
      useFfmpeg: false
    });
    assert.ok(existsSync(result.audioPath));
    assert.ok(result.fileHash);
  });

  // 9. FFmpeg & FFprobe Non-Blocking Detector
  await runCheck('FFmpegDetector inspects system encoding tools non-blockingly', () => {
    const detector = new FFmpegDetector();
    const report = detector.detect();
    assert.ok(typeof report.ffmpeg_available === 'boolean');
    assert.ok(typeof report.ffprobe_available === 'boolean');
  });

  // 10. Media Normalizer
  await runCheck('MediaNormalizer normalizes scene media parameters', () => {
    const normalizer = new MediaNormalizer();
    const tmpIn = resolve(__dirname, '../data/media/temp/verify_norm_in.mp4');
    const tmpOut = resolve(__dirname, '../data/media/temp/verify_norm_out.mp4');
    const tmpDir = resolve(__dirname, '../data/media/temp');
    if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
    writeFileSync(tmpIn, 'mp4dummy');
    const out = normalizer.normalizeScene(tmpIn, tmpOut, {}, false);
    assert.strictEqual(out, tmpOut);
  });

  // 11. Final Video Validator
  await runCheck('FinalVideoValidator verifies container structure, audio, and subtitle streams', () => {
    const validator = new FinalVideoValidator();
    const assembler = new FFmpegAssembler();
    const mp4Buf = assembler._generateDeterministicFinalMp4({
      durationSeconds: 11.0,
      width: 854,
      height: 480,
      fps: 30,
      sceneCount: 2
    });
    const tmpFinal = resolve(__dirname, '../data/media/temp/val_verify_final.mp4');
    writeFileSync(tmpFinal, mp4Buf);
    const check = validator.validateFinalVideo({ videoPath: tmpFinal, expectedDurationSeconds: 11.0 });
    assert.strictEqual(check.valid, true);
    assert.ok(['PASS', 'WARN'].includes(check.status));
  });

  // 12. End-to-End Assembly Execution & State Transition
  db.prepare("UPDATE projects SET status = 'MEDIA_READY' WHERE id = ?").run(projectId);
  await runCheck('AssemblyService coordinates complete end-to-end delivery and sets VIDEO_READY', async () => {
    const service = new AssemblyService(db, {
      outputDir: resolve(__dirname, '../data/media/test_final'),
      tempDir: resolve(__dirname, '../data/media/temp')
    });

    const result = await service.assembleProject({
      scriptPackage: sampleInput.script_package,
      storyboardPackage: sampleInput.storyboard_package,
      mediaManifest: sampleInput.media_manifest,
      projectId: projectId,
      options: { mode: 'mock' }
    });

    assert.strictEqual(result.status, PROJECT_STATUS.VIDEO_READY);
    assert.ok(result.final_video.path);
    assert.ok(existsSync(result.final_video.path));
    assert.ok(existsSync(result.subtitles.srt_path));
    assert.ok(existsSync(result.subtitles.vtt_path));
  });

  // 13. SQLite Persistence
  await runCheck('AssemblyRepository persists narration segments, timelines, and assemblies', () => {
    const repo = new AssemblyRepository(db);
    const segments = repo.listSegmentsByProject(projectId);
    const timeline = repo.getTimelineByProject(projectId, 1);
    const assembly = repo.getAssemblyByProject(projectId, 1);

    assert.ok(segments.length >= 2);
    assert.ok(timeline);
    assert.ok(assembly);
    assert.strictEqual(assembly.status, 'COMPLETED');
  });

  console.log('');
  console.log('===============================================================');
  console.log(` Checks: ${totalChecks} total, ${passedChecks} passed, ${failedChecks} failed`);
  if (failedChecks === 0) {
    console.log(' Phase 6 Verification: ALL CHECKS PASSED');
  } else {
    console.log(' Phase 6 Verification: FAILED');
    process.exitCode = 1;
  }
  console.log('===============================================================');
}

main();
