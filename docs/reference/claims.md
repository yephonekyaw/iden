# Token claims

## Access token

Addressed to an API. Your resource server validates it offline and reads it.

| Claim | Always | Meaning |
|---|---|---|
| `iss` | ✅ | The issuer. Must match your configured IDEN URL. |
| `sub` | ✅ | Who. A user id, or a client id for a machine client. |
| `aud` | ✅ | The audience URIs this token is for. **Check this.** |
| `client_id` | ✅ | Which application obtained it. |
| `scope` | ✅ | Space-delimited permissions. |
| `jti` | ✅ | Unique id. Used by the denylist. |
| `iat`, `exp` | ✅ | Issued at, expires at. |
| `acr` | user flows | Assurance level — see [Assurance](../concepts/assurance.md). |
| `amr` | user flows | Methods used: `pwd`, `otp`, `face`, `mfa`. |
| `auth_time` | user flows | When the person authenticated. Needed to demand a *recent* sign-in. |

Absent for client credentials: `acr`, `amr`, `auth_time`. No person authenticated, so there is
nothing to report.

## ID token

Addressed to the **application**, describing the sign-in event. Never send it to an API.

| Claim | Always | Meaning |
|---|---|---|
| `iss`, `sub`, `iat`, `exp` | ✅ | As above. |
| `aud` | ✅ | Your `client_id`. |
| `auth_time` | ✅ | When they authenticated — not when this token was minted. On a second application in an SSO session those differ. |
| `acr`, `amr` | ✅ | How strongly, and by what. |
| `sid` | ✅ | Names the session. A **hash** of the session id, never the cookie. Store it for [single sign-out](../guides/single-sign-out.md). |
| `nonce` | when sent | Echoes your authorization request. Check it. |
| `name`, `preferred_username` | `profile` | — |
| `email`, `email_verified` | `email` | — |
| *your fields* | when mapped | Organization-defined fields released under their `claimScope`. |

## Logout token

Sent server-to-server when a session ends.

| Claim | Meaning |
|---|---|
| `iss`, `aud`, `iat`, `exp`, `jti` | As usual. |
| `sub` | Whose session ended. |
| `sid` | Which session. Match it against what you stored. |
| `events` | Contains `http://schemas.openid.net/event/backchannel-logout`. **This is what makes it a logout token.** |

**No `nonce`, ever.** Verify both facts. Together they stop a captured logout token being replayed as
proof that someone just authenticated.

## Refresh token

Not a JWT. An opaque random string, meaningless outside IDEN, stored only as a hash.
