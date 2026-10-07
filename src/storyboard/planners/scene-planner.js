/**
 * Scene Planner
 * Transforms visual beats and bible entities into model-independent canonical scenes.
 */

import { VISUAL_TYPES, SHOT_TYPES, CAMERA_MOVEMENTS } from '../schema/storyboard-schema.js';
import { visualBeatExtractor } from '../extractors/visual-beat-extractor.js';

export class ScenePlanner {
  constructor(config = {}) {
    this.minSceneDuration = config.minSceneDuration || 4.0;
    this.maxSceneDuration = config.maxSceneDuration || 10.0;
  }

  /**
   * Plans canonical scenes from visual beats and bible entities.
   * @param {Array<object>|object} visualBeats Array of beats or adapted script
   * @param {object} bibles { characterBible, locationBible, worldBible, propBible, styleBible }
   * @returns {Array<object>} Planned canonical scenes
   */
  planScenes(visualBeats, bibles) {
    const beats = Array.isArray(visualBeats)
      ? visualBeats
      : visualBeatExtractor.extractBeats(visualBeats);

    const characterBible = Array.isArray(bibles.characterBible)
      ? bibles.characterBible
      : (bibles.characterBible?.characters || []);

    const locationBible = Array.isArray(bibles.locationBible)
      ? bibles.locationBible
      : (bibles.locationBible?.locations || []);

    const propBible = Array.isArray(bibles.propBible)
      ? bibles.propBible
      : (bibles.propBible?.props || []);

    const styleBible = bibles.styleBible || {};

    const char1 = characterBible[0] || { character_id: 'CHAR_001', default_outfit_id: 'OUTFIT_001', name: 'Explosion Host', description: 'Video essayist host' };
    const char2 = characterBible[1] || char1;
    const loc1 = locationBible[0] || { location_id: 'LOC_001', name: 'Explosion Command Studio', description: 'Neon creator studio' };
    const loc2 = locationBible[1] || loc1;
    const prop1 = propBible[0] || { prop_id: 'PROP_001', name: 'Glass Telemetry Tablet' };
    const prop2 = propBible[1] || prop1;

    const scenes = [];

    for (let i = 0; i < beats.length; i++) {
      const beat = beats[i];
      const sceneId = `S${String(i + 1).padStart(3, '0')}`;
      const prevSceneId = i > 0 ? `S${String(i).padStart(3, '0')}` : null;
      const nextSceneId = i < beats.length - 1 ? `S${String(i + 2).padStart(3, '0')}` : null;

      const isMeme = beat.beat_type === VISUAL_TYPES.MEME_INSERT;
      const isDiagram = beat.beat_type === VISUAL_TYPES.DIAGRAM;
      const isSecondaryLoc = (beat.sequence || i + 1) % 3 === 0;

      // Select active character & location for this scene
      const activeLocation = isMeme ? loc1 : isSecondaryLoc ? loc2 : loc1;
      const activeCharacter = isMeme || !isSecondaryLoc ? char1 : char2;
      const activeOutfit = activeCharacter.default_outfit_id || 'OUTFIT_001';
      const activeProps = isDiagram ? [prop1.prop_id] : isSecondaryLoc ? [prop2.prop_id] : [prop1.prop_id];

      // Camera determination
      const shotType = isMeme
        ? SHOT_TYPES.CLOSE_UP
        : isDiagram
        ? SHOT_TYPES.WIDE
        : i % 2 === 0
        ? SHOT_TYPES.MEDIUM
        : SHOT_TYPES.CLOSE_UP;

      const cameraMovement = isMeme
        ? CAMERA_MOVEMENTS.WHIP_PAN
        : isDiagram
        ? CAMERA_MOVEMENTS.STATIC
        : CAMERA_MOVEMENTS.SLOW_PUSH_IN;

      // Emotions & Actions
      const emotion = isMeme ? 'humorous_shock' : isDiagram ? 'focused_analytical' : 'engaging_curious';
      const action = isMeme
        ? `Exaggerated comedic reaction and dramatic visual punchline matching beat: ${beat.narration_snippet || beat.visual_intent}`
        : isDiagram
        ? `Host gestures toward floating glowing schematic explaining technical metrics: ${beat.narration_snippet || beat.visual_intent}`
        : `Host directly addresses audience from command desk detailing story progression: ${beat.narration_snippet || beat.visual_intent}`;

      // Self-contained visual prompt
      const visualPrompt = [
        `Cinematic visual for ${beat.visual_intent}.`,
        `Subject: ${activeCharacter.name} (${activeCharacter.description}).`,
        `Outfit: ${activeOutfit} (${activeCharacter.outfits?.[0]?.description || 'Signature outfit'}).`,
        `Environment: ${activeLocation.name} (${activeLocation.description}).`,
        `Action: ${action}.`,
        `Camera: ${shotType} shot, eye level, ${cameraMovement}.`,
        `Lighting: High-contrast neon dark mode with cyan and amber rim accents.`,
        `Visual Style: ${styleBible.overall_style || 'The 10min Explosion signature aesthetic'}.`
      ].join(' ');

      // Negative constraints
      const negativePrompt = [
        'inconsistent clothing',
        'distorted facial anatomy',
        'extra fingers',
        'washed out lighting',
        'blurry text artifacts',
        'random background people',
        'low quality 3D render artifacts'
      ].join(', ');

      const scene = {
        scene_id: sceneId,
        sequence: i + 1,
        sequence_index: i + 1,
        chapter_id: beat.chapter_id || `ch-01`,
        duration_seconds: beat.duration_seconds || 6,
        narration_refs: [beat.chapter_id || `NARR_${String(i + 1).padStart(3, '0')}`],
        visual_type: beat.beat_type,
        visual_purpose: isMeme ? 'meme_reaction' : isDiagram ? 'technical_breakdown' : 'narrative_progression',
        characters: [
          {
            character_id: activeCharacter.character_id,
            name: activeCharacter.name,
            outfit_id: activeOutfit,
            emotion,
            action,
            screen_position: 'center'
          }
        ],
        location: {
          location_id: activeLocation.location_id,
          name: activeLocation.name
        },
        props: activeProps,
        action,
        camera: {
          shot_type: shotType,
          angle: 'eye_level',
          movement: cameraMovement,
          framing: isDiagram ? 'center_weighted' : 'rule_of_thirds_left'
        },
        lighting: {
          type: 'neon_dark_mode',
          direction: 'rim_and_key',
          mood: isMeme ? 'punchy_vibrant' : 'high_tech_investigative'
        },
        dialogue: null,
        visual_prompt: visualPrompt,
        negative_prompt: negativePrompt,
        references: {
          characters: [activeCharacter.character_id],
          locations: [activeLocation.location_id],
          props: activeProps
        },
        continuity: {
          previous_scene_id: prevSceneId,
          next_scene_id: nextSceneId,
          previous_scene: prevSceneId,
          next_scene: nextSceneId,
          outfit: activeOutfit,
          outfit_id: activeOutfit,
          emotion,
          time_of_day: 'night',
          time_context: activeLocation.time_context || 'controlled_indoor',
          location_state: 'active_session',
          prop_state: activeProps.map((p) => `holding_${p}`)
        },
        compact_context: {
          previous_context: {
            scene_id: prevSceneId,
            location: prevSceneId ? activeLocation.location_id : null,
            action_summary: prevSceneId ? `Preceding visual sequence for ${beat.chapter_id}` : 'Start of video'
          },
          current_context: {
            scene_id: sceneId,
            location: activeLocation.location_id,
            visual_type: beat.beat_type,
            summary: beat.visual_intent
          },
          next_context: {
            scene_id: nextSceneId,
            location: nextSceneId ? activeLocation.location_id : null,
            expected_transition: nextSceneId ? (isMeme ? 'match_cut' : 'cut') : 'fade_to_black'
          }
        }
      };

      scenes.push(scene);
    }

    return scenes;
  }
}

export const scenePlanner = new ScenePlanner();
