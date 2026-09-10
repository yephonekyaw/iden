# Two apps, one session

Two applications that share nothing — separate processes, separate ports,
separate session stores. Sign into one and you are already signed into the
other. Sign out of either and **both** end, within a second, without the one you
did not touch being clicked.

That last part is single sign-*out*, and it is the half people skip. This sample
exists to show the receiving end of it, because most OIDC libraries do not
implement it and you have to write it yourself.

```
  Campus Portal :5200 ─┐                    ┌─→ POST /backchannel-logout
                       ├──→  IDEN :8000  ───┤
  Library       :5201 ─┘   (one session)    └─→ POST /backchannel-logout
```

## What it demonstrates

- **Single sign-on** — the second app never asks for a password.
- **`sid`** — IDEN's name for the browser session, carried in the ID token. Both apps show it, and it is identical in both while their own session ids differ.
- **Back-channel logout** — a signed logout token posted server to server. No iframes, no third-party cookies, so it survives browsers removing both.
- **Verifying a logout token properly** — signature, issuer, audience, the `events` claim, and the *absence* of `nonce`. A receiver that checks only the signature will accept an ID token here and sign the wrong person out.

## Register two clients

The sample creates nothing. In your IDEN dashboard, **Clients → Register client**,
twice:

| | Campus Portal | Library |
|---|---|---|
| **Name** | Campus Portal | Library |
| **Client ID** | `demo-portal` | `demo-library` |
| **Application type** | Single-page application | Single-page application |
| **Redirect URI** | `http://localhost:5200/callback` | `http://localhost:5201/callback` |

Then open each client and set two more things that the registration form does not
ask for. Both live on the client's detail page:

- **Post-logout redirect URI** — `http://localhost:5200/` and `http://localhost:5201/`
- **Back-channel logout URI** — see the next section, because the value is not what you expect

Tick a scope or two so `/userinfo` has something to say — `entity:profile:read`
is a reasonable first one. Leave consent on or off as you like; on is more
interesting the first time.

### The back-channel URI is not localhost

This is the one that catches everyone.

The redirect URI is where IDEN sends the **browser**, so `localhost` is correct —
your browser is on your machine. The back-channel logout URI is where IDEN's
**server** sends a POST, and if the provider is in Docker, `localhost` there
means *the container*, which is not running your sample.

| Where the provider runs | Back-channel logout URI |
|---|---|
| Docker Desktop (macOS, Windows) | `http://host.docker.internal:5200/backchannel-logout` |
| Docker on Linux | `http://172.17.0.1:5200/backchannel-logout`, or run the container with `--add-host=host.docker.internal:host-gateway` |
| Directly on your machine | `http://localhost:5200/backchannel-logout` |

Same again for `5201`. If sign-out only ever ends the app you clicked in, this is
why — the token was posted somewhere nothing was listening.

Also tick **"Logout tokens must name the session"** on both. It makes IDEN put
`sid` in the token, which is how each app finds the right session to end.

## Run it

```bash
pnpm install
pnpm dev          # both apps, one terminal
```

Or separately, which is clearer when you want to watch the logs:

```bash
pnpm portal       # http://localhost:5200
pnpm library      # http://localhost:5201
```

Point them somewhere other than the default with environment variables:

```bash
IDEN_ISSUER=https://iden.example.org \
CLIENT_ID=demo-portal \
pnpm portal
```

| Variable | Default |
|---|---|
| `IDEN_ISSUER` | `http://localhost:8000` |
| `CLIENT_ID` | `demo-portal` / `demo-library` |
| `CLIENT_SECRET` | *(empty — these are public clients)* |
| `PORT` | `5200` / `5201` |
| `ORIGIN` | `http://localhost:$PORT` |
| `SCOPE` | `openid profile email` |

No CORS configuration is needed. Unlike the playground, these apps talk to IDEN
from their own servers; the browser only ever follows redirects, and a redirect
is not a cross-origin request.

### In containers

One image, run twice — `APP` picks which application it is, exactly as the two
pnpm scripts do. Two processes is the point of the demo, so resist the urge to
collapse them into one container:

```bash
docker build -t iden-single-sign-out .
docker run --rm -e APP=portal  -p 5200:5200 iden-single-sign-out
docker run --rm -e APP=library -p 5201:5201 iden-single-sign-out
```

Every variable in the table above works as `-e`. Behind a proxy set `ORIGIN` to
the public URL: the redirect URI and the post-logout redirect are both built
from it, and both are matched exactly.

## The demo

1. Open both, side by side.
2. Sign into the Portal. Sign into the Library — **it does not ask for anything.**
3. Point out that `sid` is identical in both, while each app's own session id differs. One session at IDEN; two sessions here.
4. Press **Sign out everywhere** in either one.
5. Both go to signed-out. The one you did not touch says *"You were signed out by IDEN."*

For contrast, press **Sign out of this app only** instead. That app signs out and
the other carries on — which is what "sign out" means without an identity
provider behind it, and the reason single sign-out exists.

The page notices because it polls `/api/session` every 1.5 seconds. A back-channel
logout is a conversation between IDEN and this application's *server*; the open
browser is not part of it, and without the poll the window would look signed in
until somebody reloaded.

## Where to look in the code

| | |
|---|---|
| `src/oidc.ts` | `verifyLogoutToken` — the checks that make a logout token trustworthy |
| `src/sessions.ts` | the `sid` index, which is the whole reason logout can find anything |
| `src/server.ts` | `POST /backchannel-logout`, about fifteen lines |

Everything is hand-written rather than taken from a library, because the part
worth reading is the part libraries leave out. If you want the opposite — a
stock library, nothing custom — see [`../nextjs-nextauth`](../nextjs-nextauth).

## Troubleshooting

**Both apps sign out only when I click them.** The back-channel URI is wrong, or
unreachable. Watch the app's terminal: an accepted token logs
`[back-channel] logout token accepted`. Nothing at all means IDEN could not
reach you.

**`sessions ended here: 0`.** The token arrived and verified, but no session
matched its `sid`. Expected in the app you clicked sign-out in — it had already
ended its own session locally. Not expected in the other one.

**`The ID token carried no sid`** in the log. Turn on "Logout tokens must name
the session" on the client.

**`state does not match a request this application made`.** The server restarted
between the redirect out and the redirect back — pending requests are held in
memory. Sign in again.
