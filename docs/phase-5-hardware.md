# Phase 5 Hardware Policy & Compatibility Matrix

## 1. Development Machine Hardware Facts
- **GPU**: NVIDIA GeForce RTX 3050 Laptop GPU
- **VRAM**: 6144 MiB / 6.0 GB
- **System RAM**: ~16.0 GB
- **Free Disk**: ~211 GB on Drive C:
- **NVIDIA Driver**: 596.08
- **CUDA Reported**: 13.2
- **Python Version**: 3.13.5

---

## 2. Resource Policy & Constraints
1. **GPU VRAM is the Primary Constraint**: At 6.0 GB VRAM, modern heavy diffusion transformers (like Wan2.1 T2V-1.3B) require $\ge 8.0\text{ GB}$ VRAM for full generation.
2. **Resource Distinction**:
   - `DISK_AVAILABLE`: Disk storage capacity does **not** qualify a model as runnable.
   - `RAM_AVAILABLE`: System RAM offloading does not replace minimum VRAM boundaries.
   - `VRAM_AVAILABLE`: Dedicated VRAM determines local execution classification.
3. **Python Environment Boundary**: Python 3.13 is unsupported by many PyTorch/Triton wheels. If a model requires Python $\le 3.12$, the system reports `PYTHON_VERSION_UNSUPPORTED` and recommends an isolated environment (e.g. Conda/venv).

---

## 3. Registered Model Capability Matrix

| Model Identifier | Min VRAM | Rec VRAM | Min RAM | Disk Space | Supported Python | Supported Status (RTX 3050 6GB) | Failure Reason |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `mock-video` | 0 GB | 0 GB | 0.5 GB | < 1 MB | Any | **SUPPORTED** | N/A |
| `lightweight-local` | 4.0 GB | 6.0 GB | 12.0 GB | ~10 GB | 3.10 – 3.12 | **SUPPORTED_WITH_LIMITATIONS** | Model selection pending |
| `wan2.1-t2v-1.3b` | 8.0 GB | 12.0 GB | 16.0 GB | ~25 GB | 3.10 – 3.12 | **UNSUPPORTED** | `INSUFFICIENT_VRAM` & `PYTHON_VERSION_UNSUPPORTED` |

---

## 4. Next Step: Model Selection for RTX 3050 6GB
Phase 5 establishes the `LightweightLocalVideoAdapter` foundation. In subsequent engineering phases, specific lightweight local engines (such as optimized 4-bit quantized diffusion, CogVideoX-2B int4/int8, or fast frame interpolators) will be systematically benchmarked on this 6GB GPU without altering any pipeline code.
