/**
 * Visual Style Bible Generator
 * Generates unified aesthetic guidelines, color palettes, camera languages, and negative constraints.
 */

export class StyleBibleGenerator {
  /**
   * Generates the visual style bible tailored for "The 10min Explosion".
   * @param {object} adaptedScript
   * @returns {object} Stable Visual Style Bible
   */
  generateStyleBible(adaptedScript) {
    const topic = adaptedScript.topic || 'General Topic';

    return {
      style_id: 'STYLE_001',
      name: 'The 10min Explosion Signature Aesthetic',
      overall_style: 'Fast-paced, hyper-engaging educational storytelling blending stylized cinematic realism with kinetic motion graphic overlays.',
      rendering_style: 'High-fidelity cinematic 3D renders with physically-based materials, crisp depth of field, and razor-sharp holographic 2D motion graphics.',
      camera_language: 'Dynamic and intentional: slow cinematic push-ins on key revelations, subtle handheld drift on tension beats, and snappy match cuts on punchlines.',
      lighting_style: 'Signature dark-mode high contrast: deep obsidian shadows punctuated by luminous electric cyan (#06b6d4), ultraviolet (#a855f7), and warning amber (#f59e0b) rim lights.',
      color_language: {
        primary_dark: '#020617',
        secondary_slate: '#0f172a',
        accent_cyan: '#06b6d4',
        accent_purple: '#a855f7',
        highlight_amber: '#f59e0b',
        text_light: '#f8fafc'
      },
      composition_rules: [
        'Host character positioned on left or right third to allow ample space for floating volumetric schematics.',
        'Technical diagrams and timeline graphics center-weighted with high visual contrast against dark backgrounds.',
        'Meme inserts use tight framing and rapid kinetic zoom-ins to accentuate comedic timing.'
      ],
      texture_rules: [
        'Finely textured materials (brushed aluminum, acoustic felt, frosted glass, cosmic dust).',
        'Avoid plastic or glossy reflections that look like generic default 3D presets.'
      ],
      realism_level: 'stylized_cinematic_realism',
      animation_level: 'kinetic_high_energy',
      humor_visual_language: [
        'Split-second dramatic crash-zoom on comedic reactions.',
        'Stylized motion graphic comic reaction symbols and animated question marks.',
        'Parody pop-culture meme reconstructions using original stylized vector art.'
      ],
      negative_style_constraints: [
        'bland_corporate_beige',
        'washed_out_lighting',
        'blurry_unreadable_text_artifacts',
        'distorted_facial_features',
        'generic_low_effort_stock_footage_look',
        'inconsistent_character_clothing',
        'random_floating_watermarks'
      ]
    };
  }

  generate(adaptedScript) {
    return this.generateStyleBible(adaptedScript);
  }
}

export const styleBibleGenerator = new StyleBibleGenerator();
