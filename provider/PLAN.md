# IDEN Provider — Build Plan

The phased plan for building the IDEN backend (`provider/`). Read
[README.md](README.md) for the reference material — data model, endpoints, env vars, conventions —
and this file for the **order of work**.

Each phase states its goal, the files it creates, the endpoints it delivers, and a **Done when**
check you can run by hand. Build phases in order: each one is runnable and verifiable before the next
begins.

> Scope note: this plan covers the backend only. The `auth-ui` and `dashboard` frontends, and the
> kiosk devices, are separate efforts that consume what is built here.

---

## Table of Contents

- [Ground rules](#ground-rules)
- [Target package layout](#target-package-layout)
- [Phase 0 — Foundation](#phase-0--foundation)
- [Phase 1 — AuthZ core](#phase-1--authz-core)
- [Phase 2 — Admin RS (identity & access control)](#phase-2--admin-rs-identity--access-control)
- [Phase 3 — Entity RS (self-service)](#phase-3--entity-rs-self-service)
- [Phase 4 — Biometric module](#phase-4--biometric-module)
- [Phase 5 — Hardening](#phase-5--hardening)
- [Why this order](#why-this-order)

---

## Ground rules

These apply to every phase. They repeat what `.claude/CLAUDE.md` and `CODING_STYLE.md` already say,
collected here so a phase can be executed without flipping between files.

1. **Feature packages, not layers.** A resource lives in one directory:
   `routes.py` (HTTP, no DB), `schemas.py` (Pydantic DTOs), `service.py` (DB logic, FastAPI-free),
   `errors.py` (domain exceptions). Routes translate domain exceptions into `HTTPException`.
2. **Every endpoint documents itself.** Explicit `response_model`, explicit `status_code` for
   non-200 successes, `summary`, `description`, `responses={...}` for documented failures, `tags` on
   the router, `Field(description=...)` on non-obvious fields, `Literal[...]` for enums. The
   required scope is named in the description **and** enforced with `Depends(require_scope(...))`.
3. **Simplest thing that reads well.** Three similar lines beat a premature abstraction. No
   defensive code for states that cannot happen; validate at boundaries and trust internal callers.
4. **Comment only the why.** A hidden constraint, a surprising invariant, a spec requirement worth
   citing. Never narrate what the code does.
5. **`async` only for real I/O.** Scope-set maths, PKCE hashing, and claim assembly are synchronous
   functions called from async handlers.
6. **Dependencies via `uv add`** from `provider/`. Never hand-edit the `pyproject.toml` dependency
   list.
7. **New resource ⇒ new scope.** Add it to `shared/scopes.py`, include it in the seeded system
   catalogue, and re-run the seed.

---

## Target package layout

```text
provider/
├── PLAN.md
├── README.md
├── pyproject.toml
├── scripts/
│   ├── __init__.py
│   ├── seed.py                 # idempotent dev bootstrap
│   └── gen_keys.py             # generate a signing keypair for local dev
└── src/provider/
    ├── core/                   # cross-cutting infrastructure
    │   ├── app.py              # FastAPI app, middleware, router mounting
    │   ├── config.py           # Settings
    │   ├── logging.py          # structlog wiring
    │   ├── router.py           # root APIRouter
    │   ├── db.py               # async engine, session, DBSessionDep
    │   ├── redis.py            # redis client + RedisDep
    │   ├── security.py         # argon2 hashing, random token generation
    │   ├── crypto.py           # signing keys, JWKS, JWT sign/verify
    │   ├── auth.py             # require_scope(), CurrentTokenDep
    │   ├── errors.py           # base domain exception + HTTP error contract
    │   └── schemas.py          # CamelCaseBaseModel, shared response envelopes
    ├── shared/
    │   ├── models.py           # every SQLAlchemy model — one source of truth
    │   ├── enums.py            # ClientType, GrantType, AmrMethod, AcrLevel, …
    │   └── scopes.py           # the seeded system API/scope/role catalogue
    ├── authz/
    │   ├── discovery/          # /.well-known/*
    │   ├── oauth/              # /oauth2/*
    │   ├── login/              # /api/v1/auth/login · /totp · /biometric
    │   ├── consent/            # /api/v1/auth/consent
    │   └── services/
    │       ├── scope_resolver.py
    │       ├── token_service.py
    │       ├── session_store.py
    │       ├── challenge_store.py
    │       ├── auth_methods.py     # registry: pwd · otp · face
    │       └── pkce.py
    ├── admin/
    │   ├── users/  groups/  roles/  apis/  scopes/  clients/
    ├── entity/
    │   ├── profile/  credentials/  totp/  sessions/  permissions/
    └── biometric/                  # feature-flagged, Phase 4
        ├── enroll/  verify/  liveness/  search/
        └── engine_client.py
```

Each leaf directory under `admin/`, `entity/`, and `biometric/` is a feature package with the four
files from ground rule 1.

---

## Phase 0 — Foundation

**Goal:** a running app with a real database, real models, hashing, signing keys, and a seed script
that bootstraps the deployment. No OAuth yet.

### 0.1 Dev infrastructure

Phase 0 cannot be verified without a database, so the dev half of Docker Compose comes first:
`deploy/docker-compose.yml` with `pgvector/pgvector:pg18` and `redis:8-alpine`, both health-checked.

```bash
docker compose -f deploy/docker-compose.yml up -d
```

Postgres 18 moved its recommended volume mount to `/var/lib/postgresql` (not `/var/lib/postgresql/data`);
mounting the old path makes the container refuse to start. The provider image, nginx, minio, and the
engine stay in Phase 5.

### 0.2 Clean up the skeleton

Three things in the current skeleton need fixing before building on them:

| Problem | Fix |
|---|---|
| `src/provider/schemas.py/` is a **directory** named `schemas.py`, holding `camel_case_base_model.py` | Delete the directory; move `CamelCaseBaseModel` into `core/schemas.py` |
| `src/provider/database/` holds an empty `models.py`, but `.claude/CLAUDE.md` specifies `shared/models.py` | Delete `database/`; create `shared/models.py` |
| `src/provider/resources/` and `utils/` are empty placeholders | Delete both; add directories when there is something to put in them |
| `pydantic-settings` is imported by `core/config.py` but is only a transitive dependency | `uv add pydantic-settings` |

Also add: `uv add "redis[hiredis]" pyjwt cryptography pyotp python-multipart`.
(`authlib` and `argon2-cffi` are already present.)

### 0.3 Configuration — `core/config.py`

Extend the existing `Settings` with everything later phases need. Full table in
[README.md § Configuration](README.md#configuration). Groups:

- **App** — `iden_env`, `iden_log_level`, `iden_api_prefix`, `iden_allowed_admin_origins` *(existing)*
- **Issuer** — `iden_issuer`, `iden_auth_ui_base_url`
- **Storage** — `iden_database_url`, `iden_redis_url`
- **Crypto** — `iden_signing_key_dir`, `iden_signing_algorithm` (`RS256`)
- **Lifetimes** — `iden_access_token_ttl` (600s), `iden_id_token_ttl` (600s),
  `iden_refresh_token_ttl` (30d), `iden_auth_code_ttl` (60s), `iden_session_ttl` (24h),
  `iden_challenge_ttl` (600s)
- **Bootstrap** — `iden_bootstrap_admin_email`, `iden_bootstrap_admin_password` (generated and
  printed when unset)
- **Biometric** — `iden_biometric_enabled` (default `false`), `iden_engine_base_url`

Mirror every field into `.env.example`.

### 0.4 Infrastructure modules

- **`core/db.py`** — `create_async_engine`, `async_sessionmaker`, a `get_db_session` dependency that
  yields a session and rolls back on exception, and the alias `DBSessionDep`.
- **`core/redis.py`** — a module-level async client created in the app lifespan, plus `RedisDep`.
- **`core/security.py`** — `hash_secret()` / `verify_secret()` using argon2id
  (time=1, mem=64MB, threads=4), and `generate_token(nbytes)` for codes, refresh tokens, and client
  secrets. **All** password and client-secret hashing goes through this module.
- **`core/crypto.py`** — load the signing keypair from `iden_signing_key_dir`, expose
  `sign_jwt(claims)`, `verify_jwt(token)`, and `jwks()` returning the public JWK set with a `kid`
  per key. Written for multiple keys from day one so rotation is a config change, not a rewrite.
- **`core/errors.py`** — `IdenError` base with `code`/`message`, and the JSON error contract every
  route returns.
- **`core/schemas.py`** — `CamelCaseBaseModel` (moved), plus shared paging schemas.

### 0.5 The data model — `shared/models.py`

One file, one source of truth. All primary keys are UUIDv7-ish (`uuid.uuid7()`, Python 3.14) unless
noted. Every table carries `created_at` / `updated_at`.

**Identity**

| Model | Key columns |
|---|---|
| `User` | `email` (unique), `username` (unique), `password_hash`, `display_name`, `is_active`, `email_verified_at`, `last_login_at` |
| `Group` | `name` (unique), `description` |
| `UserGroup` | `user_id`, `group_id` — composite PK, flat membership |
| `TotpCredential` | `user_id`, `secret_encrypted`, `confirmed_at` |

**Access control**

| Model | Key columns |
|---|---|
| `ResourceApi` | `name`, `audience` (unique URI), `description`, `is_system` |
| `Scope` | `api_id` → `ResourceApi`, `value`, `description`, `is_system` — unique on `(api_id, value)` |
| `Role` | `name` (unique), `description`, `is_system` |
| `RoleScope` | `role_id`, `scope_id` |
| `UserRole` | `user_id`, `role_id` |
| `GroupRole` | `group_id`, `role_id` |
| `UserScope` | `user_id`, `scope_id` — direct one-off grants |

**OAuth**

| Model | Key columns |
|---|---|
| `Client` | `client_id` (unique), `name`, `client_type` (`public`/`confidential`), `client_secret_hash`, `redirect_uris` (array), `allowed_grants` (array), `skip_consent`, `is_system` |
| `ClientScope` | `client_id`, `scope_id`, `grantable` (may be requested on behalf of a user) vs `granted` (held by the client itself for `client_credentials`) |
| `AuthorizationCode` | `code_hash`, `client_id`, `user_id`, `redirect_uri`, `scope`, `code_challenge`, `code_challenge_method`, `nonce`, `acr`, `amr`, `expires_at`, `used_at` |
| `RefreshToken` | `token_hash`, `client_id`, `user_id`, `scope`, `family_id`, `rotated_to_id`, `expires_at`, `revoked_at` |
| `ConsentGrant` | `user_id`, `client_id`, `scopes` (array), `granted_at` — so a user is asked once |

Not in Postgres: sessions, login/consent challenges, and the `jti` denylist live in Redis with TTLs.

**Design notes worth writing into the code as comments:**
- `is_system` protects IDEN's own APIs, scopes, roles, and clients from deletion. Without it an
  admin could delete `admin:roles:write` and lock the organization out permanently.
- Codes and refresh tokens are stored **hashed**, exactly like passwords — a database read must not
  yield usable credentials.
- `RefreshToken.family_id` + `rotated_to_id` implement rotation with **reuse detection**: presenting
  an already-rotated token revokes the entire family, on the assumption it was stolen.

### 0.6 The system catalogue — `shared/scopes.py`

A plain declarative structure — no logic — listing the APIs, scopes, and roles the seed upserts.

| API | Audience | Scopes |
|---|---|---|
| `admin` | `{issuer}/admin` | `admin:users:read/write`, `admin:groups:read/write`, `admin:roles:read/write`, `admin:apis:read/write`, `admin:scopes:read/write`, `admin:clients:read/write` |
| `entity` | `{issuer}/entity` | `entity:profile:read/write`, `entity:credentials:write`, `entity:totp:read/enroll`, `entity:sessions:read/revoke`, `entity:permissions:read` |
| `biometric` | `{issuer}/biometric` | `biometric:enroll`, `biometric:verify`, `biometric:liveness`, `biometric:search` |

Seeded roles: **`administrator`** (every `admin:*` and `entity:*` scope) and **`member`** (every
`entity:*` scope). Both `is_system`.

### 0.7 Seed script — `scripts/seed.py`

Idempotent, safe to re-run after every model change during development:

1. `CREATE EXTENSION IF NOT EXISTS vector`
2. `Base.metadata.create_all` (Alembic arrives in Phase 5 — see the note there)
3. Upsert system APIs, scopes, and roles from `shared/scopes.py`
4. Upsert the bootstrap `dashboard` client (public, PKCE, `skip_consent=true`) and the `kiosk` client
   (confidential, `client_credentials`) — print the kiosk secret once
5. Create the bootstrap admin user with the `administrator` role; print the generated password once

Run with `uv run python -m scripts.seed` from `provider/`.

`scripts/gen_keys.py` writes an RSA keypair into `iden_signing_key_dir` for local development.

### 0.8 App wiring — `core/app.py`

Keep the existing request-id + structlog middleware. Add: the DB engine and Redis client to the
lifespan, a `GET /health` returning DB and Redis reachability, and an exception handler translating
`IdenError` into the JSON error contract.

### Done when

```bash
uv run python -m scripts.gen_keys
uv run python -m scripts.seed        # prints bootstrap credentials
uv run python -m scripts.seed        # second run changes nothing — proves idempotence
uv run provider                      # starts on :8000
curl localhost:8000/health           # {"database":"ok","redis":"ok"}
open http://localhost:8000/docs      # renders, health documented
```

Plus: `psql` shows every table, and the system scope rows are present with `is_system = true`.

---

## Phase 1 — AuthZ core

**Goal:** a working OIDC provider. A browser can complete authorization code + PKCE against the
seeded dashboard client and receive real tokens; a backend can complete client credentials. This is
the phase where the OAuth concepts actually get learned, so build the services before the routes.

### 1.1 Services first — `authz/services/`

| File | Responsibility |
|---|---|
| `pkce.py` | `verify_challenge(verifier, challenge, method)` — `S256` only; `plain` is rejected. ~10 lines. |
| `session_store.py` | Redis-backed login session: `sub`, `amr` list, `authenticated_at`, sliding 24h TTL. Keyed by an opaque id held in an `HttpOnly` `Secure` `SameSite=Lax` cookie. |
| `challenge_store.py` | Redis-backed 10-minute, single-use challenges carrying the pending `/authorize` parameters across the redirect to `auth-ui` and back. |
| `auth_methods.py` | The registry. Each method declares a name (`pwd`, `otp`, `face`) and a verify callable. `pwd` and `otp` register here; Phase 4 adds `face` **without touching this file's callers**. |
| `scope_resolver.py` | The centrepiece — see below. |
| `token_service.py` | Mint access/ID/refresh tokens, verify access tokens, denylist a `jti`, rotate a refresh token with reuse detection. |

**`scope_resolver.py`** — pure, synchronous set logic over data loaded by the caller:

```text
effective_user_scopes(user) =
      direct UserScope grants
    ∪ scopes of roles from UserRole
    ∪ scopes of roles from GroupRole for every group the user belongs to

authorization_code:  granted = requested ∩ client.grantable_scopes ∩ effective_user_scopes
client_credentials:  granted = requested ∩ client.granted_scopes
```

Pruning is silent — an over-broad request yields a narrower token, never an error. Load the whole
role/group graph in one query with eager loading; this runs on every token issuance and is the
obvious N+1 trap.

**`token_service.py`** — claims per [README.md § Tokens & Claims](README.md#tokens--claims). `acr` is derived from the
session's `amr` list at issuance time, never stored. Access tokens carry `aud` = the audience of the
API owning the granted scopes; if granted scopes span several APIs, `aud` is a list.

### 1.2 Discovery — `authz/discovery/`

| Endpoint | Notes |
|---|---|
| `GET /.well-known/openid-configuration` | Advertises endpoints, `grant_types_supported` = `authorization_code` + `client_credentials`, `code_challenge_methods_supported` = `["S256"]`, `acr_values_supported`, `scopes_supported` (**queried from the database**, since scopes are now dynamic), `claims_supported` including `acr` and `amr` |
| `GET /.well-known/jwks.json` | `core/crypto.jwks()` |

### 1.3 OAuth endpoints — `authz/oauth/`

| Endpoint | Behaviour |
|---|---|
| `GET /oauth2/authorize` | Validate `client_id`, exact-match `redirect_uri`, `response_type=code`, require `code_challenge` + `S256`. No session, or session below the requested `acr_values` → create a challenge and redirect to `auth-ui`. Session sufficient → resolve scopes, apply consent rules, issue the code, redirect back with `code` + `state`. |
| `POST /oauth2/token` | `grant_type=authorization_code` (verify code, single-use, PKCE, redirect_uri match → access + ID + refresh), `grant_type=refresh_token` (rotate, reuse detection), `grant_type=client_credentials` (client auth via `client_secret_basic` or `_post`). |
| `GET /oauth2/userinfo` | Bearer access token → claims filtered by the granted scopes (`openid`, `profile`, `email`). |
| `POST /oauth2/revoke` | RFC 7009. Revokes a refresh family, or denylists an access token's `jti`. |
| `POST /oauth2/introspect` | RFC 7662, client-authenticated. Present mainly so external non-JWT consumers have an option. |
| `GET /oauth2/logout` | RFC-style end-session: clear the session, honour `post_logout_redirect_uri`. |

Error responses follow the OAuth error format (`error`, `error_description`) — **not** the internal
error contract. Redirect-safe errors go back to `redirect_uri`; everything else renders as JSON.

### 1.4 Login & consent — `authz/login/`, `authz/consent/`

| Endpoint | Behaviour |
|---|---|
| `POST /api/v1/auth/login` | Verify email + password (argon2), append `pwd` to the session `amr`, return the next step (`totp_required`, `consent_required`, or the resume URL). |
| `POST /api/v1/auth/totp` | Verify a TOTP code (pyotp), append `otp`. Step-up: usable both during initial login and mid-session when a client requests a higher `acr`. |
| `POST /api/v1/auth/biometric` | Phase 4. The route exists here as a `501` stub when `iden_biometric_enabled` is false, so the Auth UI contract is fixed from the start. |
| `GET  /api/v1/auth/challenge/{id}` | The Auth UI reads the pending client name and requested scopes to render the page. |
| `POST /api/v1/auth/consent` | Persist a `ConsentGrant` (or deny) and resume `/authorize`. |

**Consent rules:** skipped entirely when `client.skip_consent` is true; otherwise skipped when an
existing `ConsentGrant` already covers every scope about to be granted; otherwise prompted, listing
each scope with its admin-written description — which is exactly why `Scope.description` is a
required field.

### 1.5 The `require_scope` dependency — `core/auth.py`

The single gate every resource-server route in Phases 2–4 depends on:

```python
async def require_scope(*required: str) -> ...:
    # extract bearer token → verify signature + exp + iss + aud via core.crypto
    # reject if jti is denylisted
    # reject if any required scope is missing from the token's scope claim
    # return the decoded token as CurrentTokenDep
```

Missing/invalid token → `401` with `WWW-Authenticate`. Valid token, insufficient scope → `403`. That
distinction matters: `401` means *authenticate again*, `403` means *authentication won't help*.

### Done when

You can complete a full flow by hand with `curl` plus a browser:

```bash
# 1. discovery lists both grants and S256 only
curl -s localhost:8000/.well-known/openid-configuration | jq

# 2. authorization code + PKCE, end to end
#    open /oauth2/authorize?... in a browser, log in as the bootstrap admin,
#    copy the code from the redirect, then:
curl -s -X POST localhost:8000/oauth2/token \
  -d grant_type=authorization_code -d code=… -d code_verifier=… \
  -d client_id=dashboard -d redirect_uri=…

# 3. decode the access token — aud, scope, acr, amr, jti all present
# 4. client credentials for the kiosk client returns a token with only its granted scopes
# 5. refresh once, then replay the old refresh token → the whole family is revoked
# 6. a token missing a required scope hits 403; a tampered token hits 401
```

---

## Phase 2 — Admin RS (identity & access control)

**Goal:** the feature that makes IDEN an access-control provider. Every resource is a feature package
under `admin/` with `routes.py` / `schemas.py` / `service.py` / `errors.py`, and every route is gated
by `Depends(require_scope(...))`.

Build in dependency order — APIs and scopes first, since roles reference scopes and clients reference
both.

### 2.1 `admin/apis/` — `admin:apis:read` / `admin:apis:write`

`GET /admin/apis` · `POST /admin/apis` · `GET|PATCH|DELETE /admin/apis/{id}`

Audience must be a valid absolute URI and unique. `DELETE` on an `is_system` API → `409`. Deleting an
API cascades to its scopes, so the response spells out how many scopes and role bindings go with it.

### 2.2 `admin/scopes/` — `admin:scopes:read` / `admin:scopes:write`

`GET|POST /admin/apis/{api_id}/scopes` · `GET|PATCH|DELETE /admin/scopes/{id}`

Scope values are validated against a documented pattern (`^[a-z][a-z0-9_-]*(:[a-z0-9_-]+)+$`) and are
unique per API. `description` is required — it is what a user reads on the consent screen. System
scopes are immutable.

### 2.3 `admin/roles/` — `admin:roles:read` / `admin:roles:write`

`GET|POST /admin/roles` · `GET|PATCH|DELETE /admin/roles/{id}` ·
`GET /admin/roles/{id}/scopes` · `PUT /admin/roles/{id}/scopes`

`PUT` replaces the scope set wholesale with a list of scope ids — a declarative set operation rather
than add/remove pairs, which keeps the dashboard's editing UI trivial and the endpoint idempotent.
System roles cannot be deleted; their scope sets cannot be edited.

### 2.4 `admin/groups/` — `admin:groups:read` / `admin:groups:write`

`GET|POST /admin/groups` · `GET|PATCH|DELETE /admin/groups/{id}` ·
`PUT /admin/groups/{id}/roles` · `GET /admin/groups/{id}/members` ·
`POST|DELETE /admin/groups/{id}/members`

Membership is flat. Deleting a group removes its role bindings and memberships, never its users.

### 2.5 `admin/users/` — `admin:users:read` / `admin:users:write`

`GET|POST /admin/users` · `GET|PATCH|DELETE /admin/users/{id}` ·
`PUT /admin/users/{id}/roles` · `PUT /admin/users/{id}/scopes` (direct grants) ·
`POST /admin/users/{id}/reset-password` · `GET /admin/users/{id}/effective-scopes`

`GET /admin/users/{id}/effective-scopes` returns every scope **with its provenance** — direct grant,
which role, or which group. This is the endpoint that answers *why can this person do that?*, and
it is worth building carefully; it is also the natural place to reuse `scope_resolver.py` from
Phase 1 rather than reimplementing the union.

`GET /admin/users` supports filtering by group, role, and active status, and paginates.

### 2.6 `admin/clients/` — `admin:clients:read` / `admin:clients:write`

`GET|POST /admin/clients` · `GET|PATCH|DELETE /admin/clients/{id}` ·
`POST /admin/clients/{id}/rotate-secret` · `PUT /admin/clients/{id}/scopes`

Creating a confidential client returns the cleartext secret **exactly once**; it is argon2-hashed via
`core/security.py` and never retrievable again. `rotate-secret` behaves the same way. Public clients
get no secret and must use PKCE. `PUT .../scopes` sets both lists: *grantable* (may be requested on
behalf of a user) and *granted* (held by the client itself for `client_credentials`).

### Done when

A complete admin story runs against a live server using an admin access token from Phase 1:

```bash
# create an API, add a scope to it, bundle it into a role,
# create a group, give the group the role, add a user to the group,
# then confirm the user's effective-scopes includes the new scope with provenance,
# and confirm a fresh token for that user actually carries it.
```

Also verify: deleting a system scope returns `409`; a non-admin token returns `403` on every
`/admin/*` route; `/docs` shows required scopes on every endpoint.

---

## Phase 3 — Entity RS (self-service)

**Goal:** what a signed-in person can do for themselves. Every route reads `sub` from the access
token and never accepts a user id from the caller — that alone removes an entire class of IDOR bugs.

| Package | Endpoints | Scope |
|---|---|---|
| `entity/profile/` | `GET /entity/profile`, `PATCH /entity/profile` | `entity:profile:read` / `:write` |
| `entity/credentials/` | `POST /entity/credentials/password` (requires the current password) | `entity:credentials:write` |
| `entity/totp/` | `POST /entity/totp/enroll` → secret + otpauth URI, `POST /entity/totp/confirm`, `DELETE /entity/totp` | `entity:totp:enroll` / `:read` |
| `entity/sessions/` | `GET /entity/sessions`, `DELETE /entity/sessions/{id}` | `entity:sessions:read` / `:revoke` |
| `entity/permissions/` | `GET /entity/permissions` — my roles, groups, and effective scopes | `entity:permissions:read` |

Notes worth encoding:
- A password change revokes every refresh token for that user, and clears their other sessions.
- TOTP enrollment is two-step: the credential only becomes active once a generated code is
  confirmed, so a user cannot lock themselves out with a mis-scanned QR code.
- `GET /entity/permissions` reuses the same `scope_resolver.py` as Phases 1 and 2. Three callers,
  one implementation.

### Done when

A non-admin user can log in, read and update their profile, enrol and confirm TOTP, then complete a
fresh login at `iden:loa:2` with `amr: ["pwd","otp"]`, and see their own permissions — all with a
token that carries no `admin:*` scope. Changing the password invalidates the old refresh token.

---

## Phase 4 — Biometric module

**Goal:** facial enrollment and verification, shipped in-repo but **inert unless enabled**. The work
is deferred; the seams are not — they were built in Phases 0, 1, and 3.

### What makes this additive rather than invasive

| Seam | Built in | Used here |
|---|---|---|
| `iden_biometric_enabled` flag | Phase 0 | `core/app.py` mounts `biometric/` routes and seeds the `biometric` API + scopes only when true |
| `auth_methods.py` registry | Phase 1 | Registers a `face` method; nothing in the AuthZ core changes |
| `amr` / `acr` tables | Phase 1 | `face` and `iden:loa:3` are already defined and advertised |
| `POST /api/v1/auth/biometric` stub | Phase 1 | The `501` stub becomes a real handler; the Auth UI contract never changed |
| `client_credentials` grant | Phase 1 | Kiosks authenticate as machine clients — no user impersonation |

### Work

- `biometric/engine_client.py` — an async HTTP client for the internal `engine:8000`, with timeouts
  and a typed response model. The engine is the only component that ever sees a raw image.
- `biometric/enroll/` — `POST /biometric/enroll` (`biometric:enroll`): image → engine → embedding
  stored via pgvector, original image to MinIO, Postgres keeps the row + object key.
- `biometric/verify/` — `POST /biometric/verify` (`biometric:verify`): 1:1 match against a claimed
  identity, returns match + liveness + confidence.
- `biometric/search/` — `POST /biometric/search` (`biometric:search`): 1:N pgvector nearest-neighbour
  lookup. This is the kiosk's "who is this person?" call.
- `biometric/liveness/` — `POST /biometric/liveness` (`biometric:liveness`): liveness only.
- Login path: `POST /api/v1/auth/biometric` appends `face` to the session `amr` **only** when the
  engine reports a liveness-verified match. A match without liveness is not an authentication.

### Done when

With the flag off, the app starts, `/docs` shows no `/biometric/*` routes, and the biometric scopes
are absent — proving the module carries no cost when disabled. With the flag on and an engine
running, a user can enrol a face and then log in with `amr: ["face"]`.

---

## Phase 5 — Hardening

**Goal:** the difference between "the flows work" and "this can be deployed".

- **Migrations.** Replace `create_all` with Alembic. Deferred to here on purpose: the schema churns
  through Phases 0–3, and hand-editing migrations during that churn wastes time. Generate one
  baseline migration from the settled models, then migrate normally.
- **Rate limiting.** Redis fixed-window limiter as middleware, with tighter per-route limits on
  `/api/v1/auth/login`, `/totp`, `/oauth2/token`, and `/biometric/*`. Brute-force protection on
  password and TOTP verification specifically.
- **Audit log.** Append-only records for every state change: who (sub or client_id), what, when, from
  where. All `/admin/*` writes, all authentication attempts, all token revocations. This is the
  compliance story and it should not be retrofitted later.
- **Security headers & CORS.** HSTS, `X-Content-Type-Options`, `Referrer-Policy`, frame-ancestors;
  CORS restricted to `iden_allowed_admin_origins`.
- **Error contract.** One documented JSON error shape everywhere except the OAuth endpoints, which
  keep the RFC format.
- **Tests.** pytest + httpx `ASGITransport` against a throwaway database. Priority order: the scope
  resolver (pure logic, highest value per line), PKCE verification, refresh rotation and reuse
  detection, `require_scope` allow/deny, then a full authorization-code integration test.
- **Docker.** `Dockerfile` for the provider, extending `deploy/docker-compose.yml` (created in Phase 0
  with postgres and redis) to wire in the provider, minio, and nginx.
- **Operational endpoints.** `/health` split into liveness and readiness.

### Done when

`docker compose up --build` brings up a working deployment; the test suite passes; the OWASP-relevant
checks — rate limits engaged, no secrets in logs, headers present — all hold.

---

## Why this order

The dependency between phases is not arbitrary, and it is worth understanding before deviating:

1. **Foundation first** because models, hashing, and signing keys underpin everything else.
2. **AuthZ before Admin**, even though the admin API is the more interesting feature. Every
   `/admin/*` route is gated by `require_scope`, which needs real tokens to exist — building admin
   first would mean testing it with a fake auth shim you then throw away. The seed script creates
   the clients and the admin user that Phase 1 needs, so nothing is circular.
3. **Admin before Entity** because Entity reuses `scope_resolver.py` and the same feature-package
   patterns, and because you need to be able to create a second, non-admin user to test Entity
   properly.
4. **Biometric after the core** because it is the only phase with an external dependency (the ONNX
   engine), and because everything it hooks into — the auth-method registry, the flag, the stub
   route, the `amr` pipeline — already exists by then.
5. **Hardening last** for migrations specifically: Alembic against a schema that is still moving
   costs more than it saves.

Phases 6 (frontends) and 7 (kiosk) from the root [README](../README.md) consume this backend and are
planned separately.
