# Behind a Cloudflare Tunnel

How to put IDEN on the internet without opening an inbound port, with nginx in front of the three
applications and `cloudflared` carrying traffic in.

Budget **about an hour**. Twenty minutes of it is Cloudflare's own settings, and that part is not
optional — several of its defaults break an identity provider in ways that look like bugs in IDEN.

!!! tip "Deploying without a tunnel?"
    [Deployment](deployment.md) covers what IDEN needs from any proxy. This page is the specific,
    tested arrangement; read it anyway for the sections on client addresses and single sign-out,
    which apply to any proxy.

## The shape of it

```
browser --HTTPS--> Cloudflare edge --tunnel--> cloudflared --HTTP--> nginx --> provider
                                                                           --> auth-ui
                                                                           --> dashboard
```

Four things follow from that picture, and they are the reasons this page exists.

**Your server listens on nothing.** `cloudflared` makes an *outbound* connection to Cloudflare and
traffic comes back down it. There is no port to firewall and no address to scan. This is the main
reason to do it this way.

**Cloudflare terminates TLS, so nginx does not.** No certificates on your host, nothing to renew.
`cloudflared` always speaks plain HTTP to the origin, which is why the nginx config here has no
`ssl_certificate` and no `:80 → :443` redirect — that redirect would loop forever, because
`cloudflared` would follow it back out to Cloudflare and in again.

