# Install IDEN for your organization

A working deployment, from a clone to a signed-in administrator, with a check on every part of it
before anyone else is let in.

For a five-minute look at the server alone, see [Run it locally](quickstart.md). This page is the
whole system.

## What you are installing

| | | |
|---|---|---|
| **provider** | 8000 | The application. OIDC, administration, and self-service in one process. |
| **auth-ui** | 4000 | The hosted login. The only place a password is typed. |
| **dashboard** | 3000 | Administration and self-service. What each person sees is decided by their permissions. |
| **PostgreSQL 18** | 5432 | People, permissions, clients, tokens. |
| **Redis 8** | 6379 | Sessions, pending sign-ins, rate limits. |

One organization per deployment. There is no tenant column anywhere, and the administrators are your
staff rather than a vendor's — see [Single-organization by design][single-org].

## Before you start

- **Docker** with Compose. That is enough for everything below.
- A hostname, if this is going anywhere but your laptop. Fill it in at step 3 rather than changing it
  later — the issuer is compared exactly, and moving it invalidates every token and session.

---

## 1. Get the code

```bash
git clone https://github.com/iden-project/iden.git
cd iden
```

## 2. Generate signing keys

IDEN signs every token with an RSA key you own. It refuses to start without one, and it will not
invent one for you — a key that appears by magic is a key nobody knows the provenance of.

```bash
docker compose -f deploy/docker-compose.yml build provider

docker run --rm -v "$PWD/provider/keys:/keys" -e IDEN_SIGNING_KEY_DIR=/keys \
  --entrypoint python iden-dev-provider:latest -m scripts.gen_keys
```

```text
Wrote signing key: /keys/iden-20260825.pem (kid: iden-20260825)
```

The filename stem becomes the key's `kid`, and keys sort by name — which is what makes rotation a
matter of adding a file rather than a migration. Back this directory up. Losing it signs everyone
out permanently.

!!! warning "Production keys belong in a secret store"
    `gen_keys` is for getting started. In production, mount the key from wherever your organization
    already keeps secrets, and never commit it.

## 3. Configure

Everything the deployment needs is in `deploy/docker-compose.yml`. On a laptop it works unchanged.
For a real hostname, four values have to agree:

```yaml
environment: &provider-env
  IDEN_ENV: prod                                   # marks the session cookie Secure
  IDEN_ISSUER: https://iden.example.org
  IDEN_AUTH_UI_BASE_URL: https://iden.example.org
  IDEN_ALLOWED_ADMIN_ORIGINS: '["https://iden.example.org"]'
```

and both frontends get the same issuer:

```yaml
auth-ui:
  environment:
    IDEN_ISSUER: https://iden.example.org
dashboard:
  environment:
    IDEN_ISSUER: https://iden.example.org
```

| Setting | Why it is compared exactly |
|---|---|
| `IDEN_ISSUER` | Every client library validates the `iss` claim against it, character for character. |
| `IDEN_AUTH_UI_BASE_URL` | Where `/authorize` sends people to sign in. The paths `/auth/login`, `/auth/consent` and `/auth/reset` are fixed. |
| `IDEN_ALLOWED_ADMIN_ORIGINS` | Credentialed CORS forbids a wildcard, so every origin the dashboard is served from is named. |
| The `dashboard` client's redirect URIs | Matched exactly — no wildcards, no trailing-slash forgiveness. Set at step 5. |

Behind one hostname you want a reverse proxy in front of all three: the provider owns the protocol
paths, auth-ui owns `/auth/*`, the dashboard owns the rest. A reference configuration is in
`deploy/nginx/iden.conf.example`; TLS and flood protection stay yours, and
[Deployment](../operations/deployment.md) explains why.

## 4. Start everything

```bash
docker compose -f deploy/docker-compose.yml up -d --build
```

Migrations run to completion before the provider starts, as their own service — so scaling the
provider does not run them twice against the same database.

```bash
docker compose -f deploy/docker-compose.yml ps
```

All five services up, `provider` healthy.

## 5. Create the first administrator

The schema exists but is empty. The seed fills it: IDEN's own permissions, the two starting roles,
one administrator, and the two clients.

```bash
docker compose -f deploy/docker-compose.yml exec provider python -m scripts.seed
```

```text
Seeded 25 system scopes across 2 APIs.
  admin@localhost / _qajl3wRjjx6QsuXMO9YY5tw
  kiosk client_secret: 7ZJbgK2um1y9QeliyysqElTJ-SUhC_8R8aXRygrmUgM
```

**Write both down now.** They are hashed on the way into the database and cannot be recovered.

| What it created | |
|---|---|
| **Two APIs** | `admin` and `entity`, with all 25 of their permissions |
| **Two roles** | `administrator` (everything) and `member` (self-service only) |
| **One person** | The bootstrap administrator |
| **`dashboard`** | A public client for the browser: PKCE, consent skipped as a first-party app |
| **`kiosk`** | A confidential client, for machine-to-machine access |

