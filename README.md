# Project IDEN — Open Source Biometric Identity Provider

An open-source Identity Provider (IDP) with facial biometric authentication, built on the OpenID Connect (OIDC) standard. IDEN provides a complete authentication platform with traditional email/password login, TOTP-based MFA, and facial recognition — all deployable via Docker Compose.

---

## Table of Contents

- [System Architecture](#system-architecture)
- [Component Overview](#component-overview)
- [Authorization Model](#authorization-model)
- [Authentication Assurance (acr / amr)](#authentication-assurance-acr--amr)
- [Component Interactions & Flows](#component-interactions--flows)
- [Database Schema](#database-schema)
- [Provider Internal Architecture](#provider-internal-architecture)
- [Docker Network Topology](#docker-network-topology)
- [Project Structure](#project-structure)
- [Key Design Decisions](#key-design-decisions)
- [Quick Start](#quick-start)
- [Development Phases](#development-phases)

---

## System Architecture

```mermaid
flowchart TB
  subgraph External["External Clients — Core"]
    Browser["Browser (User)"]
    ThirdParty["Third-Party OIDC Client"]
  end

  subgraph ExternalExt["External Clients — Extension"]
    Kiosk["Biometric Kiosk Device"]
  end

  Nginx["Nginx Reverse Proxy<br/>:80 / :443"]

  Browser --> Nginx
  ThirdParty --> Nginx
  Kiosk --> Nginx

  subgraph Core["Core — Default IdP"]
    direction TB

    subgraph Provider["provider :8000 — single FastAPI app (Python 3.14)"]
      direction TB
      AuthZ["AuthZ Server module<br/>/.well-known/*, /oauth2/*"]
      Admin["Admin RS module<br/>/admin/*"]
      Entity["Entity RS module<br/>/entity/*"]
      Biometric["Biometric RS module<br/>/biometric/*<br/>⟮extension⟯"]
    end

    AuthUI["auth-ui :4000<br/>/auth/login, /auth/consent"]
    Dashboard["dashboard :3000<br/>Bootstrapped OIDC client"]

    Postgres[("PostgreSQL :5432")]
    Redis[("Redis :6379")]
    MinIO[("MinIO :9000<br/>S3-compatible object store")]
  end

  subgraph Extension["Extension — Biometric Credential"]
    direction TB
    Engine["Biometric Engine :8000<br/>INTERNAL ONLY · FastAPI + ONNX"]
    PgVector[("PostgreSQL + pgvector")]
  end

  Nginx -->|"/oauth2/*, /.well-known/*,<br/>/admin/*, /entity/*, /biometric/*"| Provider
  Nginx -->|"/auth/*"| AuthUI
  Nginx -->|"/* (everything else)"| Dashboard

  Biometric --> Engine
  Engine --> PgVector
  Engine --> MinIO

  Provider --> Postgres
  Provider --> Redis
  Provider --> MinIO

  style Core fill:#1a1a2e,stroke:#4a90d9,stroke-width:2px,color:#ffffff
  style Extension fill:#2e1a2e,stroke:#d94a90,stroke-width:2px,color:#ffffff,stroke-dasharray: 5 5
  style ExternalExt fill:#2e1a2e,stroke:#d94a90,stroke-width:2px,color:#ffffff,stroke-dasharray: 5 5
  style Biometric stroke:#d94a90,stroke-width:2px,stroke-dasharray: 5 5
```

---

## Component Overview

| Component | Tech Stack | Port | Purpose |
|-----------|-----------|------|---------|
| **provider** | Python 3.14, FastAPI, Authlib, asyncpg | 8080 | Single FastAPI app hosting four logical modules: AuthZ Server (`/oauth2/*`, `/.well-known/*`), Admin RS (`/admin/*`), Entity RS (`/entity/*`), Biometric RS (`/biometric/*`) |
| **engine** | Python 3.14, FastAPI, InsightFace, ONNX | 8000 | Internal biometric engine — face detection, embedding, liveness (no external access) |
| **dashboard** | Next.js 15, React, Tailwind CSS | 3000 | Single-page app for both admin and end-user activities (bootstrapped OIDC client) |
| **auth-ui** | Next.js 15, React, Tailwind CSS | 3001 | Login + consent pages — supports password, TOTP, and **biometric (face)** login paths. Hosted UI invoked by `/authorize`. |
| **kiosk** | Hardware + Next.js / native | n/a | Biometric kiosk device — uses `client_credentials` grant to call `biometric-api` |
| **postgres** | PostgreSQL 16 + pgvector | 5432 | Persistent storage for users, clients, tokens, embeddings, scopes |
| **redis** | Redis 7 | 6379 | Sessions, login/consent challenges, rate limits |
| **minio** | MinIO (S3-compatible) | 9000 | Blob storage for files — enrollment/verification images, profile photos, audit snapshots. Keeps large binaries out of Postgres. |
| **nginx** | Nginx Alpine | 80/443 | Reverse proxy, TLS termination, path-based routing |

---

## Authorization Model

IDEN uses **fine-grained scopes embedded in access tokens** for all API authorization. We deliberately do **not** use RBAC at the resource-server layer (unlike Keycloak):

- **Scopes describe APIs**, not users. Examples: `admin:clients:read`, `admin:kiosks:write`, `entity:profile:read`, `entity:totp:enroll`, `biometric:verify`.
- **Roles only gate scope issuance.** When a user authenticates and the AuthZ Server mints a token, it filters the requested scopes against what the logged-in user's role permits. Resource servers themselves never inspect roles — they only check the scopes present in the token.
- **Scopes are not user-creatable.** The set of scopes is fixed by IDEN and corresponds 1:1 to the APIs exposed by the admin / entity / biometric resource servers. There is no `/admin/scopes` *create* endpoint — the `/admin/scopes` API is read-only metadata.
- **The Dashboard SPA requests broad scopes.** Because it serves both admin and end-user use cases, it asks for many scopes during `/authorize`. The AuthZ Server prunes the granted scope set per the user's role at token issuance. A non-admin user receives a token with only entity scopes, even if admin scopes were requested.

This keeps resource servers stateless with respect to identity — they only validate `scope` and `sub` claims.

---

## Authentication Assurance (acr / amr)

IDEN supports multiple authentication methods — password, TOTP, and **facial biometric** — and reports them to relying parties using the two standard OIDC id-token claims:

- **`amr`** (Authentication Methods References, [RFC 8176](https://datatracker.ietf.org/doc/html/rfc8176)) — an array naming the methods actually used. IDEN emits values from a fixed set:

  | `amr` value | Meaning |
  |---|---|
  | `pwd` | Password |
  | `otp` | TOTP (RFC 6238) |
  | `face` | Facial biometric match (liveness-verified) |
  | `mfa` | Present whenever two or more of the above were used |

- **`acr`** (Authentication Context Class Reference) — a single string naming the assurance *level*. IDEN defines its own taxonomy:

  | `acr` value | Requires |
  |---|---|
  | `iden:loa:1` | Any single factor — `pwd`, or `face` with liveness |
  | `iden:loa:2` | Two factors — e.g. `pwd + otp`, `pwd + face`, `face + otp` |
  | `iden:loa:3` | Strong — `face` (liveness-verified) plus one additional factor |

### How it plays out in the protocol

- Clients may request a minimum level at `/authorize` using `acr_values=iden:loa:2`.
- If the user's current session doesn't meet the requested level, the AuthZ module forces a step-up login (e.g. prompts for TOTP after a password-only login) before issuing the code.
- The issued id_token contains both claims, e.g.:
  ```json
  { "sub": "...", "acr": "iden:loa:2", "amr": ["pwd", "face", "mfa"], ... }
  ```
- Discovery (`/.well-known/openid-configuration`) advertises `acr_values_supported` and lists `acr` + `amr` under `claims_supported`.

### How methods map to the login UI

The Auth UI offers a method picker on the login page. Each choice resolves to a distinct AuthZ endpoint that records the method into the session:

| Method | Endpoint | Session gets |
|---|---|---|
| Password | `POST /api/v1/auth/login` | `amr += ["pwd"]` |
| TOTP (step-up) | `POST /api/v1/auth/totp` | `amr += ["otp"]` |
| Biometric (face) | `POST /api/v1/auth/biometric` | `amr += ["face"]` (only if engine reports liveness-verified match) |

The Provider computes `acr` from `amr` at token-issuance time using the table above.

---

## Component Interactions & Flows

In all flows below, **Provider** refers to the single FastAPI service on `:8000` — its AuthZ, Admin, Entity, and Biometric modules are called out separately only to clarify which routes are in play.

### Flow 1: OIDC Authorization Code Flow (via Auth UI)

```mermaid
sequenceDiagram
  autonumber
  participant C as Third-Party Client
  participant N as Nginx
  participant P as Provider
  participant U as Auth UI SPA

  C->>N: GET /oauth2/authorize?client_id=X&scope=...&code_challenge=C&acr_values=iden:loa:2
  N->>P: forward
  P->>P: create login_challenge in Redis (10m TTL), remember required acr
  P-->>C: 302 /auth/login?login_challenge={id}
  C->>U: browser loads /auth/login
  Note over U: user picks a method (pwd / face)
  U->>P: POST /api/v1/auth/{login|biometric} {challenge, credentials}
  P->>P: validate, record amr on session
  P->>P: if session acr < required, force step-up (e.g. prompt TOTP)
  U->>P: POST /api/v1/auth/totp {challenge, code}  (if step-up)
  P->>P: recompute session acr from amr
  P-->>C: 302 /auth/consent?consent_challenge={id}
  C->>U: browser loads /auth/consent
  U->>P: POST /api/v1/auth/consent {challenge, grant_scopes}
  P->>P: filter requested scopes by user role
  P->>P: Authlib issues auth code, stores PKCE
  P-->>C: 302 redirect_uri?code=X&state=Z
  C->>P: POST /oauth2/token {code, code_verifier, ...}
  P->>P: verify PKCE, issue access + id + refresh tokens<br/>(id_token includes acr + amr)
  P-->>C: {access_token, id_token, refresh_token}
```

### Flow 1b: Biometric Login Branch (expands the login POST in Flow 1)

```mermaid
sequenceDiagram
  autonumber
  participant U as Auth UI SPA
  participant P as Provider
  participant E as Biometric Engine
  participant DB as Postgres

  U->>P: POST /api/v1/auth/biometric {challenge, image}
  P->>E: forward image
  E->>DB: pgvector similarity search (user_biometrics)
  DB-->>E: nearest match
  E->>E: liveness check + quality gate
  E-->>P: {match, entity_id, liveness_ok, confidence}
  alt match + liveness_ok
    P->>P: bind session to entity, amr += ["face"]
    P-->>U: 200 {next: consent_or_stepup}
  else
    P-->>U: 401 {reason}
  end
```

The session's `amr` now contains `face`. If the client asked for `acr_values=iden:loa:2` and face alone only satisfies `iden:loa:1`, Flow 1's step-up prompt kicks in (e.g. TOTP) before the consent challenge is minted.

### Flow 2: Dashboard SPA — Admin Action

```mermaid
sequenceDiagram
  autonumber
  participant B as Admin Browser
  participant D as Dashboard SPA
  participant P as Provider
  participant DB as Postgres

  Note over B,D: Already authenticated — access token in memory
  B->>D: Click "Add OIDC Client"
  D->>P: POST /admin/clients<br/>Authorization: Bearer {token with admin:clients:write}
  P->>P: validate token in-process
  P->>DB: INSERT
  P-->>D: 201 Created
  D-->>B: show success
```

### Flow 3: Dashboard SPA — Entity Self-Service (TOTP Enrollment)

```mermaid
sequenceDiagram
  autonumber
  participant B as End-User Browser
  participant D as Dashboard SPA
  participant P as Provider
  participant DB as Postgres

  B->>D: Click "Enroll TOTP"
  D->>P: POST /entity/totp/enroll<br/>Authorization: Bearer {entity:totp:enroll}
  P->>P: generate secret
  P->>DB: INSERT totp secret
  P-->>D: 200 {qr_uri, secret}
  D-->>B: render QR code
```

### Flow 4: Biometric Kiosk Enrollment (client_credentials)

```mermaid
sequenceDiagram
  autonumber
  participant K as Kiosk Device
  participant P as Provider
  participant E as Biometric Engine
  participant DB as Postgres

  K->>P: POST /oauth2/token<br/>grant_type=client_credentials<br/>scope=biometric:enroll
  P->>P: validate kiosk client creds
  P-->>K: {access_token}
  Note over K: capture face image
  K->>P: POST /biometric/enroll<br/>Bearer {token}<br/>{image, kiosk_id, [user_id]}
  P->>E: forward image
  E->>E: liveness check + embedding
  E-->>P: {embedding, quality}
  P->>DB: INSERT embedding
  P-->>K: {entity_id, status}
```

> **Further thought needed:** what data the kiosk attaches when enrolling a *new* (non-existing) user, and how the system later prompts that user to complete their profile via the Dashboard SPA.

### Flow 5: Biometric Verification (External OAuth Client)

```mermaid
sequenceDiagram
  autonumber
  participant C as Third-Party Client
  participant P as Provider
  participant E as Biometric Engine
  participant DB as Postgres

  Note over C,P: already obtained access token with biometric:verify
  C->>P: POST /biometric/verify<br/>Bearer {token}<br/>{image}
  P->>E: forward image
  E->>DB: pgvector similarity search
  DB-->>E: nearest match
  E-->>P: {match, confidence}
  P-->>C: {match: true, entity_id, confidence}
```

### Flow 6: Session & Challenge Lifecycle (Redis)

```mermaid
stateDiagram-v2
  direction LR

  state "Login Challenge" as LC {
    [*] --> LC_Created: created
    LC_Created --> LC_Expired: 10m TTL
    LC_Created --> LC_Consumed: login success
    LC_Consumed --> [*]
    LC_Expired --> [*]
  }

  state "Consent Challenge" as CC {
    [*] --> CC_Created: created
    CC_Created --> CC_Expired: 10m TTL
    CC_Created --> CC_Consumed: consent granted
    CC_Consumed --> [*]: auth code issued
    CC_Expired --> [*]
  }

  state "Session" as S {
    [*] --> S_Active: login success
    S_Active --> S_Active: request (reset TTL)
    S_Active --> S_Expired: 24h sliding TTL
    S_Expired --> [*]
  }
```

---

## Database Schema

```mermaid
erDiagram
  organizations ||--o{ users : "has"
  users ||--o{ user_credentials : "has"
  users ||--o{ user_biometrics : "has"
  users ||--o{ audit_log : "emits"
  organizations ||--o{ oidc_clients : "owns"
  organizations ||--o{ kiosk_devices : "owns"
  oidc_clients ||--o{ kiosk_devices : "authenticates-as"

  organizations {
    UUID id PK
    TEXT name
    TEXT slug UK
    TIMESTAMPTZ created_at
    TIMESTAMPTZ updated_at
  }

  users {
    UUID id PK
    UUID org_id FK
    TEXT email UK
    TEXT display_name
    TEXT role "gates scope issuance"
    TEXT status
    TIMESTAMPTZ created_at
    TIMESTAMPTZ updated_at
  }

  user_credentials {
    UUID id PK
    UUID user_id FK
    TEXT cred_type
    TEXT password_hash
    TEXT totp_secret
    TIMESTAMPTZ created_at
    TIMESTAMPTZ updated_at
  }

  user_biometrics {
    UUID id PK
    UUID user_id FK
    VECTOR face_embedding
    FLOAT quality
    TIMESTAMPTZ created_at
    TIMESTAMPTZ updated_at
  }

  audit_log {
    UUID id PK
    UUID user_id FK
    TEXT action
    JSONB detail
    TEXT ip_addr
    TIMESTAMPTZ created_at
  }

  oidc_clients {
    TEXT id PK
    TEXT secret_hash
    TEXT_ARRAY redirect_uris
    TEXT_ARRAY grant_types
    TEXT_ARRAY response_types
    TEXT_ARRAY allowed_scopes
    TEXT_ARRAY audience
    BOOL is_public
    UUID org_id FK
    TEXT client_kind
    TIMESTAMPTZ created_at
    TIMESTAMPTZ updated_at
  }

  kiosk_devices {
    UUID id PK
    UUID org_id FK
    TEXT name
    TEXT hw_id UK
    TEXT status
    TEXT client_id FK "client_credentials grant"
    TIMESTAMPTZ last_seen
    TIMESTAMPTZ created_at
  }

  scopes {
    TEXT name PK
    TEXT description
    TEXT resource "admin | entity | biometric"
    TEXT_ARRAY allowed_roles
    TIMESTAMPTZ created_at
  }

  oauth2_auth_codes {
    TEXT signature PK
    TEXT request_id
    JSONB session_data
    TEXT client_id FK
    BOOL active
    TIMESTAMPTZ created_at
  }

  oauth2_access_tokens {
    TEXT signature PK
    TEXT request_id
    JSONB session_data
    TEXT client_id FK
    BOOL active
    TIMESTAMPTZ created_at
  }

  oauth2_refresh_tokens {
    TEXT signature PK
    TEXT request_id
    JSONB session_data
    TEXT client_id FK
    BOOL active
    TIMESTAMPTZ created_at
  }

  oauth2_pkce {
    TEXT signature PK
    TEXT request_id
    JSONB session_data
    TIMESTAMPTZ created_at
  }

  oauth2_oidc {
    TEXT signature PK
    TEXT request_id
    JSONB session_data
    TEXT client_id FK
    TIMESTAMPTZ created_at
  }

  oidc_clients ||--o{ oauth2_auth_codes : "issues"
  oidc_clients ||--o{ oauth2_access_tokens : "issues"
  oidc_clients ||--o{ oauth2_refresh_tokens : "issues"
  oidc_clients ||--o{ oauth2_oidc : "issues"
```

> `scopes` is read-only metadata (seeded, not user-managed). The five `oauth2_*` tables are Authlib's storage tables for the OAuth2/OIDC grant flows.

---

## Provider Internal Architecture

```mermaid
flowchart TB
  Entry["provider/main.py<br/>loads config, mounts routers"]

  subgraph App["FastAPI Application (:8000)"]
    direction TB

    subgraph Middleware["Middleware Stack"]
      MW1["structlog logging"] --> MW2["rate limiter (Redis)"] --> MW3["CORS / security headers"]
    end

    subgraph AuthZMod["AuthZ Module"]
      AZ1["/.well-known/openid-configuration → oidc.discovery"]
      AZ2["/.well-known/jwks.json → crypto.jwks"]
      AZ3["/oauth2/authorize, /token, /userinfo"]
      AZ4["/oauth2/revoke, /introspect, /logout"]
      AZ5["/api/v1/auth/login · /totp · /biometric · /consent<br/>(records amr → derives acr)"]
    end

    subgraph AdminMod["Admin RS Module (scope-gated)"]
      AD1["/admin/clients · admin:clients:*"]
      AD2["/admin/kiosks · admin:kiosks:*"]
      AD3["/admin/users · admin:users:*"]
      AD4["/admin/scopes · read-only"]
    end

    subgraph EntityMod["Entity RS Module (scope-gated)"]
      EN1["/entity/profile"]
      EN2["/entity/credentials"]
      EN3["/entity/totp"]
      EN4["/entity/org-info"]
    end

    subgraph BioMod["Biometric RS Module (scope-gated)"]
      BI1["/biometric/enroll"]
      BI2["/biometric/verify"]
      BI3["/biometric/liveness"]
      BI4["/biometric/search"]
    end
  end

  subgraph Shared["Shared Service Layer"]
    SV1["client.Service"]
    SV2["user.Service"]
    SV3["scope.Filter"]
    SV4["oidc.Provider (Authlib)"]
    SV5["token.Validator (in-process JWKS)"]
    SV6["engine_client → engine:8000"]
  end

  subgraph Storage["Shared Storage Layer"]
    PG[("PostgreSQL (asyncpg)<br/>user · client · token · scope · kiosk · biometric")]
    RD[("Redis (redis-py)<br/>session · challenge · rate-limit")]
  end

  Entry --> App
  AuthZMod --> Shared
  AdminMod --> Shared
  EntityMod --> Shared
  BioMod --> Shared
  Shared --> PG
  Shared --> RD
```

Because every module lives in the same process, resource-server routes validate access tokens **in-process** against the same key material the AuthZ module signed them with — no cross-service introspection hop.

---

## Docker Network Topology

```mermaid
flowchart LR
  Host(["Host"]) -.-> Nginx

  subgraph Net["docker-compose network"]
    direction LR
    Nginx["nginx<br/>:80/:443"]
    Provider["provider<br/>:8000"]
    Dashboard["dashboard<br/>:3000"]
    AuthUI["auth-ui<br/>:4000"]
    Engine["engine<br/>:8000 (internal)"]
    PG[("postgres :5432")]
    RD[("redis :6379")]
    MN[("minio :9000")]

    Nginx --> Provider
    Nginx --> Dashboard
    Nginx --> AuthUI
    Provider --> Engine
    Provider --> PG
    Provider --> RD
    Provider --> MN
    Engine --> PG
    Engine --> MN
  end
```

Only `nginx` is exposed to the host. The biometric engine is reachable only from within the Docker network.

---

## Project Structure

```
project-iden/
├── provider/                        # Single FastAPI app — all backend routes
│   ├── main.py                      # Mounts all module routers
│   ├── config.py
│   ├── crypto/                      # RSA key generation, JWKS
│   ├── authz/                       # AuthZ Server module
│   │   ├── oidc/                    # Authlib provider, OAuth2/OIDC handlers
│   │   ├── authn/                   # Login/consent handlers, session
│   │   └── scope/                   # Role-based scope filter
│   ├── admin/                       # Admin RS module
│   │   ├── clients.py               # /admin/clients
│   │   ├── kiosks.py                # /admin/kiosks
│   │   ├── users.py                 # /admin/users
│   │   └── scopes.py                # /admin/scopes  (read-only)
│   ├── entity/                      # Entity RS module
│   │   ├── profile.py               # /entity/profile
│   │   ├── credentials.py           # /entity/credentials
│   │   ├── totp.py                  # /entity/totp
│   │   └── org_info.py              # /entity/org-info
│   │   # NOTE: further thoughts needed on full surface area
│   ├── biometric/                   # Biometric RS module
│   │   ├── enroll.py                # /biometric/enroll
│   │   ├── verify.py                # /biometric/verify
│   │   ├── liveness.py              # /biometric/liveness
│   │   ├── search.py                # /biometric/search
│   │   └── engine_client.py         # Calls internal engine
│   ├── shared/
│   │   ├── auth/                    # In-process token validator used by all RS modules
│   │   ├── client/                  # OIDC client model, service
│   │   └── user/                    # User model, service
│   ├── store/postgres/              # user, client, token, scope, kiosk, biometric
│   ├── store/redis/                 # session, challenge
│   ├── middleware/
│   ├── migrations/
│   ├── requirements.txt
│   └── Dockerfile
│
├── engine/                          # Biometric Engine (internal only)
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── middleware.py            # X-Engine-Key auth
│   │   ├── routes/                  # enroll, verify, liveness, search
│   │   └── services/                # Face detection/embedding
│   ├── requirements.txt
│   └── Dockerfile
│   # NOTE: further thoughts needed
│
├── dashboard/                       # IDEN Dashboard SPA
│   ├── src/app/
│   │   ├── (admin)/clients/
│   │   ├── (admin)/kiosks/
│   │   ├── (admin)/users/
│   │   ├── (entity)/profile/
│   │   ├── (entity)/credentials/
│   │   └── (entity)/totp/
│   ├── src/lib/oidc.ts              # OIDC client config (bootstrapped)
│   ├── package.json
│   └── Dockerfile
│
├── auth-ui/                         # IDEN Authentication SPA
│   ├── src/app/
│   │   ├── login/                   # /auth/login
│   │   └── consent/                 # /auth/consent
│   ├── package.json
│   └── Dockerfile
│
├── kiosk/                           # Biometric Kiosk firmware/app
│   └── ...
│   # NOTE: further thoughts needed
│
├── deploy/
│   ├── nginx/nginx.conf
│   └── .env.example
├── docker-compose.yml
├── .gitignore
└── README.md
```

---

## Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Authorization model | Scope-only at resource servers; role-gated at token issuance | Avoids the RBAC complexity of Keycloak; resource servers stay stateless wrt identity |
| Scope management | Fixed, IDEN-defined scopes; no user-creatable scopes | Eliminates an entire class of misconfiguration and audit drift |
| OIDC library | [Authlib](https://github.com/lepture/authlib) | Most mature Python OIDC library, full spec compliance |
| Token format | Opaque access tokens, JWT ID tokens | Access tokens revocable via DB lookup; resource servers validate via introspection or short-lived JWT access tokens (TBD) |
| Service decomposition | Single `provider` process with AuthZ + 3 RS modules + 2 SPAs | Keeps ops simple — one port, one image, one deployable; modules are logical, not physical. Biometric engine is the only sidecar. |
| Token validation | In-process (no introspection hop) | Since all RS modules share the process, they validate tokens directly against the same JWKS the AuthZ module signed them with |
| Hosted login UI | Separate `auth-ui` SPA, not embedded | Decouples credential capture from any product surface; only `/authorize` knows about it |
| Assurance reporting | Standard OIDC `amr` + `acr` claims with IDEN-defined `iden:loa:{1,2,3}` levels | Relying parties can request a minimum level via `acr_values`; IDEN enforces step-up when the session falls short |
| Bootstrapped client | Dashboard SPA registered automatically on first start | Avoids chicken-and-egg of needing an OIDC client to manage OIDC clients |
| Password hashing | argon2id (time=1, mem=64MB, threads=4) | OWASP recommended, memory-hard |
| Session storage | Redis with sliding 24h TTL | Fast lookups, automatic expiry |
| Challenge pattern | Redis with 10min TTL | Ephemeral by design, prevents replay |
| Database driver | asyncpg | Native async PostgreSQL driver |
| HTTP framework | FastAPI | Async-first, OpenAPI docs, Pydantic validation |
| Kiosk auth | `client_credentials` grant against AuthZ Server | Kiosks are first-class OAuth clients; no user impersonation |
| Biometric engine | Internal-only Docker network | Face data never directly accessible from the internet |
| Vector search | pgvector | Face embedding similarity search without a separate vector DB |
| Object storage | MinIO (S3-compatible) | Face images, profile photos, and other blobs live in object storage, not Postgres — Postgres keeps only the row + the object key. S3-compatible API lets ops swap in AWS S3, R2, or GCS in production without code changes. |

---

## Quick Start

```bash
git clone https://github.com/iden-project/iden.git
cd iden
docker compose up --build

# Services available at:
#   http://localhost                     — Dashboard SPA
#   http://localhost/auth/login          — Login UI
#   http://localhost/oauth2/authorize    — OIDC authorize endpoint
#   http://localhost/.well-known/openid-configuration
```

### Verify the Setup

```bash
curl http://localhost/.well-known/openid-configuration
curl http://localhost/.well-known/jwks.json
```

---

## Development Phases

| Phase | Focus | Status |
|-------|-------|--------|
| **Phase 1** | Provider (AuthZ + Admin modules) + Auth UI + Dashboard SPA | In Progress |
| **Phase 2** | Provider: Entity module — self-service profile, credentials, TOTP enrollment | Planned |
| **Phase 3** | Provider: Biometric module + Engine — enrollment, verification, liveness | Planned |
| **Phase 4** | Biometric Kiosk Systems — device registration, client_credentials enrollment flow | Planned |
| **Phase 5** | Production — HA deployment, monitoring, audit logging, compliance | Planned |

---

## Open Design Questions

- **Entity Resource Server**: full API surface beyond profile/credentials/TOTP; how org-defined custom fields are modeled.
- **Biometric Kiosk Systems**: the new-entity enrollment handoff — how a kiosk-enrolled entity is later prompted (and authenticated) to complete their profile via the Dashboard SPA.
- **Biometric Engine**: model selection, GPU vs CPU deployment, accuracy/latency targets.

---

## License

Open Source — see [LICENSE](LICENSE) for details.
