# Roadmap

The full build plan and every open issue live in
[`provider/PLAN.md`](https://github.com/yephonekyaw/iden/blob/main/provider/PLAN.md). This is
the summary.

## Phases

| Phase | Focus | Status |
|---|---|---|
| 0 | Foundation — config, database, models, security, seed | ✅ Done |
| 1 | AuthZ core — discovery, JWKS, authorize + PKCE, token, userinfo, sign-in | ✅ Done |
| 2 | Admin — users, groups, roles, APIs, scopes, clients | ✅ Done |
| 3 | SSO — `prompt`, `max_age`, `sid`, single sign-out | ✅ Done |
| 4 | Self-service — profile, org-defined fields, credentials, TOTP, recovery | ✅ Done |
| 5 | Biometrics — enrollment, verification, liveness | On hold |
| 6 | Hardening — Docker, TLS, security headers, coverage review | Planned |
| 7 | Front ends — the sign-in UI and the dashboard | Planned |
| 8 | Kiosk — device registration and enrollment | Planned |

Migrations, the audit log, and rate limiting were all pulled forward out of Phase 6. Each was
scheduled late and each got more expensive with every phase that passed — history not written is
lost, and an unmigrated schema needs manual surgery.

## Open issues

| | Issue | Consequence |
|---|---|---|
| **KI-7 / KI-8** | `admin:*` is all-or-nothing | No "administrator who cannot create administrators". Anyone with `admin:users:write` can grant themselves anything. |
| **KI-9 / KI-10 / KI-11** | Assorted hardening | Security headers, error-shape edge cases, operational endpoints. |
| **KI-14** | Expired codes and tokens are never deleted | Two tables grow without bound. |
| **KI-17** | An audit row is not atomic with its change | Written just after; a database failure in between loses the record. Logged loudly. |

## Federation

*Sign in with Google, or with a campus SAML server* — deliberately out of scope, and worth explaining
rather than leaving implied.

The protocol is the easy part. The hard part is **account linking**: matching an incoming federated
identity to an existing local account by email address is the obvious shortcut and a well-known
account takeover, because it trusts the upstream provider's word about an address it may not own.

The safe rules — link only on a verified address from a provider trusted for that domain, or require
an explicit link from an already signed-in session — are what make it a phase of work rather than an
afternoon's.

## What is deliberately not planned

| | Why |
|---|---|
| **Multi-tenancy** | The single-organization decision is what removes an entire dimension of complexity from every model and query. Run two deployments. |
| **SAML as an identity provider** | A large amount of XML signing for a protocol IDEN would otherwise never touch. Only worth it if a system you must integrate with demands it. |
| **Account deletion by the account holder** | In a single-organization deployment the organization owns the identity. A deactivation *request* is the affordance to build if one is wanted. |
| **Implicit and password grants** | Discouraged by OAuth 2.1 and unnecessary given the two flows that exist. |
