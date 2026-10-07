# Loredotexe — Phase 4 Schema Specification
## Canonical Storyboard, Scene, Bibles & Reference Manifests

### 1. Storyboard Package Top-Level Schema (`STORYBOARD_SCHEMA_VERSION: "1.0.0"`)

| Field | Type | Required | Description |
|---|---|---|---|
| `schema_version` | `string` | Yes | Specification version (`"1.0.0"`) |
| `id` / `storyboard_id` | `string` (UUID) | Yes | Unique storyboard identifier |
| `project_id` | `string` (UUID) | Yes | Foreign key to project entity |
| `script_id` | `string` | Yes | Source script identifier |
| `script_version` | `integer` | Yes | Version of source script |
| `storyboard_version` | `integer` | Yes | Incremental revision number |
| `topic` | `string` | Yes | Narrative subject |
| `visual_style` | `object` | Yes | Global style bible |
| `character_bible` | `array` | Yes | Characters with traits, outfits, and reference needs |
| `world_bible` | `object` | Yes | World setting, era, physics, and environment rules |
| `location_bible` | `array` | Yes | Locations with architecture and lighting rules |
| `prop_bible` | `array` | Yes | Props with physical traits and owner associations |
| `scenes` | `array` | Yes | Array of canonical scenes (4.0s - 10.0s each) |
| `continuity_state` | `object` | Yes | Project-wide continuity graph and sequence map |
| `reference_requirements` | `object` | Yes | Prioritized manifest of required visual references |
| `validation_report` | `object` | Yes | Deterministic continuity validation results |
| `created_at` | `string` (ISO 8601) | Yes | Timestamp of compilation |
| `content_hash` | `string` (SHA-256) | Yes | Cryptographic hash for idempotency & auditing |

---

### 2. Canonical Scene Object Schema

```json
{
  "scene_id": "S001",
  "sequence": 1,
  "sequence_index": 1,
  "chapter_id": "ch-01-hook",
  "duration_seconds": 6.0,
  "visual_type": "cinematic",
  "visual_purpose": "narrative_progression",
  "characters": [
    {
      "character_id": "CHAR_001",
      "name": "Explosion Host",
      "outfit_id": "OUTFIT_001",
      "emotion": "engaging_curious",
      "action": "Host directly addresses audience from command desk detailing story progression",
      "screen_position": "center"
    }
  ],
  "location": {
    "location_id": "LOC_001",
    "name": "Explosion Command Studio"
  },
  "props": ["PROP_001"],
  "action": "Host directly addresses audience from command desk detailing story progression",
  "camera": {
    "shot_type": "medium",
    "angle": "eye_level",
    "movement": "slow_push_in",
    "framing": "rule_of_thirds_left"
  },
  "lighting": {
    "type": "neon_dark_mode",
    "direction": "rim_and_key",
    "mood": "high_tech_investigative"
  },
  "visual_prompt": "Cinematic visual for establishing shot...",
  "negative_prompt": "inconsistent clothing, distorted facial anatomy, extra fingers, washed out lighting",
  "continuity": {
    "previous_scene_id": null,
    "next_scene_id": "S002",
    "outfit_id": "OUTFIT_001",
    "time_of_day": "night",
    "time_context": "controlled_indoor"
  }
}
```
