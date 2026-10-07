/**
 * Media Generation Planner for Phase 5 Media Generation Engine.
 * Converts Phase 4 Storyboard Package into an idempotent, resumable generation job plan.
 */

import { createHash, randomUUID } from 'node:crypto';
import { ScenePromptCompiler } from '../compiler/scene-prompt-compiler.js';
import { AssetRegistry } from '../storage/asset-registry.js';
import { JOB_STATUSES } from '../schema/media-schema.js';
import { validateStoryboardPackage } from '../../storyboard/schema/storyboard-schema.js';

export class MediaGenerationPlanner {
  /**
   * @param {object} options
   * @param {ScenePromptCompiler} [options.promptCompiler]
   * @param {AssetRegistry} [options.assetRegistry]
   */
  constructor(options = {}) {
    this.promptCompiler = options.promptCompiler || new ScenePromptCompiler();
    this.assetRegistry = options.assetRegistry || new AssetRegistry();
  }

  /**
   * Creates an idempotent job execution plan for a storyboard package.
   * @param {object} storyboardPackage Phase 4 canonical storyboard package
   * @param {object} [options={}] Generation options (provider, model, force_regenerate, etc.)
   * @returns {object} Structured Generation Plan
   */
  createPlan(storyboardPackage, options = {}) {
    const validatedPkg = validateStoryboardPackage(storyboardPackage);
    const projectId = options.projectId || validatedPkg.project_id;
    const storyboardVersion = validatedPkg.storyboard_version || 1;
    const generationVersion = options.generationVersion || 1;
    const provider = options.provider || 'mock';
    const model = options.model || 'mock-video';
    const forceRegenerate = options.force_regenerate === true;

    const bibles = {
      characterBible: validatedPkg.character_bible,
      locationBible: validatedPkg.location_bible,
      propBible: validatedPkg.prop_bible,
      styleBible: validatedPkg.visual_style
    };

    const jobs = [];
    let reusedCount = 0;
    let pendingCount = 0;
    let totalEstimatedDurationSeconds = 0;

    for (const scene of validatedPkg.scenes) {
      // 1. Compile GenerationRequest
      const request = this.promptCompiler.compileScene(scene, bibles);

      // 2. Compute deterministic prompt hash
      const promptHash = createHash('sha256')
        .update(request.prompt + (request.negative_prompt || ''))
        .digest('hex');

      // 3. Compute deterministic generation key
      const generationKey = createHash('sha256')
        .update(`${projectId}:${scene.scene_id}:v${storyboardVersion}:${model}:${promptHash}`)
        .digest('hex');

      totalEstimatedDurationSeconds += request.duration_seconds || 5.0;

      // 4. Idempotency Check: Look for existing valid asset
      const existingAsset = !forceRegenerate
        ? this.assetRegistry.findExistingValidAsset(projectId, scene.scene_id, promptHash)
        : null;

      const jobId = `JOB_${scene.scene_id}_v${generationVersion}_${generationKey.slice(0, 8)}`;

      if (existingAsset) {
        reusedCount++;
        jobs.push({
          id: jobId,
          project_id: projectId,
          scene_id: scene.scene_id,
          sequence: scene.sequence,
          storyboard_version: storyboardVersion,
          generation_version: generationVersion,
          provider,
          model,
          status: JOB_STATUSES.COMPLETED,
          attempt: 1,
          max_retries: options.maxRetries || 2,
          prompt_hash: promptHash,
          generation_key: generationKey,
          request,
          reused: true,
          result: {
            output_path: existingAsset.filePath,
            file_hash: existingAsset.fileHash,
            duration: existingAsset.durationSeconds,
            asset_metadata: existingAsset.metadata
          },
          created_at: new Date().toISOString(),
          completed_at: new Date().toISOString()
        });
      } else {
        pendingCount++;
        jobs.push({
          id: jobId,
          project_id: projectId,
          scene_id: scene.scene_id,
          sequence: scene.sequence,
          storyboard_version: storyboardVersion,
          generation_version: generationVersion,
          provider,
          model,
          status: JOB_STATUSES.QUEUED,
          attempt: 0,
          max_retries: options.maxRetries || 2,
          prompt_hash: promptHash,
          generation_key: generationKey,
          request,
          reused: false,
          result: null,
          error: null,
          created_at: new Date().toISOString(),
          started_at: null,
          completed_at: null
        });
      }
    }

    return {
      project_id: projectId,
      storyboard_version: storyboardVersion,
      generation_version: generationVersion,
      provider,
      model,
      total_scenes: validatedPkg.scenes.length,
      reused_scenes_count: reusedCount,
      pending_scenes_count: pendingCount,
      total_estimated_video_duration_seconds: totalEstimatedDurationSeconds,
      jobs
    };
  }
}
