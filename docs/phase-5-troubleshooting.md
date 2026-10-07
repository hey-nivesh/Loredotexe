# Phase 5 Media Generation Engine Troubleshooting Guide

## 1. Common Error Codes & Resolutions

### `INSUFFICIENT_VRAM`
- **Cause**: The selected model requires more dedicated VRAM than the host GPU provides (e.g. Wan2.1 requires $\ge 8\text{ GB}$, host has 6.0 GB).
- **Resolution**: Keep `MEDIA_GENERATION_MODE=mock` or use `LightweightLocalVideoAdapter` once a compatible 6GB-optimized model is selected. Do not attempt unoptimized heavy model loads.

### `PYTHON_VERSION_UNSUPPORTED`
- **Cause**: The host Python version is 3.13.5, but AI model dependencies (PyTorch/FlashAttention/Wan) require Python $\le 3.12$.
- **Resolution**: Create an isolated Python 3.10 or 3.11 virtual environment / Conda environment specifically for the video worker subprocess.

### `MODEL_NOT_INSTALLED`
- **Cause**: No weights path was configured or weights file does not exist locally.
- **Resolution**: The engine intentionally does not download models automatically (`MEDIA_ALLOW_MODEL_DOWNLOAD=false`). Place weights in the configured folder and set `VIDEO_MODEL_PATH`.

### `INSUFFICIENT_DISK`
- **Cause**: Free disk space on Drive C: or project disk dropped below `MEDIA_MIN_FREE_DISK_GB` (default: 5.0 GB).
- **Resolution**: Free up disk space before executing large media batches.

### `OUTPUT_INVALID` / `OUTPUT_CORRUPTED`
- **Cause**: Generated MP4 file failed header verification or deviates outside duration tolerance ($\pm 0.75\text{s}$).
- **Resolution**: Check ffmpeg/ffprobe installation, check adapter stderr logs, and ensure generation parameters match supported resolutions.

---

## 2. Running Diagnostic Commands
- Check hardware report:
  ```bash
  curl http://localhost:3000/api/media/hardware
  ```
- Run verification suite:
  ```bash
  npm run verify:phase-5
  ```
- Run automated media tests:
  ```bash
  node --preserve-symlinks --preserve-symlinks-main tests/index.js
  ```
