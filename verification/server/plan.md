# Verification server — review, hardening & batching plan

## Context

The verification server (`verification/server/`) is an early-stage FastAPI app exposing
`/api/v1/capture` and `/api/v1/verify` backed by InsightFace `buffalo_l` and
pgvector. It currently accepts one image per request. You want to:

1. Accept a **list of images** per request without N×M database round trips.
2. Improve **face extraction & embedding accuracy**.
3. Make the server **deployable on Linux** (currently has Windows-only CUDA shims).

While reading every file I also found several issues that block production
readiness (the most severe being that `init_db()` wipes the DB on every restart).
This plan groups everything by impact and lays out the concrete changes.

---

## Issues identified (by severity)

### CRITICAL

1. **`init_db()` drops every table on every startup** — `db.py:22` calls
   `Base.metadata.drop_all`. First production restart = full identity wipe.
2. **No vector index on `Identity.embedding`** — `_best_match` (`verify.py:18-24`)
   does a sequential scan over all rows. Latency grows linearly; a 100k-row table
   at 512-dim is already painful.
3. **Sync InsightFace inference runs on the asyncio event loop** —
   `detect_largest`/`detect_all` (`face.py:126-133`) call `_face_app.get(img)`
   directly from `async def` handlers. While one face is being detected/embedded,
   **no other request can make progress**. This will be the single worst
   bottleneck under concurrent load.

### HIGH

4. **TOCTOU + IntegrityError leakage in `/capture`** —
   `capture.py:30-46` does a `SELECT` then `INSERT`. Concurrent identical
   `identity_code` posts race; duplicate `email` is never checked at all and
   surfaces as a 500 leaking the SQL error string.
5. **Catch-all error handler leaks exception details** — `responses.py:97-100`
   returns `f"{type(exc).__name__}: {exc}"` to the client. Stack-trace-quality
   info to attackers.
6. **Linux CUDA discovery is missing** — `_register_cuda_dll_dirs`
   (`face.py:18-39`) is Windows-only. On Linux, onnxruntime-gpu needs the
   matching CUDA + cuDNN libraries on the standard library path; without that
   it silently falls back to CPU (or fails to load).
7. **Multi-worker uvicorn + CUDA = broken on Linux** — uvicorn workers default
   to `fork` on Linux. CUDA contexts cannot be inherited across `fork`. Either
   single-worker or `spawn`.
8. **Validation gaps that allow easy DoS** — `image_base64: str` has no max
   length, no MIME check, no decoded-byte cap. A 200 MB base64 blob is happily
   accepted and decoded.

### MEDIUM

9. **No EXIF orientation handling** — Phone JPEGs commonly carry an
   orientation tag; `cv2.imdecode` ignores it. Faces appear sideways/upside-down,
   detector misses them or embeds at wrong rotation.
10. **No detection-quality gating** — A face with `det_score=0.42` or 18 px
    wide still produces an embedding and gets stored / matched. Garbage in,
    garbage out.
11. **One embedding per identity** — Robustness is noticeably better with 3–5
    captures averaged. Worth flagging as future work.
12. **OpenAPI docs missing per project CLAUDE.md** — Routes have no `summary`,
    `description`, `response_model`, `responses`, or Pydantic field
    descriptions. `/docs` is unhelpful.
13. **Storage write happens after DB commit** — `capture.py:46-49`. If the
    `cv2.imwrite` step crashes the row exists with no local mirror.
14. **`refresh()` after `add()+commit()` is unnecessary** — All defaults are
    Python-side (`uuid4`); `refresh()` is a wasted round trip.

### LOW

15. **CORS allows `*` unconditionally** — fine for dev, dangerous in prod.
16. **`schemas.email: str`** — should be `EmailStr` so bad addresses fail at
    validation rather than at the DB.
17. **No structured logging / request timing** — Hard to debug or tune in prod.
18. **`_resize` `max_side=1280` hardcoded** — should be config-driven.

---

## Recommended changes

All four design questions were answered: **Alembic** for schema, **`images: list[str]`**
for the batch API, **single SQL with `VALUES` + `LATERAL JOIN`** for batched
search, and a **CUDA 12.6 Dockerfile** for Linux deploy (matches the CUDA
version `onnxruntime-gpu` 1.20.x is built against).

### 1. Database

