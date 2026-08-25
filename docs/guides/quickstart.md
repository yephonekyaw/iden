# Run it locally

## You need

- **Python 3.14+** and [uv](https://docs.astral.sh/uv/)
- **Docker**, for PostgreSQL and Redis

## Start

```bash
# From the repository root — PostgreSQL 18 with pgvector, and Redis 8
docker compose -f deploy/docker-compose.yml up -d

cd provider
uv sync                              # install dependencies
cp .env.example .env                 # then read it

uv run python -m scripts.gen_keys    # signing keypair for local development
uv run alembic upgrade head          # create the schema
uv run python -m scripts.seed        # permissions, bootstrap admin, two clients

uv run provider                      # http://localhost:8000
```

The seed prints two secrets **once**:

```
  admin@localhost / _qajl3wRjjx6QsuXMO9YY5tw
  kiosk client_secret: 7ZJbgK2um1y9QeliyysqElTJ-SUhC_8R8aXRygrmUgM
```

They are hashed on the way into the database and cannot be recovered. Losing them means seeding a
fresh database.

## Check it worked

| | |
|---|---|
| Interactive API docs | <http://localhost:8000/docs> |
| OIDC discovery | <http://localhost:8000/.well-known/openid-configuration> |
| Health | <http://localhost:8000/health> |

Discovery is the interesting one — it is the document every OIDC client library reads to configure
itself, and it is generated from the live deployment. `scopes_supported` is read from the database,
so permissions you define appear there without a restart.

## What the seed created

| | |
|---|---|
| **Two APIs** | `admin` and `entity` — IDEN's own, with all their permissions |
| **Two roles** | `administrator` (everything) and `member` (self-service only) |
| **One person** | The bootstrap administrator |
| **`dashboard`** | A public client for the browser, PKCE, consent skipped |
| **`kiosk`** | A confidential client for machine-to-machine access |

The seed is idempotent — re-run it any time. It creates nothing structural; that is
[Alembic's job](../contributing/migrations.md).

## Sign in end to end

The fastest way to see a real flow is the test suite, which drives it in-process:

```bash
uv run pytest tests/test_auth_code_flow.py -v
```

To do it by hand, see [Add a web application](web-application.md).

## Common problems

??? failure "`connection refused` on port 5432"
    Postgres has not finished starting. `docker compose -f deploy/docker-compose.yml ps` should show
    it healthy.

??? failure "`No schema found. Run alembic upgrade head first.`"
    Exactly what it says — the seed refuses to half-fill an empty database.

??? failure "The sign-in round trip loses the session"
    Cookies are host-scoped. Whatever you use to drive the flow must reach IDEN on the same host as
    `IDEN_ISSUER`, or the session cookie is never sent back.
