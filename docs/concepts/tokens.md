# Tokens

IDEN issues three kinds, and confusing them is the most common integration mistake in OAuth. Each has
exactly one job.

| Token | Answers | Who reads it | Lifetime |
|---|---|---|---|
| **Access token** | *May the bearer do this?* | Your APIs | 10 minutes |
| **ID token** | *Who signed in, and how?* | The application that asked | 10 minutes |
| **Refresh token** | *May I have another access token?* | IDEN only | 30 days, rotating |

## Access tokens

A signed JWT. Your API validates it offline against IDEN's public keys and reads two fields:

- **`aud`** — is this token addressed to *me*? If not, reject it, no matter how valid it looks.
- **`scope`** — does it carry the permission this endpoint needs?

That is the entire contract. Your API never looks up a user, never calls IDEN on the request path,
and never needs a database of its own to answer "may this happen".

!!! danger "Never send an access token to a browser as proof of identity"
    An access token says what may be done, not who is doing it. It is addressed to an API, and only
    that API should validate it. To learn who signed in, read the ID token.

## ID tokens

Also a signed JWT, but addressed to the **application** rather than an API, and describing the
*sign-in event*: who, when, by what method, in which session.

An application reads it once, at sign-in, to learn who the person is — then forgets it. It is not a
credential and must never be sent to an API as one.

See [Token claims](../reference/claims.md) for every field.

## Refresh tokens

Opaque — a random string, meaningless outside IDEN, stored only as a hash. Its job is to obtain a new
access token when the old one expires, without dragging the person through a sign-in again.

**Every use rotates it.** You hand in a refresh token, you get a new one, and the old one dies. That
is what makes theft detectable: if a token that has already been spent shows up again, two parties
hold it, and only one of them can be legitimate. IDEN revokes the entire lineage.

### The honest double-use problem

Rotation taken literally signs people out at random. Two browser tabs refreshing in the same second,
or one request that timed out and got retried, present the same token twice for entirely innocent
reasons.

IDEN handles this in two parts:

- For **30 seconds** after a token is spent, presenting it again returns *the same* tokens it
  produced the first time, rather than rotating again. Only the client it was issued to can collect
  that replay.
- The exchange runs under a short lock, so two genuinely simultaneous requests are serialised — the
  second waits and finds the first one's answer.

The cost: inside that window, a thief gets the same tokens the victim just got instead of tripping
detection. But then both hold the same next token, so the following exchange collides *outside* the
window and the family is revoked after all. Detection is delayed by one rotation, not removed.

Set `IDEN_REFRESH_GRACE_PERIOD=0` for strict single use, at the price of signing people out over a
double-click.

## Revoking a token early

Access tokens are self-contained, which is what makes them cheap to validate — and means IDEN cannot
recall one that is already out there. Three answers, in order of preference:

1. **Wait.** Ten minutes is short. For most changes this is the right answer.
2. **Revoke the refresh token** (`POST /oauth2/revoke`, or signing out). Nothing new can be minted;
   what exists expires.
3. **The denylist.** Revoking an access token adds its `jti` to a Redis denylist until it would have
   expired anyway. IDEN's own modules check it. External APIs validating offline will not — that is
   the trade they accepted in exchange for not calling IDEN on every request.

## Why only two flows

IDEN implements **authorization code with PKCE** and **client credentials**. Nothing else.

| Flow | For | Why not others |
|---|---|---|
| Authorization code + PKCE | Anything with a human in front of it | — |
| Client credentials | A backend acting as itself, no person involved | — |
| ~~Implicit~~ | — | Returns tokens in the URL, where they leak into history and logs. Removed in OAuth 2.1. |
| ~~Password grant~~ | — | Requires the application to handle the password, which is the thing an identity provider exists to prevent. |

**PKCE is mandatory**, for confidential clients as well as public ones. One code path, no downgrade
to argue about.
