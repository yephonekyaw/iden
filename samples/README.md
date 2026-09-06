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
