# Run the frontends

Working on the two browser applications themselves. To *deploy* them, see
[Install it for your organization](install.md) — this page is about the development loop.

IDEN ships two of them. They are what turns the API into something a person can use.

| App | Development port | What it does |
|---|---|---|
| **auth-ui** | 4000 | The hosted login. `/oauth2/authorize` redirects here for the password step, TOTP, and consent. It is the only place a password is typed. |
| **dashboard** | 5173 | Administration and self-service in one app. What you see is decided by the scopes in your token. |

Both are React on Vite in the `web/` pnpm workspace, sharing a `shared` package: the design tokens,
the generated API types, one axios client, and the components that render identity data. See
[web/README.md][web-readme] for the layout.

## Start the provider

The frontends have nothing to show without it. From `provider/`:

```bash
docker compose -f ../deploy/docker-compose.yml up -d postgres redis
uv run python -m scripts.gen_keys    # once — the provider will not start without a key
uv run alembic upgrade head
uv run python -m scripts.seed        # prints the bootstrap password, once
uv run provider                      # http://localhost:8000
```

## Start the frontends

From `web/`:

```bash
pnpm install
pnpm dev
```

auth-ui serves on 4000 and the dashboard on 5173. Both ports work out of the box — 4000 is
`IDEN_AUTH_UI_BASE_URL`, and 5173 is already in the CORS allowlist and in the `dashboard` client's
redirect URIs. Open <http://localhost:5173> and you are sent through a real sign-in.

## Types come from the server

Request and response types are generated from the provider's own OpenAPI document, never written by
hand:

```bash
pnpm gen:api
```

It reads the schema out of the FastAPI application directly rather than over HTTP, so it works
without a running server. Re-run it after changing any provider schema, and commit the result.

## Before you commit

```bash
pnpm lint
pnpm typecheck
pnpm build
```

The same three run in CI. Conventions are in [GUIDELINES.md § Frontend Code][guidelines]; the visual
system is `DESIGN.md`, transcribed once into `web/shared/tokens/theme.css` — every colour and size
resolves there rather than being written inline.

## Serving them from somewhere else

Whichever origin serves the dashboard has to be named in three places that are all compared exactly,
and getting one wrong is the usual cause of a dashboard that redirects forever. The settings, and how
to change them, are in [Install it for your organization § Configure](install.md#3-configure).

## When something is wrong

A blank dashboard that keeps redirecting almost always means the issuer, the CORS allowlist and the
registered redirect URI do not all name the same origin — the browser console says which.
[Troubleshooting](troubleshooting.md) covers the rest.

[web-readme]: https://github.com/iden-project/iden/blob/main/web/README.md
[guidelines]: https://github.com/iden-project/iden/blob/main/GUIDELINES.md
