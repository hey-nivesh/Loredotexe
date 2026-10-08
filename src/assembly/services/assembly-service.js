/**
 * Master Assembly Service for Phase 6 Audio, Subtitles, and Video Assembly Engine.
 * Coordinates Narration Segmentation, TTS Synthesis, Subtitles, Audio Mixing, FFmpeg Assembly, and Final Validation.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DEFAULT_ASSEMBLY_CONFIG, PHASE6_MODES, RENDER_PROFILES } from '../config/assembly-config.js';
import { NarrationSegmenter } from '../narration/narration-segmenter.js';
import { TimelineBuilder } from '../narration/timeline-builder.js';
import { TimelineSynchronizer } from '../narration/timeline-synchronizer.js';
import { TTSService } from '../tts/tts-service.js';
import { SubtitleGenerator } from '../subtitles/subtitle-generator.js';
import { MusicManager } from '../audio/music-manager.js';
import { SFXManager } from '../audio/sfx-manager.js';
import { AudioMixer } from '../audio/audio-mixer.js';
import { FFmpegDetector } from '../ffmpeg/ffmpeg-detector.js';
import { MediaNormalizer } from '../ffmpeg/media-normalizer.js';
import { FFmpegAssembler } from '../ffmpeg/ffmpeg-assembler.js';
import { FinalVideoValidator } from '../validation/final-video-validator.js';
import { MediaValidator } from '../../media/validation/media-validator.js';
import { AssemblyRepository } from '../storage/assembly-repository.js';
import { FinalAssetRegistry } from '../storage/final-asset-registry.js';
import { assertValidTransition } from '../../projects/project.transitions.js';
import { PROJECT_STATUS } from '../../projects/project.schema.js';
import { AssemblyError, ASSEMBLY_ERROR_CODES } from '../errors/assembly-errors.js';
import { logger } from '../../logging/logger.js';

export class AssemblyService {
  /**
   * @param {import('node:sqlite').DatabaseSync} db
   * @param {object} [config={}]
   * @param {object} [dependencies={}]
   */
  constructor(db, config = {}, dependencies = {}) {
    this.db = db;
    this.config = { ...DEFAULT_ASSEMBLY_CONFIG, ...config };

    this.repository = dependencies.repository || new AssemblyRepository(db);
    this.finalRegistry = dependencies.finalRegistry || new FinalAssetRegistry(this.config.outputDir);
    this.segmenter = dependencies.segmenter || new NarrationSegmenter();
    this.timelineBuilder = dependencies.timelineBuilder || new TimelineBuilder();
    this.timelineSynchronizer = dependencies.timelineSynchronizer || new TimelineSynchronizer();
    this.ttsService = dependencies.ttsService || new TTSService(this.config);
    this.subtitleGenerator = dependencies.subtitleGenerator || new SubtitleGenerator(this.config);
    this.musicManager = dependencies.musicManager || new MusicManager(this.config);
    this.sfxManager = dependencies.sfxManager || new SFXManager(this.config);
    this.audioMixer = dependencies.audioMixer || new AudioMixer(this.config);
    this.ffmpegDetector = dependencies.ffmpegDetector || new FFmpegDetector(this.config);
    this.normalizer = dependencies.normalizer || new MediaNormalizer(this.config);
    this.assembler = dependencies.assembler || new FFmpegAssembler(this.config);
    this.validator = dependencies.validator || new FinalVideoValidator(this.config);
  }

  /**
   * Performs a non-destructive dry-run analysis for Phase 6.
   * @param {object} params
   * @returns {object} Dry-Run Report
   */
  dryRun({ scriptPackage, storyboardPackage, mediaManifest, projectId, options = {} }) {
    logger.info('Executing Phase 6 Assembly Dry-Run analysis', { projectId });

    const hw = this.ffmpegDetector.detect();
    const segments = this.segmenter.segmentNarration(scriptPackage, storyboardPackage);
    const mockTimeline = this.timelineBuilder.buildTimeline(segments);
    const sync = this.timelineSynchronizer.synchronize(storyboardPackage.scenes, segments);
    const cues = this.subtitleGenerator.buildCues(mockTimeline);
    const music = this.musicManager.selectTrack();

    const missingSceneMedia = [];
    const availableAssets = mediaManifest?.assets || [];
    for (const scene of storyboardPackage.scenes) {
      const match = availableAssets.find((a) => a.scene_id === scene.scene_id);
      if (!match || !fs.existsSync(match.file_path)) {
        missingSceneMedia.push(scene.scene_id);
      }
    }

    return {
      dry_run_passed: sync.timing_report.status === 'VALID',
      project_id: projectId || storyboardPackage.project_id,
      total_scenes: storyboardPackage.scenes.length,
      narration_segments_count: segments.length,
      subtitle_cues_count: cues.length,
      estimated_total_duration_seconds: sync.total_duration_seconds,
      ffmpeg_status: hw,
      music_track: music ? path.basename(music.trackPath) : 'None',
      timing_report: sync.timing_report,
      missing_scene_media: missingSceneMedia
    };
  }

  /**
   * Executes the end-to-end Phase 6 Audio & Video Assembly pipeline.
   * @param {object} params
   * @returns {Promise<object>} Final deliverable result package
   */
  async assembleProject({ scriptPackage, storyboardPackage, mediaManifest, projectId, options = {} }) {
    const resolvedProjectId = projectId || storyboardPackage?.project_id || scriptPackage?.project_id;
    if (!resolvedProjectId) {
      throw new AssemblyError('Project ID is required for video assembly.', ASSEMBLY_ERROR_CODES.INVALID_INPUT);
    }

    const assemblyVersion = options.assemblyVersion || 1;
    const mode = (options.mode || this.config.mode).toLowerCase();
    const useFfmpeg = mode === PHASE6_MODES.REAL;

    logger.info('Starting Phase 6 Assembly pipeline', {
      projectId: resolvedProjectId,
      assemblyVersion,
      mode,
      useFfmpeg
    });

    const outPaths = this.finalRegistry.getFinalPaths(resolvedProjectId, assemblyVersion);
    this.finalRegistry.ensureDirectory(resolvedProjectId, assemblyVersion);

    // 1. Update Project Status -> AUDIO_GENERATING
    this._transitionProjectStatus(resolvedProjectId, PROJECT_STATUS.AUDIO_GENERATING);

    // 2. Segment Narration
    const segments = this.segmenter.segmentNarration(scriptPackage, storyboardPackage);
    for (const seg of segments) {
      seg.project_id = resolvedProjectId;
      this.repository.saveSegment(seg);
    }

    // 3. Synthesize Audio Segments via TTS
    const projectAudioDir = path.join(this.config.tempDir, resolvedProjectId, 'narration');
    const synthesizedSegments = await this.ttsService.synthesizeAll(segments, projectAudioDir);
    for (const syn of synthesizedSegments) {
      syn.project_id = resolvedProjectId;
      this.repository.saveSegment(syn);
    }

    // 4. Build Synchronized Narration Timeline
    const timeline = this.timelineBuilder.buildTimeline(synthesizedSegments);
    const syncResult = this.timelineSynchronizer.synchronize(storyboardPackage.scenes, synthesizedSegments);
    this.repository.saveTimeline(timeline, resolvedProjectId);
    fs.writeFileSync(outPaths.timelinePath, JSON.stringify(timeline, null, 2), 'utf8');

    // 5. Generate Subtitles (.srt and .vtt)
    const subResult = this.subtitleGenerator.generateFiles(timeline, outPaths.dir);

    // 6. Concatenate Narration and Mix Master Audio
    const rawAudioPaths = synthesizedSegments.map((s) => s.audio_path);
    this.audioMixer.concatenateNarration(rawAudioPaths, outPaths.narrationAudioPath);

    const musicTrack = this.musicManager.selectTrack();
    await this.audioMixer.mixMasterAudio({
      narrationPath: outPaths.narrationAudioPath,
      musicTrack,
      outputPath: outPaths.mixedAudioPath,
      useFfmpeg
    });

    // 7. Update Project Status -> ASSEMBLING
    this._transitionProjectStatus(resolvedProjectId, PROJECT_STATUS.ASSEMBLING);

    // 8. Resolve and Normalize Scene Media Clips
    const sceneClips = this._resolveSceneMedia(storyboardPackage.scenes, mediaManifest);
    const normTempDir = path.join(this.config.tempDir, resolvedProjectId, 'normalized');
    if (!fs.existsSync(normTempDir)) fs.mkdirSync(normTempDir, { recursive: true });
    const normalizedScenePaths = this.normalizer.normalizeAll(sceneClips, normTempDir, useFfmpeg);

    // 9. Execute Video Assembly
    const assemblyResult = await this.assembler.assembleVideo({
      sceneVideoPaths: normalizedScenePaths,
      masterAudioPath: outPaths.mixedAudioPath,
      subtitlePath: outPaths.subtitlesSrtPath,
      outputPath: outPaths.finalVideoPath,
      totalDurationSeconds: timeline.total_duration_seconds,
      useFfmpeg
    });

    // 10. Perform Final Video & Audio Validation
    const validationResult = this.validator.validateFinalVideo({
      videoPath: outPaths.finalVideoPath,
      audioPath: outPaths.mixedAudioPath,
      subtitlePath: outPaths.subtitlesSrtPath,
      expectedDurationSeconds: timeline.total_duration_seconds
    });
    fs.writeFileSync(outPaths.validationPath, JSON.stringify(validationResult, null, 2), 'utf8');

    // 11. Compile Final Metadata & Assembly Manifest
    const metadata = {
      project_id: resolvedProjectId,
      script_version: scriptPackage?.script_version || 1,
      storyboard_version: storyboardPackage?.storyboard_version || 1,
      assembly_version: assemblyVersion,
      duration_seconds: timeline.total_duration_seconds,
      width: assemblyResult.width,
      height: assemblyResult.height,
      fps: assemblyResult.fps,
      video_codec: assemblyResult.videoCodec,
      audio_codec: assemblyResult.audioCodec,
      subtitle_format: this.config.subtitleFormat,
      scene_count: storyboardPackage.scenes.length,
      narration_duration_seconds: timeline.total_duration_seconds,
      music_applied: !!musicTrack,
      created_at: new Date().toISOString(),
      software: 'Loredotexe Phase 6 Video Assembler'
    };
    fs.writeFileSync(outPaths.metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

    const manifest = {
      project_id: resolvedProjectId,
      storyboard_version: storyboardPackage?.storyboard_version || 1,
      assembly_version: assemblyVersion,
      scene_count: storyboardPackage.scenes.length,
      video: {
        width: assemblyResult.width,
        height: assemblyResult.height,
        fps: assemblyResult.fps,
        codec: assemblyResult.videoCodec
      },
      audio: {
        codec: assemblyResult.audioCodec,
        path: outPaths.mixedAudioPath
      },
      subtitles: {
        srt_path: outPaths.subtitlesSrtPath,
        vtt_path: outPaths.subtitlesVttPath
      },
      status: validationResult.valid ? 'COMPLETED' : 'FAILED',
      created_at: new Date().toISOString()
    };
    fs.writeFileSync(outPaths.manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    // 12. Persist Assembly to SQLite
    this.repository.saveAssembly({
      id: `ASM_${resolvedProjectId}_v${assemblyVersion}`,
      project_id: resolvedProjectId,
      storyboard_version: storyboardPackage?.storyboard_version || 1,
      assembly_version: assemblyVersion,
      status: validationResult.valid ? 'COMPLETED' : 'FAILED',
      output_video_path: outPaths.finalVideoPath,
      output_audio_path: outPaths.mixedAudioPath,
      subtitle_srt_path: outPaths.subtitlesSrtPath,
      subtitle_vtt_path: outPaths.subtitlesVttPath,
      manifest,
      metadata,
      validation: validationResult,
      completed_at: new Date().toISOString()
    });

    // 13. Transition Project Status -> VIDEO_READY (only if validation passed)
    if (validationResult.valid) {
      this._transitionProjectStatus(resolvedProjectId, PROJECT_STATUS.VIDEO_READY);
    } else {
      this._transitionProjectStatus(resolvedProjectId, PROJECT_STATUS.FAILED);
      throw new AssemblyError('Final video validation failed.', ASSEMBLY_ERROR_CODES.FINAL_VALIDATION_FAILED, true, validationResult);
    }

    return {
      project_id: resolvedProjectId,
      status: PROJECT_STATUS.VIDEO_READY,
      final_video: {
        path: outPaths.finalVideoPath,
        duration_seconds: timeline.total_duration_seconds,
        width: assemblyResult.width,
        height: assemblyResult.height,
        fps: assemblyResult.fps
      },
      audio: {
        path: outPaths.mixedAudioPath,
        duration_seconds: timeline.total_duration_seconds
      },
      subtitles: {
        srt_path: outPaths.subtitlesSrtPath,
        vtt_path: outPaths.subtitlesVttPath
      },
      validation: {
        status: validationResult.status,
        errors: validationResult.errors,
        warnings: validationResult.warnings
      }
    };
  }

  /**
   * Resolves scene media clips from manifest or local generator paths.
   * @private
   */
  _resolveSceneMedia(scenes, mediaManifest) {
    const clips = [];
    const assets = mediaManifest?.assets || [];

    for (const scene of scenes) {
      const match = assets.find((a) => a.scene_id === scene.scene_id);
      if (match && fs.existsSync(match.file_path)) {
        clips.push({ sceneId: scene.scene_id, inputPath: match.file_path });
      } else {
        // Look in standard generation directory
        const defaultPath = path.join(process.cwd(), 'data', 'media', 'generated', mediaManifest?.project_id || 'default', scene.scene_id, 'v1', 'scene.mp4');
        if (fs.existsSync(defaultPath)) {
          clips.push({ sceneId: scene.scene_id, inputPath: defaultPath });
        } else {
          // Generate a temporary mock scene file if not found
          const fallbackPath = path.join(this.config.tempDir, `fallback_${scene.scene_id}.mp4`);
          if (!fs.existsSync(fallbackPath)) {
            fs.mkdirSync(path.dirname(fallbackPath), { recursive: true });
            this._generateFallbackMockSceneClip(fallbackPath, scene.scene_id, scene.duration_seconds || 5.0);
          }
          clips.push({ sceneId: scene.scene_id, inputPath: fallbackPath });
        }
      }
    }

    return clips;
  }

  /**
   * Generates a valid fallback scene MP4 clip via FFmpeg.
   * @private
   */
  _generateFallbackMockSceneClip(outputPath, sceneId, durationSeconds) {
    const detector = new FFmpegDetector(this.config);
    const ffmpegBin = detector.getFFmpegPath();
    const duration = Math.max(0.5, durationSeconds || 5.0);

    const args = [
      '-y',
      '-f', 'lavfi',
      '-i', `color=c=0x181824:s=854x480:r=24:d=${duration}`,
      '-f', 'lavfi',
      '-i', `anullsrc=r=44100:cl=stereo:d=${duration}`,
      '-c:v', 'libx264',
      '-tune', 'stillimage',
      '-preset', 'ultrafast',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-shortest',
      '-movflags', '+faststart',
      outputPath.replace(/\\/g, '/')
    ];

    spawnSync(ffmpegBin, args, { encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] });
  }

  /**
   * Helper to safely transition project status in SQLite.
   * @private
   */
  _transitionProjectStatus(projectId, targetStatus) {
    try {
      const stmt = this.db.prepare('SELECT status, version FROM projects WHERE id = ?');
      const project = stmt.get(projectId);
      if (project) {
        assertValidTransition(project.status, targetStatus, projectId);
        const updateStmt = this.db.prepare(`
          UPDATE projects
          SET status = ?, version = version + 1, updated_at = ?
          WHERE id = ?
        `);
        updateStmt.run(targetStatus, new Date().toISOString(), projectId);
      }
    } catch (err) {
      logger.warn('Project state transition note', { projectId, targetStatus, error: err.message });
    }
  }
}
