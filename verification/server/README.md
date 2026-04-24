# Verification Server

FastAPI server exposing `/api/v1/capture` and `/api/v1/verify`.
Face pipeline uses InsightFace `buffalo_l` (RetinaFace detector + 5-point
alignment + ArcFace 512-d embeddings) on CUDA via `onnxruntime-gpu`.
Embeddings are stored in Postgres with `pgvector` and also mirrored to a
local folder (`local_store/<identity_id>/`).

## Layout
```
main.py        app wiring (lifespan, CORS, middleware, routers)
config.py      pydantic-settings (IDEN_* env)
db.py          async engine, Base, init_db, get_session
models.py      Identity (pgvector Vector(512))
schemas.py     request / response Pydantic models
face.py        InsightFace pipeline (decode → resize → detect → align → embed)
storage.py     local mirror: local_store/<identity_id>/{face.jpg, record.json}
responses.py   success / error envelope + exception handlers
middleware.py  request-id middleware
capture.py     POST /api/v1/capture
verify.py      POST /api/v1/verify
```

## Requirements
- Python **3.13**
- NVIDIA GPU + recent drivers
- Postgres with the `vector` extension available (the server runs
  `CREATE EXTENSION IF NOT EXISTS vector` at startup)

## Configure
Set `IDEN_DATABASE_URL` in `.env`, e.g.:
```
IDEN_DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/db
```
Optional overrides: `IDEN_MATCH_THRESHOLD`, `IDEN_INSIGHTFACE_MODEL`,
`IDEN_DETECTOR_SIZE`, `IDEN_LOCAL_STORAGE_DIR`.

## Run
```bash
uv sync
uv run fastapi dev main.py --port 9000
```

## Endpoints

### POST `/api/v1/capture`
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
Pipeline: decode → detect (RetinaFace) → largest face → align (`norm_crop`)
→ embed (ArcFace) → persist to pgvector + `local_store/`.

Errors: `NO_FACE_DETECTED`, `INVALID_IMAGE`, `DUPLICATE_IDENTITY`.

### POST `/api/v1/verify`
Body:
```json
{ "image_base64": "<jpeg/png base64>" }
```
Detects **all** faces in the image, embeds each, and returns the nearest
pgvector match per face (cosine similarity, `IDEN_MATCH_THRESHOLD`).

Errors: `NO_FACE_DETECTED`, `INVALID_IMAGE`.
