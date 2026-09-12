import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { config } from "./config.js";

/**
 * Offline validation, which is the whole job.
 *
 * This service never calls IDEN on the request path. It fetches the public
 * signing keys once, caches them, and from then on a door opens or does not
 * open based on arithmetic over a token — no network hop, no shared database,
 * no coupling to whether the identity provider happens to be up.
 *
 * The cost of that is the thing to be honest about: a revoked permission keeps
 * working until the token expires, ten minutes by default. `POST /oauth2/introspect`
 * would close that window at the price of a round trip per request, which is
 * the exact cost offline validation exists to avoid. For a door, ten minutes is
 * the right trade. For a payroll transfer it might not be.
 */

export interface AccessClaims extends JWTPayload {
  scope?: string;
  client_id?: string;
  acr?: string;
  amr?: string[];
  auth_time?: number;
}

/**
 * `createRemoteJWKSet` handles the caching and the refetch-on-unknown-`kid`
 * that key rotation depends on, so there is nothing to schedule here. Built
 * lazily because the URL comes from discovery.
 */
let keys: ReturnType<typeof createRemoteJWKSet> | null = null;
let metadata: { issuer: string; jwks_uri: string } | null = null;

export async function discover(): Promise<{ issuer: string; jwks_uri: string }> {
  if (metadata) return metadata;

  const response = await fetch(`${config.issuer}/.well-known/openid-configuration`);
  if (!response.ok) {
    throw new Error(
      `Could not reach IDEN at ${config.issuer} (${response.status}). Is the provider running?`,
    );
  }
  const found = (await response.json()) as { issuer: string; jwks_uri: string };

  // The issuer in the document must be the one we asked, or we are reading
  // somebody else's metadata — the redirector's, say.
  if (found.issuer !== config.issuer) {
    throw new Error(
      `Discovery at ${config.issuer} reports its issuer as ${found.issuer}. They must match.`,
    );
  }

  keys = createRemoteJWKSet(new URL(found.jwks_uri));
  metadata = found;
  return found;
}

/** A refusal that carries the status and the RFC 6750 error code to send back. */
export class Refusal extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    /** Extra `WWW-Authenticate` parameters, for the step-up challenge. */
    readonly params: Record<string, string | number> = {},
  ) {
    super(message);
  }
}

const ACCESS_TOKEN_TYP = "at+jwt";

/**
 * Verify one access token.
 *
 * Four checks, and the one people skip is `audience`. Without it this service
 * accepts **any** valid IDEN token — including one issued to a different
 * service entirely, which its holder may possess perfectly legitimately.
 * Checking the signature proves IDEN wrote the token. It does not prove IDEN
 * wrote it *for this door*.
 */
export async function verifyAccessToken(raw: string): Promise<AccessClaims> {
  await discover();
  if (!keys) throw new Error("Discovery has not run yet.");

  let payload: JWTPayload;
  let header: { typ?: string };

  try {
    const result = await jwtVerify(raw, keys, {
      issuer: config.issuer,
      audience: config.audience,
    });
    payload = result.payload;
    header = result.protectedHeader;
  } catch (problem) {
    // Everything here is a 401: expired, wrong audience, bad signature, not a
    // JWT at all. The client cannot tell them apart and should not — the answer
    // to all of them is the same, go and authenticate again.
    throw new Refusal(
      401,
      "invalid_token",
      problem instanceof Error ? problem.message : String(problem),
    );
  }

  // RFC 9068 Section 2.1. This is what distinguishes an access token from an ID token
  // by kind rather than by guessing from which claims each happens to carry —
  // and an ID token is exactly what a confused client will send here.
  if (header.typ !== ACCESS_TOKEN_TYP) {
    throw new Refusal(
      401,
      "invalid_token",
      `Expected a token of type ${ACCESS_TOKEN_TYP}, got ${header.typ ?? "none"}. ` +
        `An ID token is not an access token.`,
    );
  }

  return payload as AccessClaims;
}

export const scopesOf = (claims: AccessClaims): string[] =>
  (claims.scope ?? "").split(" ").filter(Boolean);
