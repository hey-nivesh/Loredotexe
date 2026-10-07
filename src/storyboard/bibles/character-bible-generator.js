/**
 * Character Bible Generator
 * Generates and manages stable character identities, outfits, and reference requirements.
 */

export class CharacterBibleGenerator {
  /**
   * Generates the character bible based on script topic and extracted visual beats.
   * @param {object} adaptedScript
   * @returns {Array<object>} Stable Character Bible
   */
  generateCharacterBible(adaptedScript) {
    const topic = adaptedScript.topic || 'General Topic';
    const isSciFiOrSpace = /voyager|space|nasa|telemetry|star|cybertron|galaxy/i.test(topic);

    // Default primary character: The 10min Explosion Host / Narrator Avatar
    const hostCharacter = {
      character_id: 'CHAR_001',
      name: 'Explosion Host',
      role: 'main_narrator',
      description: 'Energetic, expressive 20-something tech/lore video essayist with animated hand gestures.',
      age_range: '20s',
      gender_presentation: 'androgynous_modern',
      body_type: 'slim_athletic',
      face_description: 'Sharp expressive eyes, friendly demeanor, capable of dramatic comedic reactions.',
      hair: 'Short textured dark crop with modern fade.',
      skin_tone: 'medium_neutral',
      distinctive_features: ['Subtle studio over-ear headset around neck', 'Animated facial expressions'],
      default_expression: 'engaging_curious',
      personality: ['charismatic', 'witty', 'detail-oriented', 'sarcastic'],
      visual_traits: ['quick_motion', 'clean_lines', 'relatable_modern'],
      default_outfit_id: 'OUTFIT_001',
      outfits: [
        {
          outfit_id: 'OUTFIT_001',
          character_id: 'CHAR_001',
          name: 'Signature Creator Casual',
          description: 'Dark charcoal crewneck sweater over relaxed neutral cargo pants with minimal white sneakers.',
          top: 'Charcoal minimalist crewneck sweater with subtle geometric badge',
          bottom: 'Matte slate-grey tailored cargo trousers',
          shoes: 'Crisp white low-profile studio sneakers',
          accessories: ['Matte black wireless studio headset resting on collar'],
          color_palette: ['#1e293b', '#334155', '#f8fafc', '#64748b'],
          continuity_notes: ['Default outfit across all studio explainer and host scenes.']
        }
      ],
      props: ['PROP_001'],
      reference_requirements: {
        needs_face_reference: true,
        needs_full_body_reference: true,
        needs_outfit_reference: true
      }
    };

    // Supporting topic-specific character (e.g., Mission Lead / Lead Engineer)
    const secondaryCharacter = {
      character_id: 'CHAR_002',
      name: isSciFiOrSpace ? 'Flight Director' : 'Lead Investigator',
      role: 'subject_expert',
      description: isSciFiOrSpace
        ? 'Veteran aerospace telemetry engineer in cleanroom control room environment.'
        : 'Senior field researcher reviewing critical physical evidence.',
      age_range: '40s',
      gender_presentation: 'neutral_professional',
      body_type: 'average',
      face_description: 'Focused, determined gaze with subtle tired eyes from mission crunch.',
      hair: 'Neat receding grey-brown hair.',
      skin_tone: 'fair_olive',
      distinctive_features: ['Lanyard with agency identification badge', 'Rolled-up sleeves'],
      default_expression: 'focused_analytical',
      personality: ['methodical', 'rigorous', 'calm_under_pressure'],
      visual_traits: ['grounded_realism', 'professional_attire'],
      default_outfit_id: 'OUTFIT_002',
      outfits: [
        {
          outfit_id: 'OUTFIT_002',
          character_id: 'CHAR_002',
          name: 'Operations Duty Uniform',
          description: 'Navy blue mission operations polo shirt with tailored khaki chinos and official pass lanyard.',
          top: 'Navy blue collared operations polo with subtle left-chest insignia',
          bottom: 'Pleated khaki mission operations trousers',
          shoes: 'Comfortable brown leather field oxfords',
          accessories: ['High-security agency badge lanyard'],
          color_palette: ['#0f172a', '#1e3a8a', '#d97706', '#f1f5f9'],
          continuity_notes: ['Always worn in control room and technical facility scenes.']
        }
      ],
      props: ['PROP_002'],
      reference_requirements: {
        needs_face_reference: true,
        needs_full_body_reference: false,
        needs_outfit_reference: true
      }
    };

    return [hostCharacter, secondaryCharacter];
  }

  generate(adaptedScript) {
    const list = this.generateCharacterBible(adaptedScript);
    return { characters: list };
  }
}

export const characterBibleGenerator = new CharacterBibleGenerator();
