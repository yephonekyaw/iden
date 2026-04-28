# IDEN Verification API

Base URL: `https://<host>/api/v1`

All endpoints return a consistent JSON envelope described in [Response Format](#response-format). The server must finish loading the face model before any endpoint is ready — poll [`GET /healthz`](#get-healthz) to check.

---

## Table of Contents

1. [Response Format](#response-format)
2. [Error Codes](#error-codes)
3. [Headers](#headers)
4. [Endpoints](#endpoints)
   - [GET /healthz](#get-healthz)
   - [POST /api/v1/capture](#post-apiv1capture)
   - [POST /api/v1/verify](#post-apiv1verify)
5. [Configuration Limits](#configuration-limits)

---

## Response Format

Every response follows this envelope, regardless of success or failure.

### Success

```json
{
  "success": true,
  "status": 200,
  "data": { },
  "message": "Human-readable summary",
  "meta": {
    "endpoint": "/api/v1/verify",
    "timestamp": "2026-04-27T10:00:00Z",
    "request_id": "req_a1b2c3d4e5f6..."
  }
}
```

### Error

```json
{
  "success": false,
  "status": 400,
  "data": null,
  "message": "Human-readable summary",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": [
      {
        "field": "images",
        "message": "List should have at least 1 item after validation, not 0"
      }
    ]
  },
  "meta": {
    "endpoint": "/api/v1/verify",
    "timestamp": "2026-04-27T10:00:00Z",
    "request_id": "req_a1b2c3d4e5f6..."
  }
}
```

| Field | Type | Description |
|---|---|---|
| `success` | `boolean` | `true` on 2xx, `false` otherwise |
| `status` | `integer` | Mirrors the HTTP status code |
| `data` | `object \| null` | Endpoint-specific payload; `null` on error |
| `message` | `string` | Short human-readable summary |
| `error` | `object` | Present only on error responses |
| `error.code` | `string` | Machine-readable error code (see [Error Codes](#error-codes)) |
| `error.details` | `array \| null` | Field-level validation errors; `null` when not applicable |
| `meta.endpoint` | `string` | Request path |
| `meta.timestamp` | `string` | UTC ISO 8601 |
| `meta.request_id` | `string` | Echoes `x-request-id` header, or auto-generated `req_<hex>` |

---

## Error Codes

| Code | HTTP | Description |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Request payload failed schema validation. `error.details` lists each failing field. |
| `INVALID_IMAGE` | 400 | Image could not be decoded (unsupported format or corrupt data). |
| `IMAGE_TOO_LARGE` | 400 | Decoded image exceeds the 10 MiB limit. |
| `NO_FACE_DETECTED` | 400 | No qualifying face found (detector score < 0.6 or face smaller than 60 px). |
| `DUPLICATE_IDENTITY` | 409 | `identity_code` already exists in the database. |
| `DUPLICATE_EMAIL` | 409 | `email` already exists in the database. |
| `DUPLICATE_RESOURCE` | 409 | Another uniqueness constraint was violated. |
| `INTERNAL_ERROR` | 500 | Unhandled server error. |

> **Note — verify endpoint:** `INVALID_IMAGE`, `IMAGE_TOO_LARGE`, and `NO_FACE_DETECTED` are **not** top-level errors for `/api/v1/verify`. They are collected per-image and returned inside `data.image_errors` so that one bad image does not fail the whole request. The request only returns a 400 if the payload itself is invalid.

---

## Headers

### Request Headers

| Header | Required | Description |
|---|---|---|
| `Content-Type` | Yes | Must be `application/json` |
| `x-request-id` | No | Client-supplied trace ID. Echoed back in the response header and `meta.request_id`. If omitted, the server generates `req_<hex>`. |

### Response Headers

| Header | Description |
|---|---|
| `x-request-id` | The request ID used for this request (client-supplied or generated) |

---

## Endpoints

---

### GET /healthz

Liveness probe. Returns once the face model has finished loading. Poll this before sending requests after a cold start.

**Request:** No body, no parameters.

**Response `200 OK`:**

```json
{ "status": "ok" }
```

> This endpoint does **not** use the standard response envelope — it returns the plain object above.

---

### POST /api/v1/capture

Enroll a new identity by submitting a facial image alongside profile data. The server decodes the image, detects the largest qualifying face, generates a 512-dimension ArcFace embedding, and stores the identity in the database.

Only one face needs to be visible; the largest qualifying face is used. Duplicate `identity_code` or `email` values are rejected with `409`.

**Request Body:**

```json
{
  "display_name": "Jane Smith",
  "identity_code": "STU-00123",
  "email": "jane@university.edu",
  "department": "Computer Science",
  "image_base64": "<base64-encoded image>"
}
```

| Field | Type | Constraints | Description |
|---|---|---|---|
| `display_name` | `string` | 1–255 chars | Human-readable full name |
| `identity_code` | `string` | 1–64 chars, **unique** | Stable external identifier (e.g. student ID) |
| `email` | `string` | valid email, **unique** | Contact email |
| `department` | `string` | 1–255 chars | Organisational unit |
| `image_base64` | `string` | non-empty | Base64-encoded image. Data URI prefix (`data:image/jpeg;base64,...`) is accepted and stripped automatically. |

**Response `201 Created`:**

```json
{
  "success": true,
  "status": 201,
  "data": {
    "identity_id": "550e8400-e29b-41d4-a716-446655440000",
    "identity_code": "STU-00123",
    "display_name": "Jane Smith",
    "email": "jane@university.edu",
    "department": "Computer Science"
  },
  "message": "Capture stored",
  "meta": {
    "endpoint": "/api/v1/capture",
    "timestamp": "2026-04-27T10:00:00Z",
    "request_id": "req_a1b2c3d4e5f6..."
  }
}
```

| `data` field | Type | Description |
|---|---|---|
| `identity_id` | `string` | Server-assigned UUID |
| `identity_code` | `string` | Echoes the submitted `identity_code` |
| `display_name` | `string` | Echoes the submitted `display_name` |
| `email` | `string` | Echoes the submitted `email` |
| `department` | `string` | Echoes the submitted `department` |

**Error Responses:**

| Status | Code | Trigger |
|---|---|---|
| 400 | `NO_FACE_DETECTED` | No face found, or face quality too low (det score < 0.6, or face < 60 px on any side) |
| 400 | `INVALID_IMAGE` | Image could not be decoded |
| 400 | `IMAGE_TOO_LARGE` | Decoded image exceeds 10 MiB |
| 400 | `VALIDATION_ERROR` | One or more body fields failed schema validation |
| 409 | `DUPLICATE_IDENTITY` | `identity_code` already registered |
| 409 | `DUPLICATE_EMAIL` | `email` already registered |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

---

### POST /api/v1/verify

Detect all faces across one or more images and match each one against the enrolled identity database using cosine similarity over a pgvector HNSW index. All embeddings are resolved in a single SQL round trip.

Per-image errors (bad images, no faces) are collected into `data.image_errors` and do not fail the overall request. The request fails with `400` only if the payload itself is invalid.

**Request Body:**

```json
{
  "images": [
    "<base64-encoded image 1>",
    "<base64-encoded image 2>"
  ]
}
```

| Field | Type | Constraints | Description |
|---|---|---|---|
| `images` | `string[]` | 1–8 items | Each element is a base64-encoded image. Data URI prefix is accepted. Each image must decode to ≤ 10 MiB. |

**Response `200 OK`:**

```json
{
  "success": true,
  "status": 200,
  "data": {
    "total_images": 2,
    "total_faces": 2,
    "matched": 1,
    "unmatched": 1,
    "results": [
      {
        "image_index": 0,
        "face_index": 0,
        "bbox": [142.3, 89.1, 310.7, 298.4],
        "match_found": true,
        "identity": {
          "identity_id": "550e8400-e29b-41d4-a716-446655440000",
          "identity_code": "STU-00123",
          "display_name": "Jane Smith",
          "email": "jane@university.edu",
          "department": "Computer Science"
        },
        "confidence": 0.9312,
        "det_score": 0.9876
      },
      {
        "image_index": 1,
        "face_index": 0,
        "bbox": [55.0, 40.2, 220.0, 240.8],
        "match_found": false,
        "identity": null,
        "confidence": 0.3104,
        "det_score": 0.9541
      }
    ],
    "image_errors": []
  },
  "message": "Verification completed",
  "meta": {
    "endpoint": "/api/v1/verify",
    "timestamp": "2026-04-27T10:00:00Z",
    "request_id": "req_a1b2c3d4e5f6..."
  }
}
```

**`data` fields:**

| Field | Type | Description |
|---|---|---|
| `total_images` | `integer` | Number of images in the request |
| `total_faces` | `integer` | Total faces successfully detected across all images |
| `matched` | `integer` | Number of faces that exceeded the match threshold |
| `unmatched` | `integer` | Number of faces that did not exceed the match threshold |
| `results` | `FaceResult[]` | One entry per detected face (see below) |
| `image_errors` | `ImageError[]` | Per-image errors for images that could not be decoded or contained no face; omitted from `results` |

**`FaceResult` object:**

| Field | Type | Description |
|---|---|---|
| `image_index` | `integer` | Zero-based index of the source image in the request array |
| `face_index` | `integer` | Zero-based index of this face within that image |
| `bbox` | `[x1, y1, x2, y2]` | Bounding box in pixel coordinates of the resized image (max side 1280 px) |
| `match_found` | `boolean` | `true` if cosine similarity ≥ match threshold (default 0.50) |
| `identity` | `MatchedIdentity \| null` | Matched identity; `null` when `match_found` is `false` |
| `confidence` | `float` | Cosine similarity score in [0, 1], 4 decimal places |
| `det_score` | `float` | Face detector confidence in [0, 1], 4 decimal places |

**`MatchedIdentity` object:**

| Field | Type | Description |
|---|---|---|
| `identity_id` | `string` | UUID of the matched identity |
| `identity_code` | `string` | External identifier (e.g. student ID) |
| `display_name` | `string` | Human-readable name |
| `email` | `string` | Email address of the matched identity |
| `department` | `string` | Department of the matched identity |

**`ImageError` object:**

| Field | Type | Description |
|---|---|---|
| `image_index` | `integer` | Zero-based index of the failing image in the request array |
| `code` | `string` | `INVALID_IMAGE`, `IMAGE_TOO_LARGE`, or `NO_FACE_DETECTED` |
| `message` | `string` | Human-readable reason |

**Error Responses:**

| Status | Code | Trigger |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Payload invalid — e.g. `images` is empty or exceeds 8 items |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

**Example with image errors:**

If one image is unreadable and another has no face, `results` only contains entries for the images that succeeded, and `image_errors` lists the failures:

```json
{
  "data": {
    "total_images": 3,
    "total_faces": 1,
    "matched": 1,
    "unmatched": 0,
    "results": [
      {
        "image_index": 0,
        "face_index": 0,
        "bbox": [142.3, 89.1, 310.7, 298.4],
        "match_found": true,
        "identity": {
          "identity_id": "550e8400-e29b-41d4-a716-446655440000",
          "identity_code": "STU-00123",
          "display_name": "Jane Smith",
          "email": "jane@university.edu",
          "department": "Computer Science"
        },
        "confidence": 0.9312,
        "det_score": 0.9876
      }
    ],
    "image_errors": [
      {
        "image_index": 1,
        "code": "INVALID_IMAGE",
        "message": "Image could not be decoded"
      },
      {
        "image_index": 2,
        "code": "NO_FACE_DETECTED",
        "message": "No face detected in the image"
      }
    ]
  }
}
```

---

## Configuration Limits

These values are configurable via `IDEN_`-prefixed environment variables. The defaults are shown below.

| Parameter | Env var | Default | Description |
|---|---|---|---|
| Max images per request | `IDEN_MAX_IMAGES_PER_REQUEST` | `8` | Hard limit on `images` array length in `/verify` |
| Max image size | `IDEN_MAX_IMAGE_BYTES` | `10485760` (10 MiB) | Max decoded image size in bytes |
| Max image side | `IDEN_MAX_IMAGE_SIDE` | `1280` px | Images are downscaled to this before face detection; `bbox` coordinates are in this resized space |
| Min detector score | `IDEN_MIN_DET_SCORE` | `0.6` | Faces with a detector confidence below this are discarded |
| Min face pixels | `IDEN_MIN_FACE_PIXELS` | `60` px | Faces smaller than this on any side are discarded |
| Match threshold | `IDEN_MATCH_THRESHOLD` | `0.50` | Minimum cosine similarity to consider a face matched |
| Embedding dimensions | `IDEN_EMBEDDING_DIM` | `512` | ArcFace (buffalo_l) embedding size — do not change after data is enrolled |
