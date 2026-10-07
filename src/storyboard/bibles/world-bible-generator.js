/**
 * World Bible Generator
 * Generates overarching environmental and visual world rules.
 */

export class WorldBibleGenerator {
  /**
   * Generates global world rules for the video project.
   * @param {object} adaptedScript
   * @returns {object} Stable World Bible
   */
  generateWorldBible(adaptedScript) {
    const topic = adaptedScript.topic || 'General Topic';

    return {
      world_id: 'WORLD_001',
      name: `${topic} Universe & Explainer Realm`,
      setting: 'Contemporary digital investigation realm seamlessly blending real-world verified facts with kinetic infographic visualization.',
      era: '21st Century contemporary digital era with historical flashbacks as documented.',
      technology_level: 'High-tech creator studio augmented with transparent volumetric holographic schematics.',
      visual_language: 'Vibrant, high-contrast dark aesthetic with luminous neon accent colors, hyper-clean typography, and dynamic visual metaphors.',
      physics_rules: [
        'Real-world physical laws apply strictly to historical/factual recreations.',
        'Graphic overlays and explanatory UI elements follow kinetic motion graphics physics (smooth easing, dampening).'
      ],
      environmental_rules: [
        'Atmospheric depth is maintained via subtle volumetric light rays and particulate dust in interior scenes.',
        'Space scenes feature complete vacuum silence, infinite black depth, and accurate lack of atmospheric scattering.'
      ],
      social_context: [
        'Internet-literate audience expecting rapid pacing, zero corporate fluff, and immediate visual payoffs.'
      ],
      recurring_elements: [
        'Interactive holographic diagrams breaking down complex engineering/lore systems.',
        'Expressive meme reaction cards illustrating collective online sentiment.'
      ],
      global_continuity_rules: [
        'All visual depictions of core entities must remain identical across chapters.',
        'Lighting color temperature must not randomly invert without an explicit transition beat.'
      ]
    };
  }

  generate(adaptedScript) {
    return this.generateWorldBible(adaptedScript);
  }
}

export const worldBibleGenerator = new WorldBibleGenerator();
