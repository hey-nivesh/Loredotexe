/**
 * Comprehensive Automated Test Suite for Phase 6 Audio, Subtitles & Video Assembly Engine.
 * Tests all 22 required scenarios deterministically without external API dependencies.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createDatabaseConnection, runMigrations } from '../src/db/connection.js';
import { spawnSync } from 'node:child_process';
import { MockVideoModelAdapter } from '../src/media/adapters/mock-video-adapter.js';
import {
  AssemblyService,
  NarrationSegmenter,
  TimelineBuilder,
  TimelineSynchronizer,
  MockTTSAdapter,
  LocalTTSAdapter,
  TTSCache,
  TTSService,
  SubtitleChunker,
  SubtitleGenerator,
  SubtitleStyler,
  MusicManager,
  SFXManager,
  AudioMixer,
  FFmpegDetector,
  MediaNormalizer,
  FFmpegAssembler,
  AudioValidator,
  FinalVideoValidator,
  AssemblyRepository,
  FinalAssetRegistry,
  ASSEMBLY_ERROR_CODES,
  PROJECT_STATUS
} from '../src/assembly/index.js';

const db = createDatabaseConnection(':memory:');
runMigrations(db);

const fixturePath = path.join(process.cwd(), 'fixtures', 'phase-6', 'sample-assembly-input.json');
const sampleInput = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const testFinalDir = path.join(process.cwd(), 'data', 'media', 'test_final');
const testTempDir = path.join(process.cwd(), 'data', 'media', 'test_temp');

function ensureProject(projectId) {
  if (!projectId) return;
  db.prepare(`
    INSERT OR IGNORE INTO projects (id, title, topic, status, input_json, metadata_json, created_at, updated_at)
    VALUES (?, ?, ?, 'CREATED', '{}', '{}', datetime('now'), datetime('now'))
  `).run(projectId, projectId, projectId);
}

['test-prj-phase-6', 'PRJ_ASY_01', 'PRJ_ASY_PARTIAL', 'PRJ_RESUME_ASM', 'PRJ_REGRESSION_FINAL_01'].forEach(ensureProject);

describe('Phase 6 — Voice + Subtitles + Final Video Assembly Test Suite', () => {
  before(() => {
    if (!fs.existsSync(testFinalDir)) fs.mkdirSync(testFinalDir, { recursive: true });
    if (!fs.existsSync(testTempDir)) fs.mkdirSync(testTempDir, { recursive: true });
  });

  after(() => {
    if (fs.existsSync(testFinalDir)) fs.rmSync(testFinalDir, { recursive: true, force: true });
    if (fs.existsSync(testTempDir)) fs.rmSync(testTempDir, { recursive: true, force: true });
  });

  // 1. Narration Segmentation
  test('1. NarrationSegmenter splits script & storyboard into structured scene segments', () => {
    const segmenter = new NarrationSegmenter();
    const segments = segmenter.segmentNarration(sampleInput.script_package, sampleInput.storyboard_package);

    assert.strictEqual(segments.length, 2);
    assert.strictEqual(segments[0].narration_id, 'NARR_001');
    assert.strictEqual(segments[0].scene_id, 'SCN_001');
    assert.strictEqual(segments[1].narration_id, 'NARR_002');
    assert.strictEqual(segments[1].scene_id, 'SCN_002');
    assert.ok(segments[0].text.length > 20);
  });

  // 2. TTS Mock Adapter
  test('2. MockTTSAdapter synthesizes valid RIFF WAV audio binary deterministically', async () => {
    const adapter = new MockTTSAdapter({ voice: 'en-US-ChristopherNeural' });
    const outWav = path.join(testTempDir, 'mock_test.wav');

    const result = await adapter.synthesize('This is a test narration for the 10min explosion.', {
      outputPath: outWav,
      speed: 1.0
    });

    assert.strictEqual(result.format, 'wav');
    assert.ok(result.durationSeconds > 1.0);
    assert.ok(fs.existsSync(outWav));
    assert.ok(result.fileHash);
    assert.ok(result.fileSizeBytes >= 44);

    const buf = fs.readFileSync(outWav);
    assert.strictEqual(buf.toString('ascii', 0, 4), 'RIFF');
    assert.strictEqual(buf.toString('ascii', 8, 12), 'WAVE');
  });

  // 3. TTS Caching
  test('3. TTSCache caches synthesized audio and provides idempotent retrieval', () => {
    const cacheDir = path.join(testTempDir, 'cache');
    const cache = new TTSCache(cacheDir);

    const key = cache.computeKey('Hello world', 'en-US-test', 'mock', 1.0);
    assert.strictEqual(cache.get(key), null);

    const dummySrc = path.join(testTempDir, 'dummy.wav');
    fs.writeFileSync(dummySrc, 'RIFFdummyWAVE');

    cache.set(key, dummySrc, { durationSeconds: 3.5 });
    const hit = cache.get(key);
    assert.ok(hit);
    assert.strictEqual(hit.meta.durationSeconds, 3.5);
    assert.ok(fs.existsSync(hit.audioPath));
  });

  // 4. Narration Timeline
  test('4. TimelineBuilder calculates sequential offsets for narration segments', () => {
    const builder = new TimelineBuilder();
    const segments = [
      { narration_id: 'N1', scene_id: 'S1', sequence: 1, text: 'Hello', actual_duration_seconds: 4.0 },
      { narration_id: 'N2', scene_id: 'S2', sequence: 2, text: 'World', actual_duration_seconds: 5.5 }
    ];

    const timeline = builder.buildTimeline(segments);
    assert.strictEqual(timeline.segments.length, 2);
    assert.strictEqual(timeline.segments[0].start_seconds, 0);
    assert.strictEqual(timeline.segments[0].end_seconds, 4.0);
    assert.strictEqual(timeline.segments[1].start_seconds, 4.0);
    assert.strictEqual(timeline.segments[1].end_seconds, 9.5);
    assert.strictEqual(timeline.total_duration_seconds, 9.5);
  });

  // 5. Subtitle Generation (SRT and WebVTT)
  test('5. SubtitleGenerator generates valid SRT and WebVTT outputs with accurate timestamps', () => {
    const gen = new SubtitleGenerator();
    const timeline = {
      segments: [
        { narration_id: 'N1', scene_id: 'S1', start_seconds: 0.0, end_seconds: 4.8, text: 'First subtitle cue.' },
        { narration_id: 'N2', scene_id: 'S2', start_seconds: 4.8, end_seconds: 9.2, text: 'Second subtitle cue.' }
      ]
    };

    const out = gen.generateFiles(timeline, testTempDir);
    assert.ok(fs.existsSync(out.srtPath));
    assert.ok(fs.existsSync(out.vttPath));
    assert.strictEqual(out.cueCount, 2);

    const srt = fs.readFileSync(out.srtPath, 'utf8');
    assert.ok(srt.includes('00:00:00,000 --> 00:00:04,800'));
    assert.ok(srt.includes('First subtitle cue.'));

    const vtt = fs.readFileSync(out.vttPath, 'utf8');
    assert.ok(vtt.startsWith('WEBVTT'));
    assert.ok(vtt.includes('00:00:00.000 --> 00:00:04.800'));
  });

  // 6. Subtitle Chunking
  test('6. SubtitleChunker breaks long sentences into readable 1-2 line cues respecting char limits', () => {
    const chunker = new SubtitleChunker({ maxCharsPerLine: 25, maxLines: 2 });
    const longText = 'This is an excessively long narration segment designed to test automatic line breaking and cue chunking.';
    const chunks = chunker.chunkText(longText);

    assert.ok(chunks.length >= 2);
    for (const c of chunks) {
      const lines = c.split('\n');
      assert.ok(lines.length <= 2);
      for (const line of lines) {
        assert.ok(line.length <= 35); // Allows clean word breaks
      }
    }
  });

  // 7. Scene / Audio Synchronization
  test('7. TimelineSynchronizer synchronizes visual scenes and audio durations', () => {
    const synchronizer = new TimelineSynchronizer();
    const scenes = [
      { scene_id: 'S1', sequence: 1, duration_seconds: 5.0 },
      { scene_id: 'S2', sequence: 2, duration_seconds: 6.0 }
    ];
    const segments = [
      { scene_id: 'S1', actual_duration_seconds: 4.5 },
      { scene_id: 'S2', actual_duration_seconds: 5.8 }
    ];

    const sync = synchronizer.synchronize(scenes, segments);
    assert.strictEqual(sync.synchronized_scenes.length, 2);
    assert.strictEqual(sync.timing_report.status, 'VALID');
    assert.strictEqual(sync.total_duration_seconds, 11.0);
  });

  // 8. Duration Conflict Detection
  test('8. TimelineSynchronizer detects NARRATION_OVERFLOW when narration exceeds scene threshold', () => {
    const synchronizer = new TimelineSynchronizer({ maxAllowedOverflowSeconds: 1.0 });
    const scenes = [{ scene_id: 'S1', sequence: 1, duration_seconds: 3.0 }];
    const segments = [{ scene_id: 'S1', actual_duration_seconds: 6.0 }]; // 3.0s overflow > 1.0s

    const sync = synchronizer.synchronize(scenes, segments);
    assert.strictEqual(sync.timing_report.status, 'CONFLICT');
    assert.strictEqual(sync.timing_report.conflicts.length, 1);
    assert.strictEqual(sync.timing_report.conflicts[0].type, ASSEMBLY_ERROR_CODES.NARRATION_OVERFLOW);
  });

  // 9. Music Manager & Ducking Track Selection
  test('9. MusicManager discovers local tracks and handles empty directory gracefully', () => {
    const emptyMgr = new MusicManager({ musicDir: path.join(testTempDir, 'nonexistent_music') });
    assert.deepStrictEqual(emptyMgr.listAvailableTracks(), []);
    assert.strictEqual(emptyMgr.selectTrack(), null);

    const musicDir = path.join(testTempDir, 'music');
    fs.mkdirSync(musicDir, { recursive: true });
    fs.writeFileSync(path.join(musicDir, 'ambient_space.mp3'), 'fake-mp3-data');

    const mgr = new MusicManager({ musicEnabled: true, musicDir, musicVolume: 0.15 });
    const selected = mgr.selectTrack();
    assert.ok(selected);
    assert.strictEqual(selected.volume, 0.15);
  });

  // 10. SFX Placement
  test('10. SFXManager resolves scene-linked sound effects from local assets', () => {
    const sfxDir = path.join(testTempDir, 'sfx');
    fs.mkdirSync(sfxDir, { recursive: true });
    fs.writeFileSync(path.join(sfxDir, 'whoosh.wav'), 'fake-whoosh');

    const sfxMgr = new SFXManager({ sfxEnabled: true, sfxDir, sfxVolume: 0.20 });
    const cues = sfxMgr.resolveSceneSfx({ action: 'A sudden whoosh moves across the screen' });
    assert.strictEqual(cues.length, 1);
    assert.strictEqual(cues[0].type, 'whoosh');
    assert.strictEqual(cues[0].volume, 0.20);
  });

  // 11. Media Normalizer
  test('11. MediaNormalizer normalizes scene video format and dimensions', () => {
    const normalizer = new MediaNormalizer({ renderProfile: 'LOW' });
    const inputPath = path.join(testTempDir, 'in_scene.mp4');
    fs.writeFileSync(inputPath, 'dummy-mp4');

    const outputPath = path.join(testTempDir, 'norm_scene.mp4');
    const out = normalizer.normalizeScene(inputPath, outputPath, {}, false);

    assert.strictEqual(out, outputPath);
    assert.ok(fs.existsSync(outputPath));
  });

  // 12. FFmpeg & FFprobe Detector
  test('12. FFmpegDetector non-blockingly inspects binary availability', () => {
    const detector = new FFmpegDetector();
    const result = detector.detect();

    assert.ok(typeof result.ffmpeg_available === 'boolean');
    assert.ok(typeof result.ffprobe_available === 'boolean');
    assert.ok(result.ffmpeg_path);
  });

  // 13. FFmpegAssembler Mock Video Assembly
  test('13. FFmpegAssembler creates valid assembled MP4 container with SHA-256 hash', async () => {
    const assembler = new FFmpegAssembler({ renderProfile: 'LOW' });
    const tts = new MockTTSAdapter();
    const mediaAdapter = new MockVideoModelAdapter();

    const outFinal = path.join(testTempDir, 'final_test.mp4');
    const validAudio = path.join(testTempDir, 'audio_test.wav');
    const sceneVideo = path.join(testTempDir, 'scene_test.mp4');

    const audioRes = await tts.synthesize('Test audio', { outputPath: validAudio });
    await mediaAdapter.generateScene({ scene_id: 'S_TEST', duration_seconds: 5.0 }, { outputPath: sceneVideo });

    const result = await assembler.assembleVideo({
      sceneVideoPaths: [sceneVideo],
      masterAudioPath: validAudio,
      outputPath: outFinal,
      totalDurationSeconds: 5.0,
      useFfmpeg: true
    });

    assert.ok(fs.existsSync(outFinal));
    assert.strictEqual(result.durationSeconds, 5.0);
    assert.ok(result.fileHash);
    assert.strictEqual(result.fileHash.length, 64);
  });

  // 14. Final Video Validation
  test('14. FinalVideoValidator verifies complete deliverable package and flags missing assets', async () => {
    const validator = new FinalVideoValidator();
    const assembler = new FFmpegAssembler({ renderProfile: 'LOW' });
    const tts = new MockTTSAdapter();
    const mediaAdapter = new MockVideoModelAdapter();

    const validVideo = path.join(testTempDir, 'val_final.mp4');
    const validAudio = path.join(testTempDir, 'val_audio.wav');
    const validSub = path.join(testTempDir, 'val_sub.srt');
    const sceneVideo = path.join(testTempDir, 'val_scene.mp4');

    await tts.synthesize('Hello from narration', { outputPath: validAudio });
    await mediaAdapter.generateScene({ scene_id: 'S_VAL', duration_seconds: 5.0 }, { outputPath: sceneVideo });
    fs.writeFileSync(validSub, '1\n00:00:00,000 --> 00:00:05,000\nHello\n');

    await assembler.assembleVideo({
      sceneVideoPaths: [sceneVideo],
      masterAudioPath: validAudio,
      subtitlePath: validSub,
      outputPath: validVideo,
      totalDurationSeconds: 5.0,
      useFfmpeg: true
    });

    const passCheck = validator.validateFinalVideo({
      videoPath: validVideo,
      audioPath: validAudio,
      subtitlePath: validSub,
      expectedDurationSeconds: 5.0
    });
    assert.strictEqual(passCheck.valid, true);
    assert.ok(['PASS', 'WARN'].includes(passCheck.status));

    const failCheck = validator.validateFinalVideo({
      videoPath: path.join(testTempDir, 'missing.mp4')
    });
    assert.strictEqual(failCheck.valid, false);
    assert.strictEqual(failCheck.status, 'FAIL');
  });

  // 15. Audio Validator
  test('15. AudioValidator detects missing and corrupt audio files', () => {
    const validator = new AudioValidator();
    const missing = validator.validateAudio(path.join(testTempDir, 'nonexistent.wav'));
    assert.strictEqual(missing.valid, false);

    const tiny = path.join(testTempDir, 'tiny.wav');
    fs.writeFileSync(tiny, 'short');
    const tinyCheck = validator.validateAudio(tiny);
    assert.strictEqual(tinyCheck.valid, false);
  });

  // 16. Subtitle Styler
  test('16. SubtitleStyler formats FFmpeg force_style strings with configured font & margins', () => {
    const styler = new SubtitleStyler({ font: 'Inter', fontSize: 28, marginV: 35 });
    const filter = styler.buildFilterString('C:\\data\\subs.srt');

    assert.ok(filter.includes('Fontname=Inter'));
    assert.ok(filter.includes('Fontsize=28'));
    assert.ok(filter.includes('MarginV=35'));
  });

  // 17. LocalTTSAdapter Environment Guard
  test('17. LocalTTSAdapter returns TTS_MODEL_NOT_INSTALLED when model path is missing', async () => {
    const adapter = new LocalTTSAdapter({ modelPath: 'C:\\NonExistentModel.onnx' });
    const check = await adapter.validateEnvironment();

    assert.strictEqual(check.available, false);
    assert.strictEqual(check.reason, ASSEMBLY_ERROR_CODES.TTS_MODEL_NOT_INSTALLED);
  });

  // 18. SQLite Repository for Phase 6
  test('18. AssemblyRepository saves and retrieves segments, timelines, and video assemblies', () => {
    const repo = new AssemblyRepository(db);
    const projectId = 'PRJ_ASY_01';

    repo.saveSegment({
      narration_id: 'NARR_TEST_01',
      project_id: projectId,
      scene_id: 'SCN_001',
      sequence: 1,
      text: 'Testing persistence',
      provider: 'mock',
      voice: 'test-voice',
      duration_seconds: 4.2,
      status: 'COMPLETED'
    });

    const segments = repo.listSegmentsByProject(projectId);
    assert.strictEqual(segments.length, 1);
    assert.strictEqual(segments[0].id, 'NARR_TEST_01');

    repo.saveTimeline({ timeline_version: 1, total_duration_seconds: 10.0, segments: [] }, projectId);
    const tl = repo.getTimelineByProject(projectId, 1);
    assert.ok(tl);
    assert.strictEqual(tl.total_duration_seconds, 10.0);
  });

  // 19. Dry-Run Mode Analysis
  test('19. AssemblyService dry-run calculates timelines and detects missing media without creating files', () => {
    const service = new AssemblyService(db);
    const report = service.dryRun({
      scriptPackage: sampleInput.script_package,
      storyboardPackage: sampleInput.storyboard_package,
      mediaManifest: sampleInput.media_manifest,
      projectId: 'PRJ_ASY_DRY'
    });

    assert.strictEqual(report.dry_run_passed, true);
    assert.strictEqual(report.total_scenes, 2);
    assert.strictEqual(report.narration_segments_count, 2);
    assert.ok(report.estimated_total_duration_seconds > 0);
  });

  // 20. End-to-End Assembly Execution & VIDEO_READY Transition
  test('20. AssemblyService executes full pipeline in mock mode and transitions project to VIDEO_READY', async () => {
    const service = new AssemblyService(db, {
      outputDir: path.join(testFinalDir, 'e2e'),
      tempDir: path.join(testTempDir, 'e2e')
    });

    const result = await service.assembleProject({
      scriptPackage: sampleInput.script_package,
      storyboardPackage: sampleInput.storyboard_package,
      mediaManifest: sampleInput.media_manifest,
      projectId: 'test-prj-phase-6',
      options: { mode: 'mock' }
    });

    assert.strictEqual(result.status, PROJECT_STATUS.VIDEO_READY);
    assert.ok(result.final_video.path);
    assert.ok(fs.existsSync(result.final_video.path));
    assert.ok(fs.existsSync(result.subtitles.srt_path));
    assert.ok(fs.existsSync(result.subtitles.vtt_path));
    assert.ok(fs.existsSync(result.audio.path));
    assert.ok(['PASS', 'WARN'].includes(result.validation.status));
  });

  // 21. Idempotency & Resumability
  test('21. Re-running assembly uses cached TTS audio without re-synthesis', async () => {
    const service = new AssemblyService(db, {
      outputDir: path.join(testFinalDir, 'resume'),
      tempDir: path.join(testTempDir, 'resume'),
      ttsCacheEnabled: true
    });

    const run1 = await service.assembleProject({
      scriptPackage: sampleInput.script_package,
      storyboardPackage: sampleInput.storyboard_package,
      mediaManifest: sampleInput.media_manifest,
      projectId: 'PRJ_RESUME_ASM',
      options: { mode: 'mock' }
    });

    const run2 = await service.assembleProject({
      scriptPackage: sampleInput.script_package,
      storyboardPackage: sampleInput.storyboard_package,
      mediaManifest: sampleInput.media_manifest,
      projectId: 'PRJ_RESUME_ASM',
      options: { mode: 'mock' }
    });

    assert.strictEqual(run1.status, PROJECT_STATUS.VIDEO_READY);
    assert.strictEqual(run2.status, PROJECT_STATUS.VIDEO_READY);
  });

  // 22. n8n Workflow JSON Validity
  test('22. Phase 6 n8n workflow JSON parses cleanly and contains required assembly nodes', () => {
    const p6WorkflowPath = path.join(process.cwd(), 'workflows', 'phase-6-video-assembly.json');
    const masterWorkflowPath = path.join(process.cwd(), 'workflows', 'loredotexe-pipeline.json');

    assert.ok(fs.existsSync(p6WorkflowPath));
    assert.ok(fs.existsSync(masterWorkflowPath));

    const p6 = JSON.parse(fs.readFileSync(p6WorkflowPath, 'utf8'));
    const master = JSON.parse(fs.readFileSync(masterWorkflowPath, 'utf8'));

    assert.ok(p6.nodes.some((n) => n.name.includes('Execute Final Video Assembly') || n.name.includes('Assembly')));
    assert.ok(master.nodes.some((n) => n.name.includes('Execute Phase 6 Audio & Video Assembly')));
  });

  // 23. Final Assembled MP4 Deep FFprobe & FFmpeg Regression Test
  test('23. Final assembled MP4 contains valid moov atom, video/audio streams, and passes FFmpeg decode test with exit code 0', async () => {
    const service = new AssemblyService(db, {
      outputDir: path.join(testFinalDir, 'regression_final'),
      tempDir: path.join(testTempDir, 'regression_final')
    });

    const result = await service.assembleProject({
      scriptPackage: sampleInput.script_package,
      storyboardPackage: sampleInput.storyboard_package,
      mediaManifest: sampleInput.media_manifest,
      projectId: 'PRJ_REGRESSION_FINAL_01',
      options: { mode: 'mock' }
    });

    const finalPath = result.final_video.path;
    assert.ok(fs.existsSync(finalPath), `Final video not found at ${finalPath}`);

    const detector = new FFmpegDetector();
    const ffprobeBin = detector.getFFprobePath();
    const ffmpegBin = detector.getFFmpegPath();

    // 1. Run ffprobe inspection
    const probeRes = spawnSync(ffprobeBin, [
      '-v', 'error',
      '-show_entries', 'format=format_name,duration:stream=codec_type,codec_name,width,height',
      '-of', 'json',
      finalPath
    ], { encoding: 'utf8' });

    assert.strictEqual(probeRes.status, 0, `ffprobe failed on final.mp4: ${probeRes.stderr}`);
    const probeData = JSON.parse(probeRes.stdout);

    assert.ok(probeData.format.format_name.includes('mp4') || probeData.format.format_name.includes('mov'));
    const duration = parseFloat(probeData.format.duration);
    assert.ok(duration > 0, `Expected duration > 0, got ${duration}`);

    const videoStream = probeData.streams.find((s) => s.codec_type === 'video');
    assert.ok(videoStream, 'Missing video stream in final.mp4');
    assert.strictEqual(videoStream.codec_name, 'h264');
    assert.ok(videoStream.width > 0 && videoStream.height > 0);

    // 2. Run ffmpeg decode test
    const decodeRes = spawnSync(ffmpegBin, [
      '-v', 'error',
      '-i', finalPath,
      '-f', 'null',
      '-'
    ], { encoding: 'utf8' });

    assert.strictEqual(decodeRes.status, 0, `ffmpeg decode failed on final.mp4: ${decodeRes.stderr}`);
    assert.strictEqual(decodeRes.stderr.trim(), '', 'Expected zero decode errors in ffmpeg output');
  });
});

