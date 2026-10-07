/**
 * Reference Manager Abstraction
 * Defines visual reference requirements for characters, locations, and props without generating images.
 */

export class ReferenceManager {
  /**
   * Builds the reference requirement manifest for a storyboard package.
   * @param {object} bibles { characterBible, locationBible, propBible }
   * @param {Array<object>} scenes
   * @returns {object} Reference requirements manifest
   */
  buildReferenceManifest(bibles, scenes) {
    const { characterBible, locationBible, propBible } = bibles;
    const characterRefs = [];
    const locationRefs = [];
    const propRefs = [];

    // 1. Character references
    for (const char of characterBible) {
      if (char.reference_requirements?.needs_face_reference) {
        characterRefs.push({
          reference_id: `REF_${char.character_id}_FACE`,
          entity_id: char.character_id,
          entity_type: 'character',
          aspect: 'facial_identity_and_expressions',
          required_views: ['front_portrait', 'three_quarter_left', 'three_quarter_right'],
          description: `Neutral and expressive key portraits for ${char.name} (${char.description})`
        });
      }
      if (char.reference_requirements?.needs_full_body_reference) {
        characterRefs.push({
          reference_id: `REF_${char.character_id}_BODY`,
          entity_id: char.character_id,
          entity_type: 'character',
          aspect: 'full_body_proportions_and_outfit',
          required_views: ['front_full_body', 'side_full_body'],
          description: `Full anatomical proportions and signature outfit for ${char.name}`
        });
      }
    }

    // 2. Location references
    for (const loc of locationBible) {
      locationRefs.push({
        reference_id: `REF_${loc.location_id}_ENVIRONMENT`,
        entity_id: loc.location_id,
        entity_type: 'location',
        aspect: 'architectural_and_lighting_layout',
        required_views: ['wide_establishing_angle', 'macro_desk_lighting_angle'],
        description: `Visual environment layout and color balance reference for ${loc.name}`
      });
    }

    // 3. Prop references
    for (const prop of propBible) {
      if (prop.importance === 'primary') {
        propRefs.push({
          reference_id: `REF_${prop.prop_id}_TEXTURE`,
          entity_id: prop.prop_id,
          entity_type: 'prop',
          aspect: 'materials_and_surface_markings',
          required_views: ['isolated_product_angle', 'in_hand_held_angle'],
          description: `Material texture and surface interface reference for ${prop.name}`
        });
      }
    }

    const allRequirements = [];

    for (const cr of characterRefs) {
      allRequirements.push({
        requirement_id: cr.reference_id,
        asset_type: 'character_turnaround',
        priority: 'CRITICAL',
        entity_id: cr.entity_id,
        description: cr.description,
        views: cr.required_views
      });
    }

    for (const lr of locationRefs) {
      allRequirements.push({
        requirement_id: lr.reference_id,
        asset_type: 'location_environment',
        priority: 'HIGH',
        entity_id: lr.entity_id,
        description: lr.description,
        views: lr.required_views
      });
    }

    for (const pr of propRefs) {
      allRequirements.push({
        requirement_id: pr.reference_id,
        asset_type: 'prop_texture',
        priority: 'MEDIUM',
        entity_id: pr.entity_id,
        description: pr.description,
        views: pr.required_views
      });
    }

    return {
      total_requirements: allRequirements.length,
      total_reference_assets_needed: allRequirements.length,
      requirements: allRequirements,
      character_references: characterRefs,
      location_references: locationRefs,
      prop_references: propRefs,
      phase_5_handshake: 'Ready for CharacterReferenceGenerator and LocationReferenceGenerator adapters.'
    };
  }
}

export const referenceManager = new ReferenceManager();
