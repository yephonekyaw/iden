# Before you expose it

Work through this before anyone outside your own machine can reach the deployment.

## Must be true

- [ ] **TLS everywhere**, and `IDEN_ENV=prod` so the session cookie is `Secure`.
- [ ] **`IDEN_ISSUER` is the public HTTPS URL.** It goes into every token and clients validate
      against it.
- [ ] **Signing keys are not in the image**, are mounted read-only, and are backed up separately.
- [ ] **The bootstrap administrator's password has been changed** from the one the seed printed.
- [ ] **`IDEN_FORWARDED_ALLOW_IPS` names the proxy's network, and is not `*`.** It decides whose
      claim about the caller's address is believed. Empty behind a proxy makes every per-address
      rate limit a deployment-wide one and writes the proxy into every audit row; `*` makes both
      forgeable by anyone. Verify it by signing in and reading the `ip` column of the audit log —
      it must be your own address.
- [ ] **A reverse proxy is rate-limiting by volume**, and its limiter keys on the corrected address
      too. An uncorrected proxy limits itself as a single client, which is the whole internet in one
      bucket.
- [ ] **`IDEN_ALLOWED_ADMIN_ORIGINS` lists only origins you control.** It permits credentialed
      cross-origin requests. On a single-origin deployment it should be empty — there is no
      cross-origin request to allow.
- [ ] **`/docs`, `/redoc` and `/openapi.json` do not answer.** `IDEN_ENV=prod` withholds them; check
      rather than assume, because they are the complete shape of the admin API.
- [ ] **No service is published on a public interface.** Bind to loopback or to nothing. Docker
      publishes ports through its own iptables chain, which a host firewall such as ufw does not
      cover — so a `ports:` entry can be reachable from the internet on a host you believe is
      closed. It also leaves a path to the provider that bypasses the proxy, and anything reaching
      it that way can forge `X-Forwarded-For`.
- [ ] **Database and Redis are not reachable from outside** the deployment network.
- [ ] **The proxy does not strip or rewrite IDEN's response headers.** The application sets
      `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, and — when
      `IDEN_ENV=prod` — `Strict-Transport-Security`. A proxy that adds its own copy of any of these
      leaves two policies to disagree with each other.
- [ ] **Backups exist and have been restored at least once.** An untested backup is a hope — see
      [Backup and restore](backup-and-restore.md#testing-it), which restores into a throwaway
      Compose project so the test cannot touch what you are running.

## Should be true

- [ ] `skipConsent` is set only on applications your organization owns.
- [ ] Every client's `redirectUris` are exact — no unused entries left from testing.
- [ ] Machine clients hold the narrowest permissions that let them work.
- [ ] `backchannelLogoutUri` is registered for every application with its own session, so signing out
      means something.
- [ ] Someone reads `GET /admin/audit` on a schedule. A log nobody reads is a log nobody reads.
- [ ] `scripts/cleanup.py` is scheduled, so expired codes and tokens do not accumulate forever.

## Known gaps

Honest rather than reassuring. Each is tracked on the [roadmap](../roadmap.md).

| Gap | Consequence |
|---|---|
| **An audit row is written just after the change** | If the database becomes unreachable in between, the change stands and the record is lost. Logged loudly, but lost. |
| **`admin:*` is all-or-nothing** | There is no "administrator who cannot create administrators". Anyone with `admin:users:write` can grant themselves anything. |
| **Biometrics are unbuilt** | The permissions exist; the module does not. `IDEN_BIOMETRIC_ENABLED` should stay `false`. |

## Not gaps, though they look like it

**Access tokens survive revocation for up to ten minutes.** They are self-contained by design — that
is what lets your APIs validate them without calling IDEN. The short lifetime is the trade. For
immediate revocation, use introspection on the endpoints where it earns the round trip.

**Signing out on a laptop leaves a phone signed in.** Revocation is per session, deliberately. To end
everything, an administrator can revoke all sessions for a user; changing a password does it
automatically.

**You cannot remove the last administrator.** Any change that would leave no active user holding
`admin:users:write` is refused with `409` — deactivating them, deleting them, stripping their roles,
emptying the role or group that granted it. It is the only permission whose last holder is protected,
because it is the only one that can restore all the others; without it the way back in is a
hand-edited database.

**A refresh token can be presented twice within 30 seconds.** That is the grace window that stops
honest double-refreshes signing people out. Detection is delayed by one rotation, never removed. Set
`IDEN_REFRESH_GRACE_PERIOD=0` to opt out.