**Every request arrives from `cloudflared`.** Left alone, that means IDEN counts the whole internet
as one caller and writes one address into every audit row. Three settings fix it, and they have to
agree — see [Who the caller is](#who-the-caller-is).

**Cloudflare is now in the request path, and it has opinions.** Bot protection, caching and script
rewriting are all on by default in ways that break OIDC. See [Cloudflare's settings](#5-cloudflares-settings).

## One origin, three applications

Everything lives on one hostname. That is not only tidiness: the session cookie is `SameSite=Lax`
and set by the provider, and one origin makes it unambiguously first-party for both frontends.

| Path | Served by | Why there |
|---|---|---|
| `/.well-known/*` | provider | OIDC requires discovery at the host root. Never mount IDEN under a sub-path — `IDEN_API_PREFIX` must stay empty. |
| `/oauth2/*` | provider | The protocol endpoints. |
| `/api/v1/auth/*` | provider | Where a password is checked. |
| `/admin/*`, `/entity/*` | provider | The two resource servers. |
| `/media/*` | provider | Profile photos. This is the URL in the `picture` claim, fetched by `<img>` tags that cannot present a token. |
| `/auth/*` | auth-ui | The hosted sign-in page. The provider redirects here by name. |
| `/console/*` | dashboard | Administration and self-service. |
| everything else | nobody | `404`. |

!!! info "Why the dashboard is on `/console` and not the root"
    The provider's API owns `/admin/*`, and the dashboard's own admin screens have the same
    names — `/admin/users` is both an API endpoint and a page. On one origin nginx must send it to
    exactly one of them, and either choice breaks the other. The dashboard moved.

    `/` redirects to `/console/`, so the bare hostname still opens the dashboard.

Both frontends are built with a matching Vite `base`, so their assets are served from
`/auth/assets/` and `/console/assets/` and cannot collide. This is why you cannot simply point a
proxy at the images and pick your own paths: change the path and you must change the `base` and
rebuild.

## Before you start

- A domain on Cloudflare, with the orange cloud enabled.
- Docker with Compose on the host.
- The repository cloned on that host.

**Decide the hostname now.** `IDEN_ISSUER` goes into every token and is compared character for
character. Changing it later invalidates everything already issued.

Throughout, `iden.example.org` stands for yours.

## The order to do it in

This page and [Install it for your organization](../guides/install.md) interleave — the tunnel needs
a deployment to point at, and the deployment needs its hostname before it is seeded. Follow this
sequence and neither doubles back on the other.

| | Step | Where |
|---|---|---|
| 1 | Clone the repository | [install 1](../guides/install.md#1-get-the-code) |
| 2 | Generate the signing key | [install 2](../guides/install.md#2-generate-a-signing-key) |
| 3 | Create the tunnel, copy its token | [below](#1-create-the-tunnel) |
| 4 | Write `deploy/.env` — hostname, token | [below](#2-configure-the-deployment) |
| 5 | Copy `iden.conf.example` to `iden.conf` | [below](#2-configure-the-deployment) |
| 6 | Start everything, **with the tunnel overlay** | [below](#3-start-it) |
| 7 | Seed the first administrator | [install 5](../guides/install.md#5-create-the-first-administrator) |
| 8 | Point the `dashboard` client at the hostname | [below](#4-point-the-dashboard-client-at-the-hostname) |
| 9 | Change Cloudflare's settings | [below](#5-cloudflares-settings) |
| 10 | Verify, then sign in | [below](#verify-it) · [install 7](../guides/install.md#7-sign-in) |
| 11 | Work through the security checklist | [checklist](security-checklist.md) |
| 12 | Take a backup, and restore it once | [backup](backup-and-restore.md#testing-it) |

Steps 1, 2 and 7 are the install guide's; everything else is here. The install guide's own step 3
and step 4 are replaced by steps 4–6 above, which are the same work with the tunnel in it.

!!! tip "Already running it on a laptop?"
    Then you have done 1, 2 and 7 already. Start at step 3, and at step 6 add the overlay to the
    stack you have. The database and the signing key carry over — only the hostname changes, which
    means redoing step 8.

---

## 1. Create the tunnel

In the Cloudflare dashboard: **Zero Trust → Networks → Tunnels → Create a tunnel**, choose
**Cloudflared**, name it, and copy the token it shows.

Do not install the connector the way the page suggests — Compose runs it. You only need the token.

!!! danger "The token is a credential"
    It authenticates this host as the tunnel. Anyone holding it can serve your hostname. Keep it in
    `deploy/.env`, which is git-ignored, and treat it the way you treat a password.

Then add a **public hostname** to the tunnel:

| Field | Value |
|---|---|
| Subdomain / domain | `iden` / `example.org` |
| Service type | **HTTP** |
| URL | `nginx:80` |

`nginx` is the Compose service name — `cloudflared` runs on the same network and resolves it
directly. **HTTP**, not HTTPS: the hop is inside the Docker network, and putting a self-signed
certificate on it with `noTLSVerify` would be encryption without authentication, which is worse than
the plaintext it replaces.

Cloudflare creates the DNS record for you.

## 2. Configure the deployment

```bash
cp deploy/.env.example deploy/.env
```

Edit `deploy/.env`. Every value is explained in the file; these are the ones that matter:

```bash
IDEN_ENV=prod
IDEN_ISSUER=https://iden.example.org
IDEN_AUTH_UI_BASE_URL=https://iden.example.org
IDEN_ALLOWED_ADMIN_ORIGINS=[]
IDEN_FORWARDED_ALLOW_IPS=172.31.250.0/24
CLOUDFLARE_TUNNEL_TOKEN=<the token from step 1>
```

`IDEN_ENV=prod` marks the session cookie `Secure` and sends HSTS. It also removes `/docs`, `/redoc`
and `/openapi.json`, which would otherwise publish the complete shape of your admin API.

`IDEN_ALLOWED_ADMIN_ORIGINS` is **empty on purpose**. One origin means the dashboard's calls to the
provider are same-origin, so there is no cross-origin request to allow. Name an origin here only for
a browser application on some *other* host that calls the provider directly.

Then copy the proxy config:

```bash
cp deploy/nginx/iden.conf.example deploy/nginx/iden.conf
```

It works unedited if you keep the default subnet. Read it anyway — it is short, and it is where
every routing decision on this page actually lives.

## 3. Start it

```bash
docker compose -f deploy/docker-compose.yml \
               -f deploy/docker-compose.tunnel.yml up -d --build
```

The overlay adds `nginx` and `cloudflared`, and pins the project network to `172.31.250.0/24` — a
fixed subnet so that the address nginx trusts is knowable in advance rather than looked up after
every `up`.

**Check it worked**, without going out to Cloudflare and back:

```bash
curl -s -H 'Host: iden.example.org' \
     http://127.0.0.1:8080/.well-known/openid-configuration | jq .issuer
```

```json
"https://iden.example.org"
```

nginx publishes `127.0.0.1:8080` for exactly this. If the issuer says `localhost`, `deploy/.env` is
not being read — check that it sits next to `docker-compose.yml`, not at the repository root.

Then from anywhere:

```bash
curl -s https://iden.example.org/.well-known/openid-configuration | jq .issuer
```

## 4. Point the dashboard client at the hostname

The seeded `dashboard` client allows only localhost callbacks. Until it names your origin, sign-in
loops.

```bash
docker compose -f deploy/docker-compose.yml exec -T postgres \
  psql -U iden -d iden -c \
  "update clients set redirect_uris = ARRAY['https://iden.example.org/console/callback']
   where client_id = 'dashboard';"
```

`redirect_uris` is a PostgreSQL array (`character varying[]`), not JSON — hence `ARRAY[...]` rather
than a bracketed string. A JSON literal here fails with *malformed array literal*.

Note `/console/callback`: the dashboard's redirect URI moved with the app.

**Check it worked**, since a wrong value here presents as a sign-in loop rather than an error:

```bash
docker compose -f deploy/docker-compose.yml exec -T postgres \
  psql -U iden -d iden -c \
  "select client_id, redirect_uris from clients where client_id = 'dashboard';"
```

```text
 client_id |                redirect_uris
-----------+--------------------------------------
 dashboard | {https://iden.example.org/console/callback}
```

Once you can sign in, the **Clients** screen in the dashboard edits this without SQL. Direct
`psql` is for the bootstrap, when there is no way in yet.

## 5. Cloudflare's settings

This is the part that is easy to skip and expensive to skip.

### Turn on

| Setting | Where | Why |
|---|---|---|
| **Always Use HTTPS** | SSL/TLS → Edge Certificates | Without it Cloudflare also serves the hostname over plain HTTP. A visitor arriving there gets a working page, signs in, and the `Secure` session cookie is accepted but never sent back — **sign-in loops forever with no error anywhere**, not in the browser console, not in the audit log. HSTS only protects someone who reached you over HTTPS at least once. |
| **SSL/TLS mode: Full (strict)** | SSL/TLS → Overview | Largely moot for tunnel traffic, which is already authenticated and encrypted. It closes any non-tunnel path to the same hostname. |

### Turn off

| Setting | Why |
|---|---|
| **Rocket Loader** | Defers and reorders scripts. Both frontends load `/config.js` before the bundle, and that ordering is what tells them the issuer. Reordered, the app boots blank with no useful error. |
| **Auto Minify** (if present) | The bundles are already minified; it has a history of corrupting them. |
| **Email Obfuscation**, **Mirage** | Rewrite response bodies. Nothing here benefits. |

### Never turn on

!!! danger "Cache Everything"
    A Cache Rule that ignores origin cache control, applied to this hostname, will cache a token
    response or a profile at a shared edge and serve one person's data to the next visitor.

    IDEN already sends the right headers — `no-store` on everything except discovery, JWKS, and
    avatars — and Cloudflare respects them by default. Leave it that way.

### Let the protocol through the WAF

Bot Fight Mode and managed challenges answer anything that does not look like a browser with an HTML
interstitial or a `403`. Every one of these is a non-browser caller:

- `POST /oauth2/token` — every confidential client, every refresh
- `POST /oauth2/introspect`, `POST /oauth2/revoke`
- `GET /.well-known/jwks.json` — fetched by every API validating a token
- `GET /.well-known/openid-configuration` — fetched by every client library at startup
- `/admin/*` and `/entity/*` with a bearer token

A challenged token exchange returns `text/html` with a `403`. The client library tries to parse it as
the error object RFC 6749 defines, fails, and reports something opaque about invalid JSON — while
your provider never saw the request, so nothing correlates in the audit log.

Add a **WAF custom rule**, action **Skip**, skipping *Bot Fight Mode* and *rate limiting*:

```
http.host eq "iden.example.org" and (
  starts_with(http.request.uri.path, "/oauth2/") or
  starts_with(http.request.uri.path, "/.well-known/") or
  starts_with(http.request.uri.path, "/admin/") or
  starts_with(http.request.uri.path, "/entity/")
)
```

Leave protection on for `/auth/*` and `/console/*`, which genuinely are only ever browsers.

---

## Who the caller is

IDEN attributes a request to an address in two places that matter: the per-address rate limits, and
the `ip` column of every audit row. Behind a proxy both see the proxy unless three settings agree.

```
Cloudflare sets     CF-Connecting-IP: 203.0.113.9      one address, always, overwritten at the edge
        │
nginx   real_ip_header CF-Connecting-IP                $remote_addr becomes 203.0.113.9
        set_real_ip_from 172.31.250.0/24               ...but only from this network
        │
        proxy_set_header X-Forwarded-For $remote_addr  one value, not a chain
        │
provider IDEN_FORWARDED_ALLOW_IPS=172.31.250.0/24      believe it, from this network
        │
        scope["client"] = ("203.0.113.9", 0)           what the limiter and the audit log read
```

**All three ranges must name the same network.** They are already consistent in the shipped files;
if you change the subnet in `docker-compose.tunnel.yml`, change `set_real_ip_from` in
`nginx/iden.conf` and `IDEN_FORWARDED_ALLOW_IPS` in `.env` with it.

Get it wrong in one direction and every caller looks like the tunnel:

- `TOKEN_PER_IP` stops being 120 requests a minute per caller and becomes 120 a minute for the whole
  deployment. At a few hundred active sessions that is an outage, and it looks like one.
- `RESET_PER_IP` becomes ten password resets an hour, globally.
- Every audit row records `172.31.250.x`, so the log can no longer answer *where did this
  administrator sign in from* — which is a large part of why it exists.

Get it wrong in the other direction — `IDEN_FORWARDED_ALLOW_IPS=*`, or a `set_real_ip_from` covering
the internet — and a header anyone can set decides who they are counted as, which is no limit at
all. **Never `*`.**

!!! info "Why `CF-Connecting-IP` can be trusted here"
    Ordinarily it cannot: anyone who can reach your origin directly can forge it. With a tunnel
    there is no inbound port, so `cloudflared` is the only way in and the header is exactly as
    trustworthy as Cloudflare.

    That guarantee is undone the moment something publishes a port to the provider on a public
    interface. The Compose files publish to `127.0.0.1` for this reason — Docker publishes through
    its own iptables chain, which a host firewall like ufw does not cover.

## Single sign-out needs egress

This is the one place IDEN is the HTTP *client*. When someone signs out, the provider POSTs a logout
token to each application's registered `backchannelLogoutUri` (OIDC Back-Channel Logout 1.0).

A tunnel is inbound only. That traffic goes out over the host's ordinary internet connection and
needs no configuration — but if you have locked down outbound egress on the assumption that the
tunnel carries everything, single sign-out stops working.

**If a relying party is on this same host**, register its *internal* address rather than its public
one:

```
backchannelLogoutUri = http://app:3001/auth/backchannel-logout
```

Otherwise the provider resolves the public name, goes out to Cloudflare, and comes back down the
tunnel to reach a container three hops away — two internet round trips against a five-second budget,
through whatever WAF rules apply to *that* hostname. Plaintext is fine: the logout token is a signed
JWT, and the hop never leaves the Docker network.

**If it is genuinely remote**, add a WAF skip rule on its hostname for its logout path, the same
shape as the one above.

Either way the failure is silent. A `403` from a challenge is a valid HTTP response, so nothing is
logged; the user is redirected to "you have been signed out" regardless, and the only trace is one
audit row:

```sql
select detail->>'uri' as uri, status_code, count(*), max(occurred_at)
from audit_events
where action = 'POST backchannel_logout'
group by 1, 2 order by 3 desc;
```

`200`/`204` delivered. `0` never arrived. Anything else is a sign-out that has been quietly failing.

## What is deliberately not exposed

| Path | Behaviour | Why |
|---|---|---|
| `/health`, `/health/*` | `403` at nginx | Says whether PostgreSQL and Redis are reachable. Point monitoring at the provider container directly. |
| `/docs`, `/redoc`, `/openapi.json` | `404` at nginx | The provider already withholds them when `IDEN_ENV=prod`. Not routing them means a deployment accidentally left in `dev` does not publish its admin API either. |
| Everything unlisted | `404` at nginx | So a frontend route added later cannot quietly be answered by the API. |

---

## Verify it

Work through this before anyone else is let in. Then work through [Before you expose
it](security-checklist.md), which covers the parts that are not specific to a tunnel.

### The routing

```bash
for p in / /auth/login /console/ /console/admin/users \
         /.well-known/openid-configuration /admin/users /health /docs; do
  printf '%-38s %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code}' https://iden.example.org$p)"
done
```

| Path | Expect | Meaning |
|---|---|---|
| `/` | `302` → `/console/` | The bare hostname opens the dashboard |
| `/auth/login` | `200` | The sign-in page is served, with its own assets |
| `/console/`, `/console/admin/users` | `200` | Deep links into the dashboard survive a refresh |
| `/.well-known/openid-configuration` | `200` | Discovery, advertising your hostname |
| `/admin/users` | `401` | The **API**, not the screen — refusing an unauthenticated caller |
| `/health` | `403` | Not public |
| `/docs` | `404` | Not public |

### The caller's address

Sign in through the browser, then:

```sql
select action, status_code, ip from audit_events order by occurred_at desc limit 5;
```

`ip` must be your own public address. If it shows `172.31.250.x`, the three settings do not agree.

### The negative test

The one people skip. From the host, bypass nginx and lie:

```bash
curl -s -o /dev/null -H 'X-Forwarded-For: 9.9.9.9' \
     -H 'CF-Connecting-IP: 9.9.9.9' http://127.0.0.1:8000/health/live
```

Nothing in the audit log should ever record `9.9.9.9`. If it does, `IDEN_FORWARDED_ALLOW_IPS` is
wider than the network nginx sits on.

---

## Running it day to day

Every command needs both files, which gets tedious. Set this once per shell, or in your profile:

```bash
export COMPOSE_FILE=deploy/docker-compose.yml:deploy/docker-compose.tunnel.yml
```

Then `docker compose ps`, `docker compose logs -f cloudflared` and the rest work unqualified. The
examples below spell the flags out, so they work either way.

| To | Run |
|---|---|
| See what is up | `docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.tunnel.yml ps` |
| Follow the tunnel | `... logs -f cloudflared` |
| Follow the application | `... logs -f provider` |
| Apply a change to `deploy/.env` | `... up -d` — **not `restart`** |
| Apply a change to `nginx/iden.conf` | `... restart nginx` |
| Deploy a new version | `git pull && ... up -d --build` |

!!! warning "`restart` does not re-read `deploy/.env`"
    Compose fixes a container's environment when it is **created**. `restart` starts the same
    container with the same environment, so a changed hostname, branding or trusted network appears
    to have no effect. `up -d` notices the difference and recreates what needs it.

    The frontends are the usual casualty, because they write `/config.js` from their environment at
    start-up. After changing `IDEN_ISSUER` or the branding:

    ```bash
    docker compose -f deploy/docker-compose.yml \
                   -f deploy/docker-compose.tunnel.yml up -d auth-ui dashboard

    curl -s https://iden.example.org/console/config.js
    ```

One more worth knowing: nginx resolves its upstreams **once, at start-up**. Recreate `provider`,
`auth-ui` or `dashboard` on their own and they come back on new addresses that nginx does not know,
which presents as `502` from a stack where everything is running. `restart nginx` fixes it, and
bringing the whole stack up together never hits it because nginx starts last.

---

## When something is wrong

??? failure "`ERR_TOO_MANY_REDIRECTS` in the browser"
    Something in front of nginx is redirecting HTTP to HTTPS. `cloudflared` always speaks plain HTTP
    to the origin, so it follows the redirect back out to Cloudflare and in again, forever.

    Check that `deploy/nginx/iden.conf` has no `return 301 https://...` and no `listen 443` — the
    shipped file has neither. Then check that the tunnel's public hostname points at **HTTP**
    `nginx:80`, not HTTPS.

??? failure "`502 Bad Gateway` from nginx, but the containers are running"
    nginx resolves upstream hostnames once, at startup. Recreate `provider`, `auth-ui` or
    `dashboard` on their own and they come back with new addresses that nginx does not know about.

    ```bash
    docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.tunnel.yml restart nginx
    ```

    Bringing the whole stack up together does not hit this, because nginx starts last.

??? failure "The sign-in page loads blank, with 404s for `/assets/...` in the console"
    A frontend was built without its Vite `base`, so its `index.html` is asking for the origin root
    instead of `/auth/` or `/console/`. Rebuild:

    ```bash
    docker compose -f deploy/docker-compose.yml build --no-cache auth-ui dashboard
    ```

??? failure "Sign-in loops, and the browser console shows nothing useful"
    Almost always one of four values not naming the same origin: `IDEN_ISSUER`,
    `IDEN_AUTH_UI_BASE_URL`, the `dashboard` client's `redirectUris`, and the `IDEN_ISSUER` the
    frontends were given. All are compared exactly.

    Check what the frontend actually received — it is served, not built in:

    ```bash
    curl -s https://iden.example.org/console/config.js
    ```

    If **Always Use HTTPS** is off, this also happens to anyone who arrives over `http://`: the
    `Secure` cookie is set and then never sent back.

??? failure "A machine client gets HTML back from `/oauth2/token`"
    Cloudflare challenged it. The WAF skip rule is missing, or does not cover the hostname. See
    [Let the protocol through the WAF](#let-the-protocol-through-the-waf).

??? failure "Everyone starts getting `429` at once"
    The three address settings do not agree, so every caller shares one bucket. See [Who the caller
    is](#who-the-caller-is). Confirm with the `ip` column of the audit log.

??? failure "`required variable CLOUDFLARE_TUNNEL_TOKEN is missing a value`"
    `deploy/.env` does not exist or does not sit beside `docker-compose.yml`. Compose reads it from
    the directory of the *first* `-f` file.

??? failure "Profile photos 404, or upload fails with an HTML error page"
    `/media/*` must be routed to the provider, and `/entity/profile/photo` needs
    `client_max_body_size` above `IDEN_AVATAR_MAX_BYTES` — nginx's 1 MB default refuses a 3 MB photo
    before IDEN's own check runs. Both are in the shipped `iden.conf.example`; a hand-written config
    is the usual cause.
