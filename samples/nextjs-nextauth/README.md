# Next.js + Auth.js

A stock Next.js application signing in with IDEN through
[Auth.js](https://authjs.dev) (`next-auth`), using its **generic OIDC provider**
and nothing else. No IDEN adapter, no custom fetch, no patched endpoint.

That is the entire point. "Standards-compliant" is easy to claim; a library that
has never heard of IDEN working against it without a line of glue is the proof.
If you only show one sample to somebody sceptical, show this one — and then open
`auth.ts` and let them count the lines.

## The whole integration

```ts
providers: [
  {
    id: "iden",
    name: "IDEN",
    type: "oidc",
    issuer: process.env.IDEN_ISSUER,
    clientId: process.env.IDEN_CLIENT_ID,
    clientSecret: process.env.IDEN_CLIENT_SECRET,
    authorization: { params: { scope: "openid profile email offline_access" } },
    checks: ["pkce", "state", "nonce"],
  },
],
```

No endpoint appears anywhere. Auth.js reads them all from
`$IDEN_ISSUER/.well-known/openid-configuration`, which is what discovery is for.
The rest of `auth.ts` is two callbacks that carry `acr`, `amr` and `sid` through
to the page so there is something to look at — delete them and sign-in still
works.

`checks` is not configuration so much as agreement: Auth.js insists on PKCE, a
`state` and a `nonce`, and IDEN requires all three of every client. Neither end
had to be persuaded.

## Register a client

In your IDEN dashboard, **Clients → Register client**:

| | |
|---|---|
| **Name** | Next.js Sample |
| **Client ID** | `demo-nextjs` |
| **Application type** | **Web application** |
| **Redirect URI** | `http://localhost:5300/api/auth/callback/iden` |

**Web application**, not single-page. Auth.js runs the code exchange on the
server and holds the secret there, so this is a confidential client — the
browser never sees the token.

Copy the secret when it is shown. It is argon2-hashed on the way in and cannot
be retrieved afterwards, only rotated.

The redirect URI is Auth.js's, not yours — `/api/auth/callback/<provider id>`,
where the id is the `id: "iden"` in the provider config. Change one and change
the other.

Give it a scope or two to request while you are on the client's page;
`entity:profile:read` is a good first one.

## Configure and run

```bash
pnpm install
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | What it is |
|---|---|
| `IDEN_ISSUER` | `http://localhost:8000` |
| `IDEN_CLIENT_ID` | `demo-nextjs` |
| `IDEN_CLIENT_SECRET` | the secret shown once at registration |
| `AUTH_SECRET` | signs Auth.js's own cookie — `openssl rand -base64 32`. Nothing to do with IDEN |
| `AUTH_URL` | `http://localhost:5300` |

```bash
pnpm dev
```

<http://localhost:5300>.

No CORS configuration is needed: the browser only ever follows redirects, and
the token exchange happens server to server.

### In a container

```bash
docker build -t iden-nextjs-nextauth .
docker run --rm -p 5300:5300 --env-file .env.local iden-nextjs-nextauth
```

The five variables above are read when the server starts, not when the image is
built, so one image serves any deployment. `.env.local` is kept out of the image
by `.dockerignore` for the same reason — a secret in a layer is readable by
anyone who can pull it.

## What to point at

- **`auth.ts`** — the provider block above, and nothing else IDEN-specific.
- **The claims on the page** — `acr` and `amr` say how the person proved who they were, and Auth.js surfaced them without knowing what IDEN's assurance levels mean.
- **Sign out.** It ends the *Auth.js* session only. Sign in again and IDEN does not ask for a password, because its session is still live. That gap is what [`../single-sign-out`](../single-sign-out) exists to close — and it is also why back-channel logout matters, since Auth.js does not implement it.

## Things worth trying

- **Turn TOTP on** for the account you sign in with. Auth.js asks for nothing extra and the flow still works — the second factor is IDEN's business, not the client's, and `amr` afterwards says `pwd, otp, mfa`.
- **Remove `offline_access`** from the scope. Sign-in still works; there is simply no refresh token, so the session ends when the access token does.
- **Point `IDEN_ISSUER` at a deployment behind TLS.** Nothing else changes.

## Troubleshooting

**`redirect_uri is not registered for this client`.** The registered URI must be
exactly `http://localhost:5300/api/auth/callback/iden` — Auth.js's path, with the
provider id on the end.

**`invalid_client`.** The secret is wrong, or the client is registered as a
single-page application. Auth.js is a confidential client; register it as a web
application and rotate the secret.

**`MissingSecret`.** `AUTH_SECRET` is unset. It is Auth.js's own cookie key and
has nothing to do with IDEN.

**Discovery fails on start.** `IDEN_ISSUER` must be the origin only, with no
trailing slash and no path — Auth.js appends `/.well-known/openid-configuration`
itself.
