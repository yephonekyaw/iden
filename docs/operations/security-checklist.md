# Before you expose it

Work through this before anyone outside your own machine can reach the deployment.

## Must be true

- [ ] **TLS everywhere**, and `IDEN_ENV=prod` so the session cookie is `Secure`.
- [ ] **`IDEN_ISSUER` is the public HTTPS URL.** It goes into every token and clients validate
      against it.
- [ ] **Signing keys are not in the image**, are mounted read-only, and are backed up separately.
- [ ] **The bootstrap administrator's password has been changed** from the one the seed printed.
- [ ] **A reverse proxy is rate-limiting by volume.** IDEN's own limits are per account and per
      socket address; behind a proxy the second is the proxy.
- [ ] **`IDEN_ALLOWED_ADMIN_ORIGINS` lists only origins you control.** It permits credentialed
      cross-origin requests.
- [ ] **Database and Redis are not reachable from outside** the deployment network.
- [ ] **Backups exist and have been restored at least once.** An untested backup is a hope.

## Should be true

- [ ] `skipConsent` is set only on applications your organization owns.
- [ ] Every client's `redirectUris` are exact — no unused entries left from testing.
- [ ] Machine clients hold the narrowest permissions that let them work.
- [ ] `backchannelLogoutUri` is registered for every application with its own session, so signing out
      means something.
- [ ] Someone reads `GET /admin/audit` on a schedule. A log nobody reads is a log nobody reads.

## Known gaps

Honest rather than reassuring. Each is tracked on the [roadmap](../roadmap.md).

| Gap | Consequence |
|---|---|
| **No cleanup of expired codes and tokens** | Two tables grow without bound. Nothing breaks; the database gets larger forever. |
| **An audit row is written just after the change** | If the database becomes unreachable in between, the change stands and the record is lost. Logged loudly, but lost. |
| **No security headers middleware** | HSTS, `X-Content-Type-Options`, `Referrer-Policy` and frame-ancestors are not set by the application. Set them at the proxy. |
| **`admin:*` is all-or-nothing** | There is no "administrator who cannot create administrators". Anyone with `admin:users:write` can grant themselves anything. |
| **Biometrics are unbuilt** | The permissions exist; the module does not. `IDEN_BIOMETRIC_ENABLED` should stay `false`. |

## Not gaps, though they look like it

**Access tokens survive revocation for up to ten minutes.** They are self-contained by design — that
is what lets your APIs validate them without calling IDEN. The short lifetime is the trade. For
immediate revocation, use introspection on the endpoints where it earns the round trip.

**Signing out on a laptop leaves a phone signed in.** Revocation is per session, deliberately. To end
everything, an administrator can revoke all sessions for a user; changing a password does it
automatically.

**A refresh token can be presented twice within 30 seconds.** That is the grace window that stops
honest double-refreshes signing people out. Detection is delayed by one rotation, never removed. Set
`IDEN_REFRESH_GRACE_PERIOD=0` to opt out.
