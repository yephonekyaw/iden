import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { config } from "./config.js";

/**
 * The protocol, by hand.
 *
 * A real application should use an OIDC library — the sibling sample in
 * `../nextjs-nextauth` does exactly that. This one is hand-written for one
 * reason: **back-channel logout**, the thing this demo exists to show, is the
 * part most libraries do not implement. Writing the rest by hand keeps the
 * receiving end legible next to it.
 */

export interface Metadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  end_session_endpoint?: string;
  [key: string]: unknown;
}

export interface Tokens {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

let cached: Metadata | null = null;
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

export async function metadata(): Promise<Metadata> {
  if (cached) return cached;

  const response = await fetch(`${config.issuer}/.well-known/openid-configuration`);
  if (!response.ok) {
    throw new Error(
      `Could not reach IDEN at ${config.issuer} (${response.status}). Is the provider running?`,
    );
  }
  cached = (await response.json()) as Metadata;
  jwks = createRemoteJWKSet(new URL(cached.jwks_uri));
  return cached;
}

const base64url = (buffer: Buffer) => buffer.toString("base64url");

export function pkce(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export const random = (): string => base64url(randomBytes(16));

export async function authorizeUrl(input: {
  state: string;
  nonce: string;
  challenge: string;
  prompt?: string;
}): Promise<string> {
  const meta = await metadata();
  const query = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: config.scope,
    state: input.state,
    nonce: input.nonce,
    code_challenge: input.challenge,
    code_challenge_method: "S256",
  });
  if (input.prompt) query.set("prompt", input.prompt);
  return `${meta.authorization_endpoint}?${query.toString()}`;
}

export async function exchange(input: { code: string; verifier: string }): Promise<Tokens> {
  const meta = await metadata();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    code_verifier: input.verifier,
  });
  if (config.clientSecret) body.set("client_secret", config.clientSecret);

  const response = await fetch(meta.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = (await response.json()) as Tokens & {
    error?: string;
    error_description?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error_description ?? payload.error ?? "Token exchange failed.");
  }
  return payload;
}

function keys() {
  if (!jwks) throw new Error("Discovery has not run yet.");
  return jwks;
}

/** Verify an ID token — signature, issuer, audience, and the nonce we sent. */
export async function verifyIdToken(
  idToken: string,
  expectedNonce?: string,
): Promise<JWTPayload> {
  await metadata();
  const { payload } = await jwtVerify(idToken, keys(), {
    issuer: config.issuer,
    audience: config.clientId,
  });
  if (expectedNonce && payload.nonce !== expectedNonce) {
    throw new Error("The ID token's nonce does not match the request.");
  }
  return payload;
}

const BACKCHANNEL_EVENT = "http://schemas.openid.net/event/backchannel-logout";

export interface LogoutClaims extends JWTPayload {
  sid?: string;
  events?: Record<string, unknown>;
}

/**
 * Verify a logout token — OIDC Back-Channel Logout 1.0 §2.6.
 *
 * The two checks easiest to skip are the two that matter. `events` is what
 * makes this a logout token rather than an ID token, and the **absence of
 * `nonce`** is what stops a captured logout token being replayed as proof that
 * somebody just signed in. A receiver that checks only the signature will
 * happily accept an ID token here and sign the wrong person out.
 */
export async function verifyLogoutToken(logoutToken: string): Promise<LogoutClaims> {
  await metadata();
  const { payload } = await jwtVerify(logoutToken, keys(), {
    issuer: config.issuer,
    audience: config.clientId,
  });
  const claims = payload as LogoutClaims;

  if (claims.nonce !== undefined) {
    throw new Error("A logout token must not carry a nonce.");
  }
  if (!claims.events || typeof claims.events !== "object") {
    throw new Error("No `events` claim: this is not a logout token.");
  }
  if (!(BACKCHANNEL_EVENT in claims.events)) {
    throw new Error("The `events` claim does not name the back-channel logout event.");
  }
  if (!claims.sid && !claims.sub) {
    throw new Error("A logout token must identify a session or a subject.");
  }

  return claims;
}

export async function endSessionUrl(idToken?: string): Promise<string | null> {
  const meta = await metadata();
  if (!meta.end_session_endpoint) return null;

  const url = new URL(meta.end_session_endpoint);
  if (idToken) url.searchParams.set("id_token_hint", idToken);
  url.searchParams.set("post_logout_redirect_uri", config.postLogoutRedirectUri);
  return url.toString();
}
