/**
 * Prop Bible Generator
 * Creates and manages stable prop identities, physical attributes, and continuity tracking.
 */

export class PropBibleGenerator {
  /**
   * Generates stable prop bible for the storyboard.
   * @param {object} adaptedScript
   * @returns {Array<object>} Stable Prop Bible
   */
  generatePropBible(adaptedScript) {
    const topic = adaptedScript.topic || 'General Topic';
    const isSciFiOrSpace = /voyager|space|nasa|telemetry|star|cybertron|galaxy/i.test(topic);

    const primaryProp = {
      prop_id: 'PROP_001',
      name: 'Interactive Glass Telemetry Tablet',
      description: 'Frameless transparent OLED tablet displaying glowing neon telemetry readouts and interactive 3D models.',
      visual_attributes: [
        'Bezel-less transparent glass surface',
        'Cyan and magenta glowing holographic interface icons',
        'Subtle finger-touch pulse animations'
      ],
      owner_character_id: 'CHAR_001',
      location_id: 'LOC_001',
      importance: 'primary',
      continuity_rules: [
        'Used by the host to swipe between diagrams, timelines, and verified receipts.',
        'Interface graphics always reflect the specific claim discussed in the current beat.'
      ]
    };

    const secondaryProp = {
      prop_id: 'PROP_002',
      name: isSciFiOrSpace ? '1970s Gold-Plated Memory Microchip' : 'Declassified Investigation Dossier',
      description: isSciFiOrSpace
        ? 'Vintage aerospace-grade ceramic and gold dual-in-line memory chip with visible circuit traces and serial markings.'
        : 'Manila classified folder stamped with red verified documentation seals.',
      visual_attributes: isSciFiOrSpace
        ? ['Gilded ceramic package', 'Dual rows of 24 gold pins', 'Microscopic wire bonding traces']
        : ['Aged kraft paper texture', 'Red TOP SECRET rubber stamp', 'Paperclipped evidence photographs'],
      owner_character_id: 'CHAR_002',
      location_id: 'LOC_002',
      importance: 'primary',
      continuity_rules: [
        'Must retain identical visual weathering and surface texture across all close-up macro shots.'
      ]
    };

    return [primaryProp, secondaryProp];
  }

  generate(adaptedScript) {
    const list = this.generatePropBible(adaptedScript);
    return { props: list };
  }
}

export const propBibleGenerator = new PropBibleGenerator();
