import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { config } from "./config";

/**
 * The protocol, by hand — for the same reason `../../single-sign-out` does it.
 *
 * A real application should use a library, and the `nextjs-nextauth` sample
 * shows exactly that working against IDEN with nine lines of configuration.
 * This one is written out because the demo turns on parameters most libraries
 * either bury or do not expose at all: `acr_values` and `max_age` on the way
 * out, and a refresh you can trigger on demand rather than when a token happens
 * to expire.
 */

export interface Metadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  end_session_endpoint?: string;
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

  const response = await fetch(`${config.issuer}/.well-known/openid-configuration`, {
    cache: "no-store",
  });
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

/**
 * Build the authorization request.
 *
 * `acrValues` and `maxAge` are the step-up parameters, and they are the reason
 * this file exists. When the door controller refuses with
 * `insufficient_user_authentication`, the panel copies the parameters out of
 * that challenge and puts them here — the refusal is an instruction, and this
 * is the code that follows it.
 */
export async function authorizeUrl(input: {
  state: string;
  nonce: string;
  challenge: string;
  acrValues?: string;
  maxAge?: number;
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

  if (input.acrValues) query.set("acr_values", input.acrValues);
  // `0` is meaningful — it says authenticate now — so this tests for undefined
  // rather than falsiness.
  if (input.maxAge !== undefined) query.set("max_age", String(input.maxAge));

  return `${meta.authorization_endpoint}?${query.toString()}`;
}

async function tokenRequest(body: URLSearchParams): Promise<Tokens> {
  const meta = await metadata();

  // HTTP Basic rather than the form body: it keeps the secret out of anything
  // that logs request bodies, and IDEN gives it precedence.
  const basic = Buffer.from(
    `${encodeURIComponent(config.clientId)}:${encodeURIComponent(config.clientSecret)}`,
  ).toString("base64");

  const response = await fetch(meta.token_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body,
    cache: "no-store",
  });

  const payload = (await response.json()) as Tokens & {
    error?: string;
    error_description?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error_description ?? payload.error ?? "Token request failed.");
  }
  return payload;
}

export const exchange = (input: { code: string; verifier: string }): Promise<Tokens> =>
  tokenRequest(
    new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: config.redirectUri,
      client_id: config.clientId,
      code_verifier: input.verifier,
    }),
  );

/**
 * Trade a refresh token for a new access token.
 *
 * IDEN re-resolves permissions here rather than copying the old set forward, so
 * a revoked role stops being issued at the next refresh. What it will not do is
 * *widen*: the original grant is the ceiling for every rotation of it, because
 * RFC 6749 Section 6 forbids a refresh from returning more than was granted in
 * the first place. Newly gained permissions arrive through `authorizeUrl`.
 *
 * The refresh token itself rotates — the response carries a new one and the old
 * stops working, so reuse is detectable.
 */
export const refresh = (refreshToken: string): Promise<Tokens> =>
  tokenRequest(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: config.clientId,
    }),
  );

export async function verifyIdToken(idToken: string, expectedNonce?: string): Promise<JWTPayload> {
  await metadata();
  if (!jwks) throw new Error("Discovery has not run yet.");

  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: config.issuer,
    audience: config.clientId,
  });
  if (expectedNonce && payload.nonce !== expectedNonce) {
    throw new Error("The ID token's nonce does not match the request.");
  }
  return payload;
}

/**
 * Read an access token without verifying it.
 *
 * Legitimate **only** because this is the client that just received the token
 * over TLS from the endpoint it authenticated to, and it wants to display
 * `scope` and `auth_time` rather than to trust them. The door controller, which
 * receives the same token from somebody else, verifies properly — see
 * `../../api/src/tokens.ts`. Decoding is not verifying.
 */
export function peek(token: string): JWTPayload {
  const part = token.split(".")[1];
  if (!part) return {};
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString()) as JWTPayload;
  } catch {
    return {};
  }
}

export async function endSessionUrl(idToken?: string): Promise<string | null> {
  const meta = await metadata();
  if (!meta.end_session_endpoint) return null;

  const url = new URL(meta.end_session_endpoint);
  if (idToken) url.searchParams.set("id_token_hint", idToken);
  url.searchParams.set("post_logout_redirect_uri", config.postLogoutRedirectUri);
  return url.toString();
}
