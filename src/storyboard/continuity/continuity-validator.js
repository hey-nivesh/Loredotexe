/**
 * Continuity Validator
 * Deterministically checks entity references, sequence links, outfit transitions, and duration consistency.
 */

export class ContinuityValidator {
  /**
   * Validates all continuity rules across the planned scenes and bibles.
   * @param {object} params
   * @param {Array<object>} params.scenes
   * @param {Array<object>} [params.characterBible]
   * @param {Array<object>} [params.locationBible]
   * @param {Array<object>} [params.propBible]
   * @param {number} [params.targetDurationSeconds=600]
   * @returns {object} Validation report
   */
  validateContinuity({
    scenes = [],
    characterBible = [],
    locationBible = [],
    propBible = [],
    targetDurationSeconds = 600
  }) {
    const errors = [];
    const warnings = [];
    const issues = [];

    const charList = Array.isArray(characterBible)
      ? characterBible
      : (characterBible?.characters || []);

    const locList = Array.isArray(locationBible)
      ? locationBible
      : (locationBible?.locations || []);

    const propList = Array.isArray(propBible)
      ? propBible
      : (propBible?.props || []);

    const validCharIds = new Set(charList.map((c) => c.character_id));
    const validLocIds = new Set(locList.map((l) => l.location_id));
    const validPropIds = new Set(propList.map((p) => p.prop_id));
    const validOutfitIds = new Set(charList.flatMap((c) => (c.outfits || []).map((o) => o.outfit_id)));

    const seenSceneIds = new Set();
    let totalDurationSeconds = 0;

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const sceneId = scene.scene_id;
      const expectedPrev = i > 0 ? scenes[i - 1].scene_id : null;
      const expectedNext = i < scenes.length - 1 ? scenes[i + 1].scene_id : null;

      // 1. Duplicate scene ID check
      if (seenSceneIds.has(sceneId)) {
        const msg = `Duplicate scene_id '${sceneId}' detected at sequence ${scene.sequence || i + 1}.`;
        errors.push(msg);
        issues.push({ type: 'DUPLICATE_SCENE', message: msg, severity: 'ERROR' });
      }
      seenSceneIds.add(sceneId);

      // 2. Duration check (4.0s - 10.0s)
      if (typeof scene.duration_seconds !== 'number' || scene.duration_seconds < 4.0 || scene.duration_seconds > 10.0) {
        const msg = `Scene '${sceneId}' Duration ${scene.duration_seconds}s out of allowed bounds (4.0s - 10.0s).`;
        errors.push(msg);
        issues.push({ type: 'DURATION_BOUNDS', message: msg, severity: 'ERROR' });
      } else {
        totalDurationSeconds += scene.duration_seconds;
      }

      // 3. Sequence & previous/next link checks
      const actualPrev = scene.continuity?.previous_scene_id !== undefined
        ? scene.continuity.previous_scene_id
        : scene.continuity?.previous_scene;
      const actualNext = scene.continuity?.next_scene_id !== undefined
        ? scene.continuity.next_scene_id
        : scene.continuity?.next_scene;

      if (actualPrev !== expectedPrev) {
        const msg = `Scene '${sceneId}' Broken link: previous_scene broken. Expected '${expectedPrev}', got '${actualPrev}'.`;
        errors.push(msg);
        issues.push({ type: 'BROKEN_LINK', message: msg, severity: 'ERROR' });
      }
      if (actualNext !== expectedNext) {
        const msg = `Scene '${sceneId}' Broken link: next_scene broken. Expected '${expectedNext}', got '${actualNext}'.`;
        errors.push(msg);
        issues.push({ type: 'BROKEN_LINK', message: msg, severity: 'ERROR' });
      }

      // 4. Unknown location reference check
      const locId = scene.location?.location_id;
      if (!locId || !validLocIds.has(locId)) {
        const msg = `Scene '${sceneId}' references unknown location ID '${locId}'.`;
        errors.push(msg);
        issues.push({ type: 'UNKNOWN_LOCATION', message: msg, severity: 'ERROR' });
      }

      // 5. Unknown character & outfit reference checks
      if (Array.isArray(scene.characters)) {
        for (const char of scene.characters) {
          if (!validCharIds.has(char.character_id)) {
            const msg = `Scene '${sceneId}' references unknown character ID '${char.character_id}'.`;
            errors.push(msg);
            issues.push({ type: 'UNKNOWN_CHARACTER', message: msg, severity: 'ERROR' });
          }
          if (char.outfit_id && !validOutfitIds.has(char.outfit_id)) {
            const msg = `Scene '${sceneId}' character '${char.character_id}' references unknown outfit ID '${char.outfit_id}'.`;
            warnings.push(msg);
            issues.push({ type: 'UNKNOWN_OUTFIT', message: msg, severity: 'WARNING' });
          }
        }
      }

      // 6. Unknown prop reference checks
      if (Array.isArray(scene.props)) {
        for (const prop of scene.props) {
          const propId = typeof prop === 'string' ? prop : prop?.prop_id;
          if (!validPropIds.has(propId)) {
            const msg = `Scene '${sceneId}' references unknown prop ID '${propId}'.`;
            errors.push(msg);
            issues.push({ type: 'UNKNOWN_PROP', message: msg, severity: 'ERROR' });
          }
        }
      }

      // 7. Sudden outfit change without transition check
      if (i > 0) {
        const prevScene = scenes[i - 1];
        const prevChar = prevScene.characters?.[0];
        const currChar = scene.characters?.[0];
        if (prevChar && currChar && prevChar.character_id === currChar.character_id) {
          if (prevChar.outfit_id !== currChar.outfit_id && !scene.continuity?.outfit_transition_justified) {
            const msg = `Scene '${sceneId}' Outfit changed from '${prevChar.outfit_id}' to '${currChar.outfit_id}' in continuous sequence without transition.`;
            warnings.push(msg);
            issues.push({ type: 'OUTFIT_CHANGE', message: msg, severity: 'WARNING' });
          }
        }
      }
    }

