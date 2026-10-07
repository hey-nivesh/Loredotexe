# Loredotexe — Phase 4 Continuity Engine & Validation Rules
## Deterministic Continuity Tracking and Verification

### 1. Continuity Invariants & Verification Rules

The `ContinuityValidator` executes a series of deterministic checks across every generated storyboard package:

1. **Entity Reference Validity**:
   - Every `character_id` referenced in any scene must exist in `character_bible`.
   - Every `location_id` referenced in any scene must exist in `location_bible`.
   - Every `prop_id` referenced in any scene must exist in `prop_bible`.
   - Every `outfit_id` referenced in any scene must exist in the outfits list of the corresponding character.

2. **Graph Linkage & Sequence Order**:
   - `scene.continuity.previous_scene_id` must match the actual `scene_id` of the previous element in `scenes`.
   - `scene.continuity.next_scene_id` must match the actual `scene_id` of the subsequent element in `scenes`.
   - No duplicate `scene_id` values are allowed.

3. **Scene Duration Bounds**:
   - Every scene must be bounded between `4.0s` and `10.0s`.
   - Total runtime of the storyboard must be within tolerance of the script's estimated runtime.

4. **Outfit & Wardrobe Transitions**:
   - If a character appears in sequential continuous scenes at the same time and location, outfit changes without an explicit transition beat are flagged as warnings.

---

### 2. Validation Severity Levels

- **ERROR (Blocking)**:
  - Unknown Character ID, Location ID, or Prop ID.
  - Broken `previous_scene_id` or `next_scene_id` graph links.
  - Duplicate `scene_id`.
  - Scene duration `< 4.0s` or `> 10.0s`.
- **WARNING (Non-blocking)**:
  - Unannounced outfit change in continuous time.
  - Unknown outfit ID referenced for an otherwise valid character.
