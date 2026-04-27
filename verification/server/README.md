# Verification Server

FastAPI server exposing `/api/v1/capture` and `/api/v1/verify`.
Face pipeline uses InsightFace `buffalo_l` (RetinaFace detector + 5-point
alignment + ArcFace 512-d embeddings). On Linux/Windows it runs on CUDA via
`onnxruntime-gpu`; on macOS it falls back to CPU `onnxruntime` automatically.
Embeddings live in Postgres with `pgvector` (HNSW cosine index) and are
mirrored to a local folder (`local_store/<identity_id>/`).

## Layout
```
main.py        app wiring (lifespan, model warm-up, CORS, healthz, routers)
config.py      pydantic-settings (IDEN_* env)
db.py          async engine, Base, get_session, init_db (extension only)
models.py      Identity (pgvector Vector(512) + timestamps)
schemas.py     request / response Pydantic models with full OpenAPI metadata
face.py        InsightFace pipeline (decode → EXIF-fix → resize → detect → align → embed)
storage.py     local mirror: local_store/<identity_id>/{face.jpg, record.json}
responses.py   success / error envelope + exception handlers
middleware.py  request-id middleware
capture.py     POST /api/v1/capture
verify.py      POST /api/v1/verify  (batched, single-SQL match)
migrations/    Alembic
Dockerfile     CUDA 12.6.3 + cuDNN runtime
```

## Requirements
- Python **3.13**
- Postgres with the `vector` extension
- Linux/Windows + NVIDIA GPU + recent drivers for production; macOS works on CPU for dev

## Configure
Set `IDEN_DATABASE_URL` in `.env`, e.g.:
```
IDEN_DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/db
```

Optional overrides (defaults shown):

| Env var | Default | Purpose |
|---|---|---|
| `IDEN_MATCH_THRESHOLD` | `0.50` | Cosine similarity required for a match |
| `IDEN_INSIGHTFACE_MODEL` | `buffalo_l` | InsightFace model pack |
| `IDEN_DETECTOR_SIZE` | `640` | Detector input size (px) |
| `IDEN_MAX_IMAGES_PER_REQUEST` | `8` | Max images in a single `/verify` call |
| `IDEN_MAX_IMAGE_BYTES` | `10485760` | Per-image cap after base64 decode |
| `IDEN_MAX_IMAGE_SIDE` | `1280` | Longest side after resize (px) |
| `IDEN_MIN_DET_SCORE` | `0.6` | Drop faces below this detector confidence |
| `IDEN_MIN_FACE_PIXELS` | `60` | Drop faces whose shorter side is smaller |
| `IDEN_LOCAL_STORAGE_DIR` | `local_store` | Directory for the local mirror |
| `IDEN_ALLOWED_ORIGINS` | `["*"]` | CORS allow-list — tighten for production |
| `IDEN_LOG_LEVEL` | `INFO` | App log level |

## Run (local dev)
```bash
uv sync
uv run alembic upgrade head     # creates tables + HNSW index, idempotent
uv run fastapi dev main.py --port 9000
```

The model loads once at startup (~10–30 s); `GET /healthz` returns 200 once
it's ready.

## Run (Docker, GPU on Linux)

### Prerequisites

**Hardware**
- NVIDIA GPU with compute capability ≥ 5.2 (Maxwell or newer)
- ~1–2 GB of VRAM is enough for `buffalo_l`

**Host software**
- **NVIDIA driver** that supports CUDA 12.6 — driver **≥ 560** is the safe floor.
  No host-side CUDA toolkit needed; the container ships its own.
  Check with `nvidia-smi` — the "CUDA Version" column should read 12.6 or higher.
- **Docker Engine** 24+
- **[NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html)** —
  required for `--gpus all`. After installing:
  ```bash
  sudo nvidia-ctk runtime configure --runtime=docker
  sudo systemctl restart docker
  ```
  Smoke test:
  ```bash
  docker run --rm --gpus all nvidia/cuda:12.6.3-base-ubuntu24.04 nvidia-smi
  ```
  Should print the same table you saw on the host.

**External services**
- **Postgres** reachable from the container with the `pgvector` extension
  available (e.g. the `postgresql-16-pgvector` apt package, or the
  `pgvector/pgvector:pg16` image). The migration runs
  `CREATE EXTENSION IF NOT EXISTS vector`, so the DB user needs
  `CREATE EXTENSION` rights the first time; ordinary read/write afterward.

**Config**
- `.env` with at minimum
  `IDEN_DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/db`
- Tighten `IDEN_ALLOWED_ORIGINS` from `["*"]` before exposing the port publicly.

### First run

```bash
docker build -t iden-verify .

# One-time schema bootstrap (idempotent)
docker run --rm --env-file .env iden-verify uv run alembic upgrade head

# Start the server
docker run --gpus all \
    --env-file .env \
    -p 9000:9000 \
    -v "$PWD/local_store:/app/local_store" \
    iden-verify
```

### Verifying the GPU path

- Container logs at startup should mention `CUDAExecutionProvider`,
  not `CPUExecutionProvider`.
- `GET /healthz` should return 200 within ~30 s of startup once the model is loaded.
- Per-face latency on `/api/v1/verify` should be ~10–30 ms.
  Seeing 150–300 ms means it silently fell back to CPU — recheck the driver
  version and the container toolkit install.

## Endpoints

### POST `/api/v1/capture`  → 201
Body:
```json
{
  "display_name": "Aung Aung",
  "identity_code": "65070503456",
  "email": "aung@example.com",
  "department": "SIT",
  "image_base64": "<jpeg/png base64>"
}
```
Pipeline: decode (EXIF-aware) → detect (RetinaFace) → quality gate → largest
face → align (`norm_crop`) → embed (ArcFace) → write local mirror → persist
to pgvector.

Errors: `NO_FACE_DETECTED` (400), `INVALID_IMAGE` (400), `IMAGE_TOO_LARGE`
(400), `DUPLICATE_IDENTITY` (409), `DUPLICATE_EMAIL` (409).

### POST `/api/v1/verify`  → 200
Body:
```json
{ "images": ["<jpeg/png base64>", "<...>", "..."] }
```
Detects all qualifying faces in every image, embeds each, and matches them
all in **one SQL round trip** (`unnest` + `LATERAL JOIN` against the HNSW
index). Per-image decode/detection failures appear in `image_errors` rather
than failing the whole request.

Response:
```json
{
  "data": {
    "total_images": 3,
    "total_faces": 4,
    "matched": 3,
    "unmatched": 1,
    "results": [{"image_index": 0, "face_index": 0, "bbox": [...], "match_found": true, "identity": {...}, "confidence": 0.93, "det_score": 0.99}],
    "image_errors": [{"image_index": 2, "code": "NO_FACE_DETECTED", "message": "..."}]
  }
}
```
