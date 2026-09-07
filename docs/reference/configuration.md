# Configuration

Every setting is read from the environment or a `.env` file, prefixed `IDEN_`. Defaults are
development defaults — the ones that matter in production are called out below the table.

`provider/.env.example` carries the same list with the reasoning next to each one, and is the file to
copy when running the provider outside a container.

## The provider

| Variable | Default | Notes |
|---|---|---|
| `IDEN_ENV` | `dev` | `prod` makes the session cookie `Secure`. |
| `IDEN_LOG_LEVEL` | `info` |  |
| `IDEN_API_PREFIX` | *empty* | Mount the whole app under a sub-path. Must stay empty otherwise — OIDC requires `/.well-known/*` at the host root. |
| `IDEN_ALLOWED_ADMIN_ORIGINS` | `[]` | Origins allowed to send credentialed requests, beyond the Auth UI. |
| `IDEN_ISSUER` | `http://localhost:8000` | **The identity of this deployment.** It appears in every token, and clients validate against it. Changing it invalidates everything already issued. |
| `IDEN_AUTH_UI_BASE_URL` | `http://localhost:4000` | Where `/authorize` sends people to sign in. |
| `IDEN_DATABASE_URL` | `postgresql+asyncpg://iden:iden@localhost:5432/iden` |  |
| `IDEN_REDIS_URL` | `redis://localhost:6379/0` | Sessions, pending sign-ins, the denylist, and rate-limit counters. |
| `IDEN_S3_ENDPOINT_URL` | *empty* | Blob storage, over the S3 API. Empty means none is attached and profile photos are unavailable; nothing else changes. |
| `IDEN_S3_ACCESS_KEY` | *empty* |  |
| `IDEN_S3_SECRET_KEY` | *empty* |  |
| `IDEN_S3_BUCKET` | `iden` | Created at startup when it does not exist. |
| `IDEN_S3_REGION` | `us-east-1` | Required by the S3 signature even where the store ignores it. |
| `IDEN_AVATAR_MAX_BYTES` | `5242880` (5 MiB) | Refused before the upload is decoded. |
| `IDEN_SIGNING_KEY_DIR` | `keys` | One PEM per key. Filenames sort, and the last one signs — a date-stamped name makes the newest key active. |
| `IDEN_SIGNING_ALGORITHM` | `RS256` |  |
| `IDEN_ACCESS_TOKEN_TTL` | `600` (10 min) | Short on purpose: permission changes take effect at the next issuance, and a revoked token cannot be recalled before it expires. |
| `IDEN_ID_TOKEN_TTL` | `600` (10 min) |  |
| `IDEN_REFRESH_TOKEN_TTL` | `2592000` (30 days) | Sliding; rotated on every use. |
| `IDEN_AUTH_CODE_TTL` | `60` (1 min) | Single use. |
| `IDEN_SESSION_TTL` | `86400` (24 hours) | Sliding browser session. |
| `IDEN_CHALLENGE_TTL` | `600` (10 min) | How long a pending sign-in or consent page stays valid. |
| `IDEN_REFRESH_GRACE_PERIOD` | `30` (seconds) | How long a spent refresh token keeps returning what it was exchanged for. `0` restores strict single use, at the price of signing people out over a double-click. |
| `IDEN_RATE_LIMIT_ENABLED` | `true` | Off only for a load test against a deployment you own. |
| `IDEN_BOOTSTRAP_ADMIN_EMAIL` | `admin@localhost` | Used by the seed on first run. |
| `IDEN_BOOTSTRAP_ADMIN_PASSWORD` | *empty* | Left empty, the seed generates one and prints it once. |
| `IDEN_BIOMETRIC_ENABLED` | `false` | Mounts `/biometric/*` and seeds its permissions. The module is not built yet. |
| `IDEN_ENGINE_BASE_URL` | `http://engine:8000` |  |

## The two frontends

`auth-ui` and `dashboard` are static builds, so their configuration is read at container start rather
than compiled in — one image serves any deployment. The entrypoint writes these into `/config.js`.

| Variable | Default | Notes |
|---|---|---|
| `IDEN_ISSUER` | `http://localhost:8000` | The provider's origin. Must appear in `IDEN_ALLOWED_ADMIN_ORIGINS`, since every call these apps make is credentialed. |
| `IDEN_ORG_NAME` | *empty* | Whose sign-in page this is. Takes the larger type wherever both appear, with IDEN as a caption beneath. Empty and IDEN stands alone. |
| `IDEN_ORG_LOGO_URL` | *empty* | Any URL the browser can reach. Sits beside the name. |

Under `pnpm dev` there is no container, so the same three are read from Vite environment variables
with a `VITE_` prefix — `VITE_IDEN_ISSUER`, `VITE_IDEN_ORG_NAME`, `VITE_IDEN_ORG_LOGO`. Each app has
an `.env.example` to copy.

## The three that matter in production

**`IDEN_ISSUER`** is the identity of the deployment. It goes into every token and every client
validates against it. Set it to the public HTTPS URL, and treat changing it as invalidating every
token in circulation.

**`IDEN_SIGNING_KEY_DIR`** holds the private keys that sign every token. Anyone who reads them can
mint a token for anyone. Mount it read-only, keep it off the image, and back it up somewhere you
would be comfortable keeping a password.

**`IDEN_ENV=prod`** makes the session cookie `Secure`, so it is never sent over plain HTTP.

## Rotating a signing key

Keys sort by filename and the last one signs, so a date-stamped name makes the newest key active:

```
keys/
  iden-20260101.pem     ← was signing
  iden-20260801.pem     ← now signing
```

Keep the old key in place until every token signed with it has expired — it is still published in
JWKS, so tokens already issued keep validating. Then delete it.
