/**
 * Location Bible Generator
 * Creates and manages stable location identities, environments, and architectural lighting rules.
 */

export class LocationBibleGenerator {
  /**
   * Generates stable location bible for the storyboard.
   * @param {object} adaptedScript
   * @returns {Array<object>} Stable Location Bible
   */
  generateLocationBible(adaptedScript) {
    const topic = adaptedScript.topic || 'General Topic';
    const isSciFiOrSpace = /voyager|space|nasa|telemetry|star|cybertron|galaxy/i.test(topic);

    const primaryStudio = {
      location_id: 'LOC_001',
      name: 'Explosion Command Studio',
      type: 'virtual_studio',
      description: 'Sleek dark-mode creator studio featuring interactive glowing holographic display tables and modular acoustic backdrops.',
      architecture: 'Modern minimalist studio with floating glass holographic monitors and dark matte acoustic paneling.',
      environment: 'Indoor controlled studio environment with subtle ambient haze.',
      lighting: 'Atmospheric neon rim lighting (deep violet and electric amber) with soft key lights on the host.',
      color_palette: ['#0f172a', '#3b82f6', '#8b5cf6', '#f59e0b'],
      time_context: 'controlled_indoor',
      important_visual_elements: [
        'Central transparent glass display terminal',
        'Wall-mounted hexagonal acoustic dampeners with edge backlighting',
        'Floating UI holographic telemetry widgets'
      ],
      continuity_rules: [
        'Used for all primary host delivery, visual punchlines, and high-level explainer transitions.',
        'Lighting palette remains locked to dark-mode neon aesthetic.'
      ]
    };

    const secondaryLocation = {
      location_id: 'LOC_002',
      name: isSciFiOrSpace ? 'Deep Space Interstellar Void' : 'Historical Archive & Investigation Facility',
      type: isSciFiOrSpace ? 'space_expanse' : 'interior_archive',
      description: isSciFiOrSpace
        ? 'The vast, silent blackness of interstellar space, bathed in distant stellar pinpoint light and faint cosmic dust clouds.'
        : 'High-ceiling research archive with rows of classified documentation shelves and illuminated microfilm desks.',
      architecture: isSciFiOrSpace ? 'Cosmic vacuum, infinite depth perspective' : 'Brutalist concrete architecture with steel document lockers',
      environment: isSciFiOrSpace ? 'Zero-gravity vacuum, deep cosmic void' : 'Dusty archival room with overhead industrial pendant lamps',
      lighting: isSciFiOrSpace
        ? 'High-contrast stark rim illumination from a distant sun with deep obsidian shadows.'
        : 'Warm tungsten pendant downlights contrasting with cool fluorescent worktable lamps.',
      color_palette: isSciFiOrSpace ? ['#020617', '#0e7490', '#38bdf8', '#f8fafc'] : ['#1c1917', '#78350f', '#ca8a04', '#e2e8f0'],
      time_context: isSciFiOrSpace ? 'infinite_space' : 'night_shift',
      important_visual_elements: isSciFiOrSpace
        ? ['Distant twinkling starfield with zero atmospheric twinkle', 'Golden spacecraft components reflecting distant sunlight']
        : ['Illuminated digital scanner terminal', 'File folders with stamped declassified markings'],
      continuity_rules: [
        'All technical demonstrations and historical recreations occur in this environment.',
        'Lighting style must remain consistent across sequential cutaways.'
      ]
    };

    return [primaryStudio, secondaryLocation];
  }

  generate(adaptedScript) {
    const list = this.generateLocationBible(adaptedScript);
    return { locations: list };
  }
}

export const locationBibleGenerator = new LocationBibleGenerator();
