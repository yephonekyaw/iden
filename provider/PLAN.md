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
- [Known issues](#known-issues)
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
8. **Tests ship with the phase that introduces the code**, not at the end. Pure logic gets unit
   tests (no database, no fixtures); every endpoint gets at least a success case, an authorization
   failure, and its most interesting failure mode. `uv run pytest` must be green before a phase is
   called done.

### Testing

Tests live in `provider/tests/` and run against a real PostgreSQL database (`iden_test`), created
once per session and truncated between tests. Not SQLite: the models use PostgreSQL arrays and
UUIDs, and a test passing on a different engine than production proves less than it appears to.
Redis uses logical database 15, flushed around every test, so a run can never disturb a developer's
live session.

```bash
uv run pytest              # everything
uv run pytest -q tests/test_scope_resolver.py
```

The `client` fixture drives the app in-process over ASGI — no live server, no port. Its `base_url`
matches `IDEN_ISSUER` on purpose: `/authorize` builds absolute resume URLs from the issuer, and a
cookie set on one host is not sent to another, so a mismatch silently breaks the login round-trip.

The `catalogue` fixture seeds through the **real** functions in `scripts/seed.py`, so drift between
the seed and the tests surfaces as a failure rather than as a surprise in production.

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
(`argon2-cffi` is already present. `authlib` was removed: its authorization-server integrations
are Flask- and Django-only, so it would buy an adapter layer rather than an implementation.)

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

*Tests arrived with Phase 1 — see the Testing section above. Phase 0's schema and seed are covered
indirectly by every integration test, which seeds through `scripts/seed.py`.*

---

## Phase 1 — AuthZ core

**Goal:** a working OIDC provider. A browser can complete authorization code + PKCE against the
seeded dashboard client and receive real tokens; a backend can complete client credentials. This is
the phase where the OAuth concepts actually get learned, so build the services before the routes.

### 1.1 Services first — `authz/services/`

| File | Responsibility |
|---|---|
| `pkce.py` | `verify_challenge(verifier, challenge, method)` — `S256` only; `plain` is rejected. ~10 lines. |

Write the RFC section into a comment wherever behaviour is non-obvious (PKCE: RFC 7636 §4.6;
redirect_uri matching: RFC 6749 §3.1.2.3; token error codes: RFC 6749 §5.2). Hand-rolling means the
spec is the reference, and a reader should not have to go looking for which rule a line enforces.
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

Then, as the real check: `uv run pytest` — 124 tests covering PKCE against the RFC 7636 vector, acr
derivation, the scope resolver, discovery, the full authorization code flow, refresh rotation and
reuse detection, client credentials, revocation, introspection, logout, and `require_scope`.

---

### Built differently than planned

Recorded so the code and this plan do not drift apart:

- **`RefreshToken` gained `acr` and `amr` columns.** A refreshed access token has to report the
  original authentication event, and nothing else remembers it.
- **Login never returns `consent_required`.** It returns `complete` or `totp_required`; consent is
  decided by `/authorize`, the only endpoint holding the full request. Fewer places know the rules.
- **`/oauth2/userinfo` does not use `require_scope`.** That helper derives an audience from the
  scope's prefix, which is meaningless for `openid`. Userinfo verifies the token itself and gates on
  the `openid` scope instead — OIDC Core §5.3.
- **CORS middleware moved up from Phase 5.** The Auth UI is a separate origin and sends the session
  cookie, so credentialed CORS is what makes login work at all rather than a hardening extra.
- **A token for the wrong API returns `401`, not `403`.** Audience is validated as part of the token,
  before any scope comparison. Worth knowing before it looks like a bug.

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

### Built differently than planned

- **Scope values are globally unique**, not unique per API. A token carries scopes as bare strings
  and the audience is resolved from the value, so two APIs defining `records:read` would put both
  their audiences into one token. Namespacing by API (`attendance:records:read`) is how collisions
  are avoided in practice.
- **Destructive deletes are guarded by `force=true`.** Deleting an API, scope, or role that is still
  granted silently strips permissions from whoever held them, so it returns `409` until the caller
  says explicitly that this is the intent.
- **Domain errors are mapped centrally**, by exception class, in `core/app.py` — `ApiNotFound` is a
  `NotFoundError`, so it lands on 404 without a per-route `try/except`. Thirty routes each repeating
  the same translation would be noise; routes still declare their failures in `responses={...}`.
- **Query parameters are camelCase-aliased** (`?groupId=`, `?isActive=`). FastAPI does not apply the
  Pydantic alias generator to query parameters, so without the alias a caller sending `groupId` gets
  an unfiltered list back — a plausible wrong answer, which is the worst kind.
- **Email validation is deliberately permissive** (`something@something`). A self-hosted IdP holds
  internal addresses like `admin@localhost`; `EmailStr` rejects those as special-use domains, which
  would make the bootstrap administrator un-creatable through IDEN's own API.
- **`session_store` gained a per-user index.** Sessions are keyed by a hash of a secret only the
  browser holds, so without it "revoke every session for this user" is unanswerable. Password reset
  and deactivation both need it, and Phase 3's `/entity/sessions` will too.
- **Deactivating a user revokes sessions and refresh tokens immediately**, rather than letting the
  account stay usable until they expire.

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

Tests: `tests/test_access_control_story.py` runs exactly that story end to end — an admin defines a
permission for a backend IDEN has never heard of, routes it through a role and a group, and a token
comes out carrying it, with the right `aud`. Plus per-resource tests for authorization, validation,
system-row protection, and the guarded deletes.

---

## Phase 3 — Entity RS (self-service)

**Goal:** what a signed-in person can do for themselves, plus the organization-defined profile
schema that makes IDEN usable by a university and a company without either one forking it.

**Before starting:** clear KI-1, and take KI-15 (Alembic) and KI-12 (audit log) from
[Known issues](#known-issues) — all three get more expensive with every phase that passes.

**The governing rule:** *a user may change anything about themselves that does not change what they
are allowed to do.* Authority is admin territory; everything else is theirs. Roles, groups, and
scopes are therefore absent from this module entirely.

Every route derives the user from the token's `sub` and never accepts a user id from the caller —
that alone removes an entire class of IDOR bugs.

### 3.1 Organization-defined profile fields

The feature that makes the Entity RS worth building. A university needs `student_id`, `department`,
`enrollment_year`; a company needs `employee_id`, `cost_centre`, `manager`. IDEN ships neither —
administrators define fields at runtime, exactly as they define scopes.

**`ProfileField`** (`admin/profile_fields/`, new scopes `admin:profile-fields:read|write`):

| Column | Purpose |
|---|---|
| `key` | `student_id` — stable identifier, referenced by claim mapping |
| `label`, `description` | What the form renders |
| `data_type` | `string` · `integer` · `boolean` · `date` · `enum` · `email` · `phone` · `url` |
| `options` | Allowed values when `data_type` is `enum` |
| `required`, `unique` | `unique` becomes a database constraint, not a service-layer check |
| `validators` | `pattern` / `min` / `max` / `min_length` / `max_length` |
| **`user_readable`, `user_writable`** | The pair that defines the self-service surface |
| `group_id` | Optional. Bound to a group, the field applies only to its members — how students and staff get different fields without a second grouping concept |
| `claim_name`, `claim_scope` | Optional token claim, released only when that scope was granted |
| `display_order`, `is_system` | Form ordering; `email`/`username`/`display_name` are built in |

**`UserProfileValue`** — one row per user per field, `UNIQUE (user_id, field_id)`, plus a partial
unique index on `(field_id, value)` for fields marked unique.

Why a values table rather than a JSONB column on `users`:

- **Uniqueness is a real constraint.** `student_id` must not collide. With JSONB that needs a
  partial unique index created *per field at runtime* — DDL triggered by an admin API call. A
  check-then-write in the service layer races under load.
- **Filtering works.** "Every user in Computer Science" is an indexed query, not a GIN scan.
- **Renaming a field is free.** Values reference `field_id`, so changing a key rewrites one row
  rather than every user's profile.

The cost is that values are stored as text with `data_type` driving the cast at the boundary, and
one extra query per profile read. Both are acceptable; the constraint story is not negotiable.
Keycloak's `USER_ATTRIBUTE` table is the same shape, for the same reasons.

**`user_writable` is what the self-service surface *means*.** `PATCH /entity/profile` does not have
a fixed field list — it accepts precisely the fields an admin marked writable. `student_id` is set
by the registrar through the admin API and is read-only to the student; `preferred_name` is theirs.
Same table, same endpoint, opposite permissions.

**Custom claims are opt-in.** A field is invisible to clients until someone sets `claim_name` and
`claim_scope`. Data minimization by default, and it reuses the Phase 2 scope system rather than
inventing a parallel release mechanism. Validate `claim_name` against the reserved OIDC claim names
so a custom field cannot shadow `sub`, `iss`, or `aud`.

### 3.2 Self-service endpoints

| Package | Endpoints | Scope |
|---|---|---|
| `entity/profile/` | `GET /entity/profile`, `PATCH /entity/profile`, `GET /entity/profile/schema` | `entity:profile:read` / `:write` |
| `entity/credentials/` | `POST /entity/credentials/password`, `POST /entity/credentials/email` (+ verification) | `entity:credentials:write` |
| `entity/totp/` | `POST /entity/totp/enroll`, `/confirm`, `GET`/`DELETE /entity/totp` | `entity:totp:read` / `:enroll` |
| `entity/sessions/` | `GET /entity/sessions`, `DELETE /entity/sessions/{id}` | `entity:sessions:read` / `:revoke` |
| `entity/connections/` | `GET /entity/connections`, `DELETE /entity/connections/{client_id}` | `entity:connections:read` / `:revoke` (new) |
| `entity/permissions/` | `GET /entity/permissions` | `entity:permissions:read` |

`GET /entity/profile/schema` returns the field definitions the user may see, so the dashboard renders
the form from data instead of hardcoding one organization's fields into a general-purpose IdP.

`/entity/connections` closes a Phase 1 gap: `ConsentGrant` rows are persisted but the user currently
has no way to see which applications hold access, or to withdraw it.

### 3.3 Freshness for sensitive operations

`require_fresh_auth(max_age=300)` in `core/auth.py`, checking the token's `auth_time`, applied to
password change, email change, TOTP removal, and session revocation.

A valid access token is not enough for these: an attacker holding a stolen token could otherwise take
over the account outright. Requiring a *recent* authentication forces them back through the login
they cannot complete. Returns `403` with `error="insufficient_user_authentication"` and the required
`max_age`, so the client knows to send the user through a re-auth rather than giving up.

### 3.4 Password reset

Belongs to the AuthZ module, not here: a locked-out user has no token, so no Entity RS route can
help them. Without it every forgotten password is an admin support ticket.

- `POST /api/v1/auth/password-reset` — always returns `202`, whether or not the email exists. A
  different response for unknown addresses turns this into an account-enumeration oracle.
- `POST /api/v1/auth/password-reset/confirm` — single-use token, 15-minute TTL, hashed in Redis.
  On success: revoke every refresh token and clear every session for that user.
- Delivery sits behind a small `notifier` interface that writes the link to the log in dev. Choosing
  an SMTP provider is a Phase 5 concern and should not block this.

### Other rules worth encoding

- A password or email change revokes every refresh token and clears the user's other sessions.
- TOTP enrollment is two-step — the credential activates only once a generated code is confirmed, so
  a mis-scanned QR code cannot lock someone out.
- `GET /entity/permissions` reuses `scope_resolver.scope_provenance()`. Three callers, one
  implementation.
- **Not offered:** account deletion. In a single-organization deployment the organization owns the
  identity — a student cannot delete their university account. Offer a deactivation *request* if the
  affordance is wanted.

### Done when

A non-admin user can sign in, read and update only the fields marked writable, and be rejected when
they try to write `student_id`. An admin defines a new field bound to the Students group, and it
appears in that user's `/entity/profile/schema` but not a staff member's. A field with
`claim_name` set shows up in the ID token only when its `claim_scope` was granted. Password change
requires a fresh authentication and invalidates the old refresh token. A forgotten password can be
recovered without an administrator.

Tests: per ground rule 8 — unit tests for field validation and the writability filter, integration
tests for the schema endpoint, the writability rejection, claim release, and freshness.

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
- **Test coverage review.** The suite grows with each phase, so this is a gap review rather than a
  build: coverage measurement, concurrency cases (two simultaneous refreshes of one token), and
  failure injection (Redis down, database down).
- **Docker.** `Dockerfile` for the provider, extending `deploy/docker-compose.yml` (created in Phase 0
  with postgres and redis) to wire in the provider, minio, and nginx.
- **Operational endpoints.** `/health` split into liveness and readiness.

### Done when

`docker compose up --build` brings up a working deployment; the test suite passes; the OWASP-relevant
checks — rate limits engaged, no secrets in logs, headers present — all hold.

---

## Known issues

Found in a review after Phase 2. Recorded here so they are scheduled rather than remembered.

**Status** is either *verified* (reproduced against the running app) or *suspected* (reasoned from
the code, not yet demonstrated). Fix the verified ones on evidence; demonstrate the suspected ones
with a failing test before changing anything.

### Correctness and security

**KI-1 · Introspection leaks token contents to unauthenticated callers · verified · high**
`authz/oauth/routes.py` authenticates only *confidential* clients on `/oauth2/introspect` and
`/oauth2/revoke`. Naming the public `dashboard` client with no secret returns the full token
contents — `sub`, `scope`, `aud`, `exp`, `jti`. RFC 7662 §2.1 requires the endpoint be protected.
Anyone who can reach IDEN and holds a token can learn whose it is and what it can do.
*Cause: "public clients have no secret" was treated as "public clients skip authentication."*
*Fix:* require a confidential client for both endpoints, or admit a public client only for tokens it
issued itself, with rate limiting. Fix before any deployment reachable by anyone but you.

**KI-2 · Narrowing a refresh token's scope is permanent · verified · medium**
`_refresh_token_grant` stores the narrowed set on the rotated token, so a client that once asked for
less can never get the original grant back. RFC 6749 §6 treats the refresh token as representing the
original grant, with per-request narrowing as a view of it, not a mutation.
Note that `tests/test_token_grants.py::test_scope_can_be_narrowed_but_not_widened` currently asserts
the buggy behaviour — the test agrees with the bug and must change with the code.
*Fix:* keep the original grant on the token family and intersect per request.

**KI-3 · Single-use enforcement is check-then-write · suspected · medium**
`oauth/service.consume_code` selects the row, tests `used_at`, then sets it. Under READ COMMITTED two
concurrent requests can both pass the check and both mint tokens, defeating the single-use property
that makes a stolen code survivable. `token_service.consume_refresh_token` has the same shape, where
it also defeats reuse *detection*.
*Fix:* `SELECT … FOR UPDATE`, or a conditional `UPDATE … WHERE used_at IS NULL` checking `rowcount`.
Demonstrate with a test that fires both requests concurrently.

**KI-4 · Consent records requested scopes, not granted ones · suspected · medium**
`consent/routes.py` persists `challenge.params["scope"]`. A user consents to a scope that was pruned
at issuance because they did not hold it; later they gain the role, and the client uses it without
ever asking again. The stored grant should be what was actually granted — that is what the user saw
and agreed to.

**KI-5 · `IndexError` on a client with no grants · verified as latent · low**
`revoke`/`introspect` read `client.allowed_grants[0]`. Not reachable through the admin API today;
reachable by a direct database edit, and it yields a 500.

**KI-6 · `GET /admin/groups` is N+1 · verified · low**
`member_count` runs once per group in the route — 8 queries for 5 groups. One `GROUP BY` away from
fixed.

### Design calls to ratify or overturn

These are working as written. They are listed because they were decided by default rather than
deliberately, and each has a real cost.

**KI-7 · `admin:roles:write` is effectively root.** Anyone holding it can add `admin:*` to a role
they hold. Reasonable for a single-org IdP, but it means "an admin who can only manage groups" is not
expressible. Expressing it needs a rule such as *you may not grant a scope you do not hold*.

**KI-8 · Nothing prevents locking yourself out.** The `administrator` role can be removed from the
last admin, or that admin deactivated. `is_system` protects the scope catalogue, not the assignment.
A "last active administrator" guard is cheap insurance against a one-way door.

**KI-9 · One token may carry several audiences.** Requesting admin and entity scopes yields both in
`aud`. Standard per RFC 9068, but a compromised resource server can replay the token at the other.
RFC 8707 (`resource`) is the tighter design if that matters.

**KI-10 · `require_scope` derives the audience from the scope prefix.** `core/auth._audience_for`
is correct for `admin:`/`entity:`/`biometric:` and silently wrong for anything else — an IDEN route
guarded by a custom scope would compute a nonexistent audience and 401 every request. Needs a guard
rail or an explicit audience argument.

**KI-11 · Key rotation needs a restart.** `core/crypto._keys` is `@cache`d at import. The docs call
rotation "a config change"; it is a config change *and* a restart.

### Operational gaps

**KI-12 · No audit log.** Nothing records who granted which scope to whom, or when. For an
access-control system this is the largest structural gap, and it is the one that cannot be
backfilled — history not written is simply lost. Pull at least write-path auditing forward into
Phase 3 rather than leaving it in Phase 5.

**KI-13 · No rate limiting.** `/api/v1/auth/login` and `/oauth2/token` accept unlimited attempts.
Argon2 makes each attempt expensive for the server, not the attacker. Phase 5 owns it, but the
endpoints are live now.

**KI-14 · Expired authorization codes and refresh tokens are never deleted.** Both tables grow
without bound. Needs a periodic cleanup, or a partitioning/TTL strategy.

**KI-15 · Alembic is still scheduled for Phase 5.** The schema has already needed three rounds of
manual surgery on the dev database, and Phase 3 adds two more tables. Move it to the start of
Phase 3, before there is data worth keeping.

### Suggested order

1. **KI-1** now — it is a live information leak and a small change.
2. **KI-15**, then **KI-12**, at the start of Phase 3 — both get more expensive with every phase.
3. **KI-2, KI-3, KI-4** during Phase 3, each with a failing test first.
4. **KI-7, KI-8** whenever you decide what a non-root administrator should be.
5. The rest with Phase 5 hardening.

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