**`db.py`**
- Remove `drop_all()` from `init_db()`. Keep only `CREATE EXTENSION IF NOT
  EXISTS vector`.
- Tune the engine: `pool_size=10, max_overflow=20, pool_pre_ping=True`.

**Add Alembic** (`provider/alembic.ini` pattern is fine to mirror)
- `uv add alembic`
- `alembic init -t async migrations`
- Initial migration creates `identities` plus the HNSW index:
  ```sql
  CREATE INDEX IF NOT EXISTS identities_embedding_hnsw
    ON identities USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
  ```
- README: `uv run alembic upgrade head` is the new bootstrap step.

**`models.py`**
- Add `created_at` / `updated_at` `TIMESTAMPTZ` columns (server defaults
  `now()`). Useful for ops & for the local-mirror record.

### 2. Move sync inference off the event loop — `face.py` + handlers

- Wrap each call site with `fastapi.concurrency.run_in_threadpool`:
  ```python
  faces_per_image = await run_in_threadpool(detect_all_in_images, decoded_imgs)
  ```
- ONNX Runtime's `InferenceSession` is thread-safe; the threadpool is the
  cheapest correct fix.

### 3. Multi-image batching

**`schemas.py`**
- `VerifyRequest.images: list[str] = Field(min_length=1, max_length=settings.max_images_per_request)`
  with per-image and total-bytes guards (validator).
- Same shape for `CaptureRequest` if you want multi-photo enrollment; otherwise
  keep capture single-image and only batch verify.

**`face.py`**
- New `detect_all_in_images(decoded: list[np.ndarray]) -> list[list[DetectedFace]]`.
- Add **detection quality gate**: drop faces with
  `det_score < settings.min_det_score` (default `0.6`) and bbox area smaller
  than `settings.min_face_pixels²` (default `60`).
- Add **EXIF-aware decode** with Pillow:
  ```python
  from PIL import Image, ImageOps
  pil = ImageOps.exif_transpose(Image.open(io.BytesIO(raw)))
  img = cv2.cvtColor(np.array(pil.convert("RGB")), cv2.COLOR_RGB2BGR)
  ```
  Replaces the current `cv2.imdecode` path.
- `_resize` `max_side` becomes `settings.max_image_side`.

**`verify.py` — single-query batched search**

Replace the per-face loop with one SQL using `unnest` + `LATERAL`:

```python
async def _best_matches(
    session: AsyncSession, embeddings: list[list[float]]
) -> list[tuple[Identity | None, float]]:
    stmt = text("""
        SELECT q.idx,
               i.identity_id, i.identity_code, i.display_name,
               1 - (i.embedding <=> q.vec) AS score
        FROM unnest(CAST(:vecs AS vector[])) WITH ORDINALITY AS q(vec, idx)
        LEFT JOIN LATERAL (
            SELECT identity_id, identity_code, display_name, embedding
            FROM identities
            ORDER BY embedding <=> q.vec
            LIMIT 1
        ) AS i ON true
        ORDER BY q.idx;
    """)
    rows = (await session.execute(stmt, {"vecs": embeddings})).all()
    ...
```

This is **one round trip** and the HNSW index is consulted per probe inside
the lateral subquery. Falls back gracefully even when an image has zero faces
(skip it before building the array).

### 4. `/capture` correctness

- Drop the explicit `SELECT … WHERE identity_code = …` race check.
- Wrap `await session.commit()` in `try/except IntegrityError`. Inspect
  `exc.orig.constraint_name` (asyncpg) or `str(exc.orig)` to map to either
  `DUPLICATE_IDENTITY` or `DUPLICATE_EMAIL` and return a clean 409.
- Remove the unnecessary `await session.refresh(identity)` — defaults are set
  Python-side.
- Reorder: write the local mirror **before** commit so a crash leaves no
  orphaned DB row. (Or accept DB-as-truth and make `save_capture` best-effort
  with its own try/log.)

### 5. Error handler & docs hygiene

- `responses.py`: replace catch-all `message=f"{type(exc).__name__}: {exc}"`
  with `message="Internal server error"`. Keep the `logger.exception` line;
  log the request_id so ops can correlate.
- Every route gets `summary`, `description` (mention errors), `response_model`,
  `status_code`, and `responses={400: {...}, 409: {...}}` per project CLAUDE.md.
- Pydantic schemas get `Field(description=…)` on every field.

