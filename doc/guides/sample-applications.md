# Sample applications

Four working applications live in [`samples/`](https://github.com/yephonekyaw/iden/tree/dev/samples).
Each one shows a different way of integrating, and each is its own project — its own dependencies,
its own build, its own README. Nothing in them imports from `web/` or `provider/`, so you can copy a
directory out of the repository, change the issuer, and run it against your own deployment.

| Sample | Port | Shape | Shows |
|---|---|---|---|
| **[`oidc-playground`](https://github.com/yephonekyaw/iden/tree/dev/samples/oidc-playground)** | 5100 | React SPA, no backend, no OIDC library | The authorization code flow one parameter at a time — PKCE computed with `crypto.subtle`, the callback checks, the token exchange, and every claim in every token |
| **[`single-sign-out`](https://github.com/yephonekyaw/iden/tree/dev/samples/single-sign-out)** | 5200, 5201 | Two Node servers | One session across two applications, and the back-channel logout receiver that most libraries make you write yourself |
| **[`nextjs-nextauth`](https://github.com/yephonekyaw/iden/tree/dev/samples/nextjs-nextauth)** | 5300 | Next.js with stock Auth.js | That a library which has never heard of IDEN works against it with no adapter and no glue |
| **[`door-access`](https://github.com/yephonekyaw/iden/tree/dev/samples/door-access)** | 5400, 5401 | A Next.js panel and an Express resource server | Authorization rather than authentication — offline validation with the audience check, `401` against `403`, step-up via `acr_values` and `max_age`, and why a revoked permission dies at the next refresh while a granted one needs a new sign-in |

## Which one to read

**Learning the protocol?** Start with `oidc-playground`. It deliberately does not use a library —
every request is a `fetch` you can copy — so it is the one that shows what
[Add a web application](web-application.md) describes rather than telling you about it.

**Convincing someone it is standards-compliant?** `nextjs-nextauth`. The whole integration is nine
lines of Auth.js configuration naming no endpoint at all, because discovery supplies them.

**Implementing sign-out?** `single-sign-out`, which is the only one showing the receiving end.
See also [Handle single sign-out](single-sign-out.md).

**Writing the API that trusts these tokens?** `door-access`. It is the only sample with a resource
server in it, and it is the runnable form of
[Validate tokens in your API](protect-an-api.md) — including the audience check that guide calls
the one people skip.

## Two things to set up first

### Register a client for each

The seed does not create sample clients on purpose — a client with a live redirect URI is not
something to leave lying around in a deployment by accident. Register each from the dashboard under
**Clients → Register client**; every sample's README names the exact `client_id`, redirect URI,
application type and scopes it expects.

`door-access` needs a resource API, three scopes, three roles and a group as well — it is the one
sample about permissions rather than identity, and those are the objects permissions are made of.
Its README walks through each in order, with the admin API call beside every dashboard step.

### Let browser samples through CORS

A single-page sample calls `/oauth2/token` and `/oauth2/userinfo` from its own origin, so that origin
has to be in the provider's allowlist:

```bash
IDEN_ALLOWED_ADMIN_ORIGINS='["http://localhost:3000","http://localhost:5173","http://localhost:5100"]'
```

Credentialed CORS forbids a wildcard, so every origin is named. Restart the provider afterwards. A
sample with its own backend — `nextjs-nextauth`, and the two servers in `single-sign-out` — does not
need this, because the browser never talks to the provider directly.

!!! warning "A back-channel logout URI is not a redirect URI"
    This catches everyone once. A redirect URI is where IDEN sends the **browser**, so `localhost` is
    correct — the browser is on your machine. A back-channel logout URI is where IDEN's **server**
    sends a `POST`, and if the provider runs in Docker, `localhost` there means the container.

    | Where the provider runs | Back-channel logout URI |
    |---|---|
    | Docker Desktop (macOS, Windows) | `http://host.docker.internal:5200/backchannel-logout` |
    | Docker on Linux | `http://172.17.0.1:5200/backchannel-logout`, or run with `--add-host=host.docker.internal:host-gateway` |
    | Directly on your machine | `http://localhost:5200/backchannel-logout` |

## Why they look like that

The samples share a neo-brutalist style that is *not* the dashboard's design language. They are
demos meant to be read across a room, and nobody should mistake a sample for the product.

The volume comes from the structure — 3px black rules, hard offset shadows, no radius, Archivo 900
set in caps over Space Grotesk, and JetBrains Mono for anything you would copy — so the palette
underneath it can stay earthy: paper, ink, one clay accent, an ochre for the line that matters.

Each sample carries its own copy of the styling, which is yours to delete when you copy it.
