# OIDC Playground

Build an authorization request one parameter at a time, run it against a real
IDEN deployment, and read everything that comes back — the callback, the token
exchange, and every claim in every token.

A single-page app with no backend and no OIDC library. Every request it makes is
a `fetch` in [`src/lib/oidc.ts`](src/lib/oidc.ts) you can copy into your own
code, and PKCE is computed with `crypto.subtle` rather than imported. A library's
job is to hide the protocol; this exists to show it.

## What it walks through

1. **Discovery** — one URL, every endpoint. Nothing below is hardcoded.
2. **The client** — `client_id`, `redirect_uri`, and why a browser app has no secret.
3. **The request** — scopes, PKCE, `state`, `nonce`, `prompt`, `acr_values`, `max_age`, with the authorization URL assembling live as you type.
4. **The callback** — the raw query string, plus the checks a client is obliged to do: `state` matches, `iss` names the provider that was asked (RFC 9207), a code is present.
5. **The exchange** — the exact `POST` body, and the raw response.
6. **The tokens** — header and payload decoded, signature verified against the published JWKS, `nonce` checked, expiry counted down.
7. **Using them** — `/userinfo` by `GET` and by `POST`, refresh, introspect, revoke, sign out.

## Register a client first

The playground cannot create its own client. In your IDEN dashboard, go to
**Clients → Register client** and enter:

|                      |                                  |
| -------------------- | -------------------------------- |
| **Name**             | OIDC Playground                  |
| **Client ID**        | `playground`                     |
| **Application type** | Single-page application          |
| **Redirect URI**     | `http://localhost:5100/callback` |

Then give it permissions to request. On the client's page, tick whatever scopes
you want to experiment with — `entity:profile:read` is a good first one, since
`/userinfo` and `/entity/*` both become interesting.

Leave **Skip the consent screen** off. Watching the consent screen is half the
point.

## Let it through CORS

The playground calls the token and userinfo endpoints from `localhost:5100`, so
the provider has to allow that origin:

```bash
IDEN_ALLOWED_ADMIN_ORIGINS='["http://localhost:3000","http://localhost:5173","http://localhost:5100"]'
```

Restart the provider afterwards. If discovery fails with a network error and the
browser console mentions CORS, this is why.

## Run it

```bash
pnpm install
pnpm dev
```

<http://localhost:5100>. The port is fixed rather than incidental — it is in the
redirect URI you just registered, and a redirect URI is matched exactly.

Or in a container, on the same port so the same registered client works:

```bash
docker build -t iden-oidc-playground .
docker run --rm -p 5100:5100 iden-oidc-playground
```

Nothing is baked into the image — the issuer and every parameter are typed into
the page — so one build works against any deployment.

## Things worth trying

- **Turn PKCE off.** IDEN requires `S256` from every client, public or
  confidential, so the request is refused and you can read the refusal.
- **Ask for `prompt=none`** with no session. You get `login_required` back at the
  redirect URI rather than a login page — this is how an application checks
  silently whether someone is still signed in.
- **Drop `offline_access`** from the scopes. No refresh token comes back: the
  grant is what the client _may_ do, the scope is what this request asked for.
- **Send the ID token to `/userinfo`.** It is refused, because access tokens
  carry `typ: at+jwt` and a protected resource accepts nothing else.
- **Set `acr_values`** to a level your session does not meet, and watch IDEN send
  you back for a second factor before it will issue a code.
- **Sign in as someone with an authenticator.** IDEN asks for the code whatever
  the client requested — a second factor that applied only on request would
  protect nobody.

## What it stores

Configuration in `localStorage`, so the form survives a reload. The single-use
secrets of one attempt — `code_verifier`, `state`, `nonce` — in `sessionStorage`,
because a verifier left on disk after the tab closes is a verifier somebody else
can read.

Nothing is sent anywhere except to the issuer you name.
