# Sample applications

Working applications that sign in with IDEN. Each one exists to show a different
way of integrating, and each is **its own project** — its own dependencies, its
own build, its own README.

Nothing here imports from `web/` or `provider/`. That is deliberate: a sample you
cannot copy out of this repository and point at your own deployment is not a
sample, it is a second frontend. Copy the directory, change the issuer, and it
runs.

They do share a look, because they are also a showcase: neo-brutalism — black
rules, hard offset shadows, flat colour, square corners, and one loud accent per
application. It is deliberately *not* the dashboard's design language from
[`DESIGN.md`](../DESIGN.md): these are demos, they are meant to be read across a
room, and nobody should mistake a sample for the product. Each sample carries
its own copy of the styling, which is yours to delete when you copy it.

The type is Archivo for headings, Space Grotesk for prose and JetBrains Mono for
anything you would copy — loaded from Google Fonts, with a system fallback so a
laptop with no network still looks right.

| Sample | Shape | Shows |
|---|---|---|
| [`oidc-playground`](oidc-playground/) | React SPA, no backend | The authorization code flow one parameter at a time — PKCE, the callback, the token exchange, and every claim in every token |
| [`single-sign-out`](single-sign-out/) | Two Node servers | Single sign-on across two applications, and single sign-*out* — the back-channel logout receiver most libraries make you write yourself |
| [`nextjs-nextauth`](nextjs-nextauth/) | Next.js, stock Auth.js | That IDEN works with an OIDC library that knows nothing about it. No custom code, no adapter |

## Running all four at once

Each sample has its own Dockerfile, and [`docker-compose.yml`](docker-compose.yml)
brings up all four together — four, because `single-sign-out` is two
applications and collapsing them into one container would demonstrate nothing.

```bash
cp samples/.env.example samples/.env    # then fill in the two secrets
docker compose -f samples/docker-compose.yml up --build
```

| | |
|---|---|
| Playground | <http://localhost:5100> |
| Campus Portal | <http://localhost:5200> |
| Library | <http://localhost:5201> |
| Next.js | <http://localhost:5300> |

One thing there is worth understanding before it confuses you. The issuer is
**not** `http://localhost:8000`, because one issuer string has to work from two
places at once — your browser follows a redirect to it, and the sample
containers fetch discovery and exchange codes at it — and it has to be the same
string in both, since the issuer is compared character for character. Inside a
container `localhost` is the container.

So the default is `http://iden.localtest.me:8000`: a public name that resolves
to `127.0.0.1`, which your browser follows to your published port, and which
`extra_hosts` overrides to the host gateway inside each container. Nothing is
added to `/etc/hosts`. Your deployment has to agree — set `IDEN_ISSUER` to the
same string in `deploy/.env` before registering the sample clients, because
every token already issued names the old one.

## Registering a client

Every sample needs an OAuth client registered in your deployment before it will
run, and the seed does not create them: a sample client with a live redirect URI
is not something to leave lying around in a deployment by accident.

Register one from the dashboard under **Clients → Register client**, or through
the admin API. Each sample's README names the exact `client_id`, redirect URI and
scopes it expects.

## Letting a browser sample talk to the provider

A single-page sample calls `/oauth2/token` and `/oauth2/userinfo` from its own
origin, so that origin has to be in the provider's CORS allowlist:

```bash
IDEN_ALLOWED_ADMIN_ORIGINS='["http://localhost:3000","http://localhost:5173","http://localhost:5100"]'
```

Credentialed CORS forbids a wildcard, so every origin is named. A sample with its
own backend does not need this — the browser never talks to the provider directly.
