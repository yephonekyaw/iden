# Token claims

## Access token

Addressed to an API. Your resource server validates it offline and reads it.

The JOSE header carries **`typ: at+jwt`** (RFC 9068 Section 2.1). Check it. It is what distinguishes an
access token from an ID token by kind rather than by which claims each happens to have — every token
IDEN signs says what it is, and every endpoint says what it accepts.

| Claim | Always | Meaning |
|---|---|---|
| `iss` | :material-check-circle-outline: | The issuer. Must match your configured IDEN URL. |
| `sub` | :material-check-circle-outline: | Who. A user id, or a client id for a machine client. |
| `aud` | :material-check-circle-outline: | The audience URIs this token is for. **Check this.** |
| `client_id` | :material-check-circle-outline: | Which application obtained it. |
| `scope` | :material-check-circle-outline: | Space-delimited permissions. |
| `jti` | :material-check-circle-outline: | Unique id. Used by the denylist. |
| `iat`, `exp` | :material-check-circle-outline: | Issued at, expires at. |
| `acr` | user flows | Assurance level — see [Assurance](../concepts/assurance.md). |
| `amr` | user flows | Methods used: `pwd`, `otp`, `face`, `mfa`. |
| `auth_time` | user flows | When the person authenticated. Needed to demand a *recent* sign-in. |

Absent for client credentials: `acr`, `amr`, `auth_time`. No person authenticated, so there is
nothing to report.

## ID token

Addressed to the **application**, describing the sign-in event. Never send it to an API — it carries
`typ: JWT`, and IDEN's protected resources refuse anything that is not `at+jwt`.

| Claim | Always | Meaning |
|---|---|---|
| `iss`, `sub`, `iat`, `exp` | :material-check-circle-outline: | As above. |
| `aud` | :material-check-circle-outline: | Your `client_id`. |
| `auth_time` | :material-check-circle-outline: | When they authenticated — not when this token was minted. On a second application in an SSO session those differ. |
| `acr`, `amr` | :material-check-circle-outline: | How strongly, and by what. |
| `sid` | :material-check-circle-outline: | Names the session. A **hash** of the session id, never the cookie. Store it for [single sign-out](../guides/single-sign-out.md). |
| `nonce` | when sent | Echoes your authorization request. Check it. |
| `name`, `preferred_username` | `profile` | — |
| `picture` | `profile` | Where the profile photo is served from, or `null`. Public, and safe to cache forever — the URL changes whenever the photo does. |
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

The header carries `typ: logout+jwt`.

**No `nonce`, ever.** Verify all three facts. Together they stop a captured logout token being
replayed as proof that someone just authenticated.

## Refresh token

Not a JWT. An opaque random string, meaningless outside IDEN, stored only as a hash.

Issued only when the **`offline_access`** scope was granted and the client allows the
`refresh_token` grant (OIDC Core Section 11).
