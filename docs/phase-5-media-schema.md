# Phase 5 Media Schema Specification

## 1. GenerationRequest Schema
The `GenerationRequest` is the canonical model-independent payload sent to any `VideoModelAdapter`.

```json
{
  "scene_id": "SCN_001",
  "sequence": 1,
  "prompt": "Voyager 1 drifting into deep interstellar space, faint blue cosmic telemetry overlay, cinematic lighting, 8k resolution",
  "negative_prompt": "blurry, low resolution, cartoon, 3d render, watermark, text",
  "duration_seconds": 5.0,
  "width": 832,
  "height": 480,
  "fps": 16,
  "reference_images": [
    {
      "type": "character",
      "id": "char_01",
      "path": "data/media/references/char_01.png"
    }
  ],
  "camera_motion": "slow zoom in",
  "lighting_style": "cinematic deep space contrast",
  "generation_parameters": {
    "seed": 42,
    "steps": 30,
    "cfg_scale": 6.0
  }
}
```

---

## 2. MediaAssetMetadata Schema
Every validated on-disk MP4 asset is accompanied by a `metadata.json` descriptor:

```json
{
  "asset_id": "ASSET_SCN_001_v1_9a1f2b3c",
  "project_id": "PRJ_123456",
  "scene_id": "SCN_001",
  "type": "video",
  "provider": "mock",
  "model": "mock-video",
  "version": 1,
  "file_path": "E:/Personal Projects/Loredotexe/data/media/generated/PRJ_123456/SCN_001/v1/scene.mp4",
  "file_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "prompt_hash": "a1b2c3d4e5f6...",
  "generation_parameters": {
    "width": 832,
    "height": 480,
    "fps": 16,
    "duration_seconds": 5.0,
    "prompt": "Voyager 1 drifting..."
  },
  "duration_seconds": 5.0,
  "width": 832,
  "height": 480,
  "fps": 16,
  "file_size_bytes": 1048576,
  "created_at": "2026-10-07T19:00:00.000Z",
  "status": "VALID"
}
```

---

## 3. MediaManifest Schema
The root delivery package for Phase 6 assembly and downstream orchestration:

```json
{
  "project_id": "PRJ_123456",
  "storyboard_version": 1,
  "generation_version": 1,
  "mode": "mock",
  "provider": "mock",
  "model": "mock-video",
  "status": "COMPLETED",
  "total_scenes": 12,
  "total_duration_seconds": 60.0,
  "summary": {
    "total": 12,
    "completed": 12,
    "failed": 0,
    "reused": 0
  },
  "assets": [
    {
      "scene_id": "SCN_001",
      "asset_id": "ASSET_SCN_001_v1_9a1f2b3c",
      "file_path": "data/media/generated/PRJ_123456/SCN_001/v1/scene.mp4",
      "file_hash": "e3b0c442...",
      "duration_seconds": 5.0,
      "width": 832,
      "height": 480,
      "fps": 16,
      "status": "VALID"
    }
  ],
  "created_at": "2026-10-07T19:00:00.000Z"
}
```