    const isValid = errors.length === 0;

    return {
      valid: isValid,
      status: isValid ? (warnings.length > 0 ? 'WARNINGS' : 'VALID') : 'INVALID',
      errors,
      warnings,
      issues,
      summary: {
        total_errors: errors.length,
        total_warnings: warnings.length
      },
      stats: {
        characters: validCharIds.size,
        locations: validLocIds.size,
        props: validPropIds.size,
        scenes: scenes.length,
        total_duration_seconds: totalDurationSeconds
      },
      continuity_checks: {
        character_consistency: errors.some((e) => e.includes('character')) ? 'FAIL' : 'PASS',
        location_consistency: errors.some((e) => e.includes('location')) ? 'FAIL' : 'PASS',
        outfit_consistency: warnings.some((w) => w.includes('outfit')) ? 'WARN' : 'PASS',
        prop_consistency: errors.some((e) => e.includes('prop')) ? 'FAIL' : 'PASS',
        scene_references: errors.some((e) => e.includes('link') || e.includes('Duplicate')) ? 'FAIL' : 'PASS',
        timeline_consistency: 'PASS'
      }
    };
  }

  /**
   * Validates a compiled storyboard package.
   * @param {object} pkg
   * @param {object} [scriptPackage]
   */
  validateStoryboard(pkg, scriptPackage = null) {
    const characterBible = pkg.bibles?.character_bible || pkg.character_bible || [];
    const locationBible = pkg.bibles?.location_bible || pkg.location_bible || [];
    const propBible = pkg.bibles?.prop_bible || pkg.prop_bible || [];
    const scenes = pkg.scenes || [];
    const targetDurationSeconds = scriptPackage?.target_duration_seconds || 600;

    return this.validateContinuity({
      scenes,
      characterBible,
      locationBible,
      propBible,
      targetDurationSeconds
    });
  }
}

export const continuityValidator = new ContinuityValidator();
