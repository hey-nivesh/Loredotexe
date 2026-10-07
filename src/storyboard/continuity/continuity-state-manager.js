/**
 * Continuity State Manager
 * Tracks real-time states of characters, outfits, locations, and props across sequential scenes.
 */

export class ContinuityStateManager {
  constructor() {
    this.characterStates = {};
    this.locationStates = {};
    this.propStates = {};
    this.currentSceneId = null;
  }

  /**
   * Builds the complete project-level continuity state by replaying all planned scenes sequentially.
   * @param {Array<object>} scenes
   * @returns {object} Final project-level continuity state
   */
  buildState(scenes) {
    this.characterStates = {};
    this.locationStates = {};
    this.propStates = {};
    this.currentSceneId = null;

    for (const scene of scenes) {
      this.currentSceneId = scene.scene_id;
      const locationId = scene.location?.location_id || 'LOC_001';

      // Update location state
      this.locationStates[locationId] = {
        time: scene.continuity?.time_context || 'controlled_indoor',
        lighting: scene.lighting?.type || 'neon_dark_mode',
        environment_state: 'active_session',
        last_scene_id: scene.scene_id
      };

      // Update character states
      if (Array.isArray(scene.characters)) {
        for (const char of scene.characters) {
          this.characterStates[char.character_id] = {
            location_id: locationId,
            outfit_id: char.outfit_id || 'OUTFIT_001',
            emotion: char.emotion || 'neutral',
            action: char.action || 'speaking',
            held_props: scene.props || [],
            last_scene_id: scene.scene_id
          };
        }
      }

      // Update prop states
      if (Array.isArray(scene.props)) {
        for (const propId of scene.props) {
          this.propStates[propId] = {
            holder: scene.characters?.[0]?.character_id || null,
            location_id: locationId,
            state: 'in_use',
            last_scene_id: scene.scene_id
          };
        }
      }
    }

    return {
      current_scene_id: this.currentSceneId,
      total_scenes: scenes.length,
      character_states: this.characterStates,
      location_states: this.locationStates,
      prop_states: this.propStates
    };
  }
}

export const continuityStateManager = new ContinuityStateManager();