### 6. Linux deployment — Dockerfile + runtime

**New file: `verification/server/Dockerfile`**

Using `nvidia/cuda:12.6.3-cudnn-runtime-ubuntu24.04` — this is the latest
CUDA 12.x cuDNN runtime image and is the version `onnxruntime-gpu` 1.20.x
is precompiled against (it loads `libcudart.so.12` and `libcudnn.so.9`).

```dockerfile
FROM nvidia/cuda:12.6.3-cudnn-runtime-ubuntu24.04 AS base

ENV PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3.13 python3.13-venv python3-pip libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY . .

# CUDA contexts can't survive fork → single worker.
EXPOSE 9000
CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", \
     "--port", "9000", "--workers", "1"]
```

- Document `docker run --gpus all -p 9000:9000 ...` and the NVIDIA Container
  Toolkit prerequisite in README.
- `face.py`: keep `_register_cuda_dll_dirs` Windows-only; on Linux the CUDA
  base image puts cuDNN on the standard library path so no preload is needed.
- Add a **healthcheck endpoint** `GET /healthz` that returns 200 once
  `_get_app()` has loaded — both for Docker `HEALTHCHECK` and for warming
  the model at startup (call it from `lifespan`).

### 7. Config additions — `config.py`

```python
max_images_per_request: int = 8
max_image_bytes: int = 10 * 1024 * 1024     # per image, post-base64-decode
max_image_side: int = 1280
min_det_score: float = 0.6
min_face_pixels: int = 60
allowed_origins: list[str] = ["*"]          # tighten via env in prod
log_level: str = "INFO"
```

### 8. Defer to follow-up (out of scope here)

- Multiple embeddings per identity (averaged or stored separately, then taking
  best-of-N at match time). Material accuracy win but a schema change.
- Replace argon2/secret hashing parity with the rest of the project (this
  service has no auth at all today; will need it before exposure).
- Rate limiting (slowapi or upstream).

---

## Files that will change

| File | Change |
|---|---|
| `db.py` | drop wipe, add pool tuning, ensure extension only |
| `models.py` | add timestamps |
| `face.py` | EXIF decode, quality gate, `detect_all_in_images`, threadpool-safe |
| `capture.py` | IntegrityError mapping, OpenAPI metadata, run_in_threadpool, reorder mirror→commit |
| `verify.py` | accept `images`, batched SQL via `unnest`+`LATERAL`, OpenAPI metadata, run_in_threadpool |
| `schemas.py` | `images: list[str]`, `EmailStr`, field descriptions, byte-limit validators |
| `responses.py` | scrub catch-all leak |
| `config.py` | new tunables |
| `main.py` | warm model in lifespan, tighten CORS via settings, mount `/healthz` |
| `pyproject.toml` | `uv add alembic pillow email-validator` |
| `Dockerfile` | **new** — CUDA 12.6.3 + cuDNN runtime base |
| `migrations/` | **new** — Alembic init + first migration with HNSW index |
| `README.md` | document Alembic, Docker run, GPU prerequisites |

---

## Verification

Local sanity (Mac, CPU fallback):
1. `uv sync && uv run alembic upgrade head`
2. `uv run fastapi dev main.py --port 9000`
3. `curl POST /api/v1/capture` with one image → 201, identity row created.
4. `curl POST /api/v1/verify` with `images: [a, b, c]` (one of which contains
   a previously captured face) → response shape matches `VerifyData`, matched
   face has `confidence ≥ 0.5`, single SQL query observed in `EXPLAIN ANALYZE`.
5. Restart server → identities **persist** (proves wipe is gone).
6. Concurrency check: fire 20 parallel verify requests via `hey` or `oha`;
   confirm event loop stays responsive (a `/healthz` ping should still answer
   in < 50 ms during inference).

Linux/GPU smoke (in Docker):
1. `docker build -t iden-verify .`
2. `docker run --gpus all --env-file .env -p 9000:9000 iden-verify`
3. Container logs show `CUDAExecutionProvider` selected, not `CPUExecutionProvider`.
4. Same capture+verify round-trip as above; latency per face should be ~10–30 ms
   on a modern GPU vs ~150–300 ms on CPU.

`EXPLAIN ANALYZE` on the batched verify query must show
`Index Scan using identities_embedding_hnsw` inside the lateral, not a
sequential scan.
