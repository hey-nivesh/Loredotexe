/**
 * Scene Prompt Compiler for Phase 5 Media Generation Engine.
 * Synthesizes Canonical Scene details and Bibles into a focused, highly descriptive GenerationRequest.
 */

import { validateGenerationRequest } from '../schema/media-schema.js';

export class ScenePromptCompiler {
  /**
   * @param {object} [options={}]
   */
  constructor(options = {}) {
    this.defaultNegativePrompt =
      options.defaultNegativePrompt ||
      'blurry, low quality, artifacts, distorted anatomy, morphing limbs, flickering, text watermarks, duplicate frames, bad lighting';
    this.defaultWidth = options.defaultWidth || 832;
    this.defaultHeight = options.defaultHeight || 480;
    this.defaultFps = options.defaultFps || 16;
  }

  /**
   * Compiles a CanonicalScene and visual bibles into a formal GenerationRequest.
   * @param {object} scene Canonical Scene object from Phase 4
   * @param {object} [bibles={}] Visual bibles from Phase 4 storyboard package
   * @returns {object} Validated GenerationRequest
   */
  compileScene(scene, bibles = {}) {
    const characterBible = bibles.characterBible || bibles.character_bible || [];
    const locationBible = bibles.locationBible || bibles.location_bible || [];
    const propBible = bibles.propBible || bibles.prop_bible || [];
    const styleBible = bibles.styleBible || bibles.visual_style || bibles.style || {};

    const continuity = scene.continuity || {};
    const charIds = continuity.characters || [];
    const locId = continuity.location;
    const propIds = continuity.props || [];

    // 1. Resolve character appearance and outfit descriptions
    const charDescriptions = [];
    for (const charId of charIds) {
      const char = characterBible.find((c) => c.character_id === charId || c.id === charId);
      if (char) {
        const desc = char.visual_description || `${char.name} (${char.role || 'key figure'})`;
        const outfit = char.default_outfit || (char.outfits ? char.outfits[0] : null);
        const outfitStr = outfit ? `, wearing ${outfit}` : '';
        charDescriptions.push(`${desc}${outfitStr}`);
      }
    }

    // 2. Resolve location environment
    let locDescription = '';
    if (locId) {
      const loc = locationBible.find((l) => l.location_id === locId || l.id === locId);
      if (loc) {
        locDescription = loc.visual_description || loc.name;
        if (loc.atmosphere) locDescription += `, ${loc.atmosphere}`;
      }
    }

    // 3. Resolve key prop details
    const propDescriptions = [];
    for (const propId of propIds) {
      const prop = propBible.find((p) => p.prop_id === propId || p.id === propId);
      if (prop) {
        propDescriptions.push(prop.visual_description || prop.name);
      }
    }

    // 4. Resolve camera and lighting specs
    const camera = typeof scene.camera === 'object' ? `${scene.camera.shot_type || 'cinematic medium shot'}, ${scene.camera.movement || 'smooth tracking motion'}` : String(scene.camera || 'cinematic framing');
    const lighting = scene.lighting || 'natural volumetric lighting';
    const action = scene.action || 'subtle character movement in scene';
    const visualPurpose = scene.visual_purpose ? `(${scene.visual_purpose})` : '';

    // 5. Resolve signature channel style
    const styleKeywords = [];
    if (styleBible.name) styleKeywords.push(styleBible.name);
    if (styleBible.color_palette) {
      const pal = Array.isArray(styleBible.color_palette) ? styleBible.color_palette.join(', ') : styleBible.color_palette;
      styleKeywords.push(`color grading: ${pal}`);
    }
    if (styleBible.cinematic_aspects) {
      const ca = Array.isArray(styleBible.cinematic_aspects) ? styleBible.cinematic_aspects.join(', ') : styleBible.cinematic_aspects;
      styleKeywords.push(ca);
    }
    const styleStr = styleKeywords.length > 0 ? styleKeywords.join(', ') : 'The 10min Explosion Signature Style, high detail cinematic';

    // 6. Build prompt components without token bloat
    const promptSegments = [];

    if (scene.visual_prompt) {
      promptSegments.push(scene.visual_prompt);
    } else {
      promptSegments.push(`Action: ${action} ${visualPurpose}`.trim());
      if (charDescriptions.length > 0) {
        promptSegments.push(`Subject: ${charDescriptions.join('; ')}`);
      }
      if (locDescription) {
        promptSegments.push(`Setting: in ${locDescription}`);
      }
      if (propDescriptions.length > 0) {
        promptSegments.push(`Props: ${propDescriptions.join(', ')}`);
      }
    }

    promptSegments.push(`Camera: ${camera}`);
    promptSegments.push(`Lighting: ${lighting}`);
    promptSegments.push(`Style: ${styleStr}`);

    const compiledPrompt = promptSegments.join(' | ');

    const negativePrompt = scene.negative_prompt || this.defaultNegativePrompt;
    const duration = typeof scene.duration_seconds === 'number' && scene.duration_seconds > 0 ? scene.duration_seconds : 5.0;

    const request = {
      scene_id: scene.scene_id,
      prompt: compiledPrompt,
      negative_prompt: negativePrompt,
      width: this.defaultWidth,
      height: this.defaultHeight,
      fps: this.defaultFps,
      duration_seconds: duration,
      seed: scene.seed || null,
      reference_assets: continuity.reference_assets || [],
      model_parameters: {
        visual_type: scene.visual_type || 'cinematic',
        sequence: scene.sequence || 1
      }
    };

    return validateGenerationRequest(request);
  }
}