The seed is idempotent — re-run it any time, including after an upgrade that ships new permissions.
It creates nothing structural; that is [Alembic's job](../contributing/migrations.md).

On anything but a laptop, the `dashboard` client's redirect URIs still point at localhost. Fix that
before signing in, from the Clients page or:

```bash
curl -X PATCH https://iden.example.org/admin/clients/{id} \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"redirectUris": ["https://iden.example.org/callback"]}'
```

## 6. Sign in

Open <http://localhost:3000>. You are redirected to the login, and back to the dashboard afterwards.

Change the bootstrap password immediately, under **Security**. A password that was printed to a
terminal and pasted into a chat window is not a password.

---

## Check every part works

Fifteen minutes, entirely through the two applications. Each row exercises a different part of the
system, and the order matters — later rows depend on earlier ones.

### Signing in

| Do this | You should see |
|---|---|
| Open the dashboard signed out | The login, showing which application is asking |
| Sign in with the bootstrap password | The dashboard, with an **Administration** section in the sidebar |
| **Security** → set up an authenticator, scan, confirm | Two-factor on |
| Sign out, sign in again | The code step appears after the password |
| **Sessions** | This browser listed as current, with `Password + Authenticator app` |

### Self-service

| Do this | You should see |
|---|---|
| **Profile** → change your display name → Save changes | "Saved." |
| **Security** → change your password | It asks you to confirm your password first, then reports how many other sessions were signed out |
| **Permissions** | Every permission you hold, each showing where it came from |

That last screen is the one worth looking at twice. It answers *why can this person do that?* — and
it is the same view administrators get for anyone else.

### Administration

| Do this | You should see |
|---|---|
| **APIs** → Register API, then define a scope on it | The scope listed under the API that owns it |
| **Roles** → Create role → tick that scope → Save | The role holding it |
| **Users** → Add user → assign the role | A one-time password, shown once |
| Open that user → **Everything they can do** | The new scope, traced back to the role |
| **Groups** → Create group → give it a role → add the user | The member count rising |
| Re-open the user | The group's role now among their permissions |
| **Clients** → Register client | A secret for a confidential client, nothing for a public one |
| **Audit log** | Every one of the above, newest first, with your name against it |

### The parts that are supposed to refuse

A system that only works when you do the right thing has not been tested.

| Do this | You should see |
|---|---|
| Sign in as the new user, with only the `member` role | No **Administration** section at all |
| As that user, open `/admin/users` directly | An explanation, not a broken page |
| As an administrator, open **Roles** → `administrator` | Marked built in, and not editable |
| Try to delete an API whose scopes are in use | A refusal naming what still depends on it |
| Enter a wrong password five times quickly | A countdown, not a generic error |

The last two are the ones people skip. The refusals are the product.

---

## Set up your organization

In the order that avoids rework:

1. **Profile fields** — what you record about people beyond name and email. Everyone's profile form
   is built from this, so define it before you add people. See
   [Define your profile schema](profile-schema.md).
2. **APIs and scopes** — register each backend that will trust IDEN, and define the permissions it
   understands. See [Validate tokens in your API](protect-an-api.md).
3. **Roles** — bundle those permissions into job functions. Name them after the job, not the
   permissions.
4. **Groups** — your departments and teams. Give them roles; membership does the rest.
5. **People** — add them, put them in groups. Direct grants exist for genuine exceptions, not as the
   normal path.
6. **Your applications** — register each one and choose what it may request. See
   [Register your application](register-a-client.md).

## Before you let anyone else in

Work through [Before you expose it](../operations/security-checklist.md). The short version: TLS with
`IDEN_ENV=prod`, a proxy doing flood protection, the bootstrap password changed, and the signing keys
backed up somewhere that is not this server.

## Common problems

??? failure "`No signing keys in /keys`"
    Step 2 was skipped, or the keys directory did not exist when Docker mounted it — in which case
    Docker created an empty one. Generate the key, then `docker compose restart provider`.

??? failure "`No schema found. Run alembic upgrade head first.`"
    The `migrate` service has not finished, or failed. `docker compose logs migrate` says which. The
    seed refuses to half-fill a database rather than leaving you with one that half-matches the code.

??? failure "The dashboard redirects forever and never signs in"
    `IDEN_ISSUER`, `IDEN_ALLOWED_ADMIN_ORIGINS` and the `dashboard` client's redirect URIs do not all
    name the same origin. All three are compared exactly. The browser console usually names which
    one — a CORS refusal or an `invalid_request` on the redirect URI.

??? failure "Signing in works, then the dashboard immediately signs out again"
    Usually the clock. Access tokens live about ten minutes, and a container whose time has drifted
    issues tokens that are already expired.

??? failure "`connection refused` on 5432"
    Postgres has not finished starting. `docker compose ps` should show it healthy before the
    provider tries.

More in [Troubleshooting](troubleshooting.md).

[single-org]: https://github.com/iden-project/iden#single-organization-by-design
