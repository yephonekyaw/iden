# IDEN Biometric Engine

Internal-only face detection, embedding, and liveness service. Per the root
[README](../README.md)'s architecture, the engine is the **only** component
that ever decodes a raw image — the kiosk captures and forwards, the provider
forwards and stores, and only this service runs models on pixels.

It is never called by the kiosk directly. The provider's Biometric RS
(`provider/src/provider/biometric/`) is the only caller, over
`engine_client.py`.

## Why a separate Python version

The rest of this repository runs Python 3.14. This service is pinned to
**3.12** in its own `pyproject.toml` and has its own `.venv` — the ML stack
(`insightface`, `onnxruntime`, `opencv`, `numpy`) resolves cleanly there today;
it may not yet have wheels for the newest interpreter. This is a deliberate,
isolated choice: nothing else in the repo needs to agree with it.

## Local development

```bash
cd engine
uv sync
cp .env.example .env

uv run engine     # uvicorn on :8000, reload enabled
```

The first request that triggers `/health` after startup loads the InsightFace
`buffalo_l` model pack, which is **downloaded automatically the first time**
(a few hundred MB, from the InsightFace model zoo) into
`ENGINE_MODEL_ROOT/models/buffalo_l/`. That requires internet access once;
after that it's cached on disk and startup is offline.

- Health — <http://localhost:8000/health>
- Interactive docs — <http://localhost:8000/docs>

### Using your GPU

By default this runs on CPU (`onnxruntime`, `ENGINE_PROVIDERS=["CPUExecutionProvider"]`)
so it works with no driver setup. `pyproject.toml` instead depends on
`onnxruntime-gpu` (pinned to `1.20.2` — see the comment there on why not
newer) plus `nvidia-cublas-cu12`, `nvidia-cuda-runtime-cu12`,
`nvidia-cudnn-cu12` (pinned to `9.5.1.17`), and `nvidia-cufft-cu12`. Those
four exist so the CUDA execution provider has a CUDA 12.x + cuDNN 9.x runtime
to load *without* a system-wide CUDA Toolkit install — which would otherwise
need an NVIDIA developer login just to get cuDNN. `src/engine/__init__.py`
puts each package's `bin/` directory on both `os.add_dll_directory` and
`PATH` before anything imports `onnxruntime`; **both are required** — the
CUDA provider DLL and cuDNN's own internal plugin loading don't reliably
honor `add_dll_directory` alone (confirmed: omitting the `PATH` half
reproduces `LoadLibrary failed with error 126` even though every one of
those DLLs loads fine individually).

Only the driver itself is a real prerequisite — an NVIDIA GPU with a current
driver (`nvidia-smi` should list it). Everything else installs via `uv sync`.
Once running, `.env` needs:

```bash
export ENGINE_PROVIDERS=["CUDAExecutionProvider","CPUExecutionProvider"]
```

Confirmed working end to end on Windows with an RTX 3070 Ti (driver 610.88,
CUDA Toolkit 12.6 also present but not what's actually used) — the recognition
model ran roughly 7x faster than CPU. Startup logs
`Applied providers: ['CUDAExecutionProvider', ...]` per model file when this
is working; if it silently falls back to `['CPUExecutionProvider']`, check
the startup log for a `LoadLibrary failed` line naming the specific missing
dependency rather than assuming the driver is the problem.

If you need a version of `onnxruntime-gpu` or `nvidia-cudnn-cu12` other than
what's pinned, check
[onnxruntime's CUDA compatibility table](https://onnxruntime.ai/docs/execution-providers/CUDA-ExecutionProvider.html)
first — the CUDA/cuDNN major versions must match what that release was built
against.

## Liveness / anti-spoofing

`ENGINE_LIVENESS_ENABLED=false` by default. InsightFace has no liveness model
of its own, and none is bundled here, so until a real one is wired in, every
liveness check **passes automatically** (`engine/models/liveness.py`) — this
is what lets enroll/verify/search be exercised end to end before a liveness
model has been sourced. It also means the pipeline is **not actually checking
for a spoof** until this is turned on; do not treat it as authentication
until it is.

To make it real:

1. Get a passive-liveness ONNX model — a MiniFASNet-style model (e.g. the
   `Silent-Face-Anti-Spoofing` project's exported weights) is the common
   choice and is what `liveness.py`'s preprocessing assumes.
2. Set `ENGINE_LIVENESS_ENABLED=true` and `ENGINE_LIVENESS_MODEL_PATH` to the
   `.onnx` file.
3. Check `LivenessChecker.check()`'s output-layout assumption
   (`[spoof_score, live_score]`) against the model you chose and adjust if it
   differs.

## API

Internal only — no auth, no scopes, not exposed outside the Docker network in
production. See `claude_code_prompt/API_CONTRACT.md` for the exact
request/response shape the provider's `engine_client.py` expects.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness of the process itself |
| `POST` | `/v1/process` | `multipart/form-data`: `mode` (`enroll`\|`verify`\|`search`\|`liveness`, for logging only) + `images` (one or more candidate frames of the same shot — the engine picks the sharpest that still detects a face). Returns detection + embedding + liveness + quality in one call |

Every mode runs the identical detect → embed → liveness pipeline. The engine
never looks up or stores an identity — it only reports what it saw in one
image; the provider decides what that means (store it, compare it, search
with it).
