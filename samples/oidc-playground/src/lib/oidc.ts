/**
 * OpenID Connect, by hand.
 *
 * There are good OIDC client libraries and a real application should use one.
 * This is not a real application — it is a window onto the protocol, and a
 * library's job is to hide exactly what this exists to show. Everything here is
 * `fetch` and `crypto.subtle`, so every request the playground makes is one you
 * can read, copy, and send yourself.
 */

export interface Discovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  revocation_endpoint?: string;
  introspection_endpoint?: string;
  end_session_endpoint?: string;
  scopes_supported?: string[];
  code_challenge_methods_supported?: string[];
  acr_values_supported?: string[];
  prompt_values_supported?: string[];
  authorization_response_iss_parameter_supported?: boolean;
  [key: string]: unknown;
}

export async function discover(issuer: string): Promise<Discovery> {
  const base = issuer.replace(/\/$/, "");
  const response = await fetch(`${base}/.well-known/openid-configuration`);
  if (!response.ok) {
    throw new Error(`Discovery failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as Discovery;
}

// --------------------------------------------------------------------------
// PKCE — RFC 7636
// --------------------------------------------------------------------------

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A high-entropy secret the client keeps until the token exchange. */
export function randomVerifier(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

/**
 * S256: BASE64URL(SHA256(ASCII(verifier))), unpadded.
 *
 * IDEN requires S256 from every client, public and confidential. `plain` offers
 * no protection against anyone who can read the authorization request, which is
 * the attack PKCE exists for.
 */
export async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(digest);
}

export function randomState(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(16)));
}

// --------------------------------------------------------------------------
// Requests
// --------------------------------------------------------------------------

export interface AuthorizeParams {
  client_id: string;
  redirect_uri: string;
  response_type: string;
  scope: string;
  state?: string;
  nonce?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  prompt?: string;
  acr_values?: string;
  max_age?: string;
  login_hint?: string;
  id_token_hint?: string;
}

/** The authorization URL, with empty parameters dropped rather than sent blank. */
export function authorizeUrl(endpoint: string, params: AuthorizeParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, value);
  }
  return `${endpoint}?${query.toString()}`;
}

export interface TokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  refresh_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
  [key: string]: unknown;
}

/** What went over the wire, so the playground can show it rather than describe it. */
export interface Exchange {
  request: { url: string; method: string; body: Record<string, string> };
  status: number;
  body: TokenResponse;
}

async function form(
  url: string,
  body: Record<string, string>,
  headers: Record<string, string> = {},
): Promise<Exchange> {
  const encoded = new URLSearchParams(body);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", ...headers },
    body: encoded,
  });

  let parsed: TokenResponse;
  const text = await response.text();
  try {
    parsed = text ? (JSON.parse(text) as TokenResponse) : {};
  } catch {
    parsed = { error: "non_json_response", error_description: text.slice(0, 400) };
  }

  return { request: { url, method: "POST", body }, status: response.status, body: parsed };
}

export function exchangeCode(input: {
  tokenEndpoint: string;
  code: string;
  redirectUri: string;
  clientId: string;
  codeVerifier: string;
  clientSecret?: string;
}): Promise<Exchange> {
  const body: Record<string, string> = {
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
    client_id: input.clientId,
    code_verifier: input.codeVerifier,
  };
  if (input.clientSecret) body.client_secret = input.clientSecret;
  return form(input.tokenEndpoint, body);
}

export function refresh(input: {
  tokenEndpoint: string;
  refreshToken: string;
  clientId: string;
  scope?: string;
  clientSecret?: string;
}): Promise<Exchange> {
  const body: Record<string, string> = {
    grant_type: "refresh_token",
    refresh_token: input.refreshToken,
    client_id: input.clientId,
  };
  if (input.scope) body.scope = input.scope;
  if (input.clientSecret) body.client_secret = input.clientSecret;
  return form(input.tokenEndpoint, body);
}

export function revoke(input: {
  endpoint: string;
  token: string;
  hint?: string;
  clientId: string;
  clientSecret?: string;
}): Promise<Exchange> {
  const body: Record<string, string> = { token: input.token, client_id: input.clientId };
  if (input.hint) body.token_type_hint = input.hint;
  if (input.clientSecret) body.client_secret = input.clientSecret;
  return form(input.endpoint, body);
}

export function introspect(input: {
  endpoint: string;
  token: string;
  hint?: string;
  clientId: string;
  clientSecret: string;
}): Promise<Exchange> {
  const body: Record<string, string> = {
    token: input.token,
    client_id: input.clientId,
    client_secret: input.clientSecret,
  };
  if (input.hint) body.token_type_hint = input.hint;
  return form(input.endpoint, body);
}

export interface Called {
  request: { url: string; method: string; headers?: Record<string, string> };
  status: number;
  body: unknown;
}

/**
 * OIDC Core Section 5.3.1 defines both methods. `POST` also accepts the token as a
 * form field (RFC 6750 Section 2.2), which is what several relying-party libraries
 * send by default — so the playground can send it either way.
 */
export async function userinfo(input: {
  endpoint: string;
  accessToken: string;
  method: "GET" | "POST";
  inBody?: boolean;
}): Promise<Called> {
  const useBody = input.method === "POST" && input.inBody;
  const headers: Record<string, string> = useBody
    ? { "Content-Type": "application/x-www-form-urlencoded" }
    : { Authorization: `Bearer ${input.accessToken}` };

  const response = await fetch(input.endpoint, {
    method: input.method,
    headers,
    body: useBody ? new URLSearchParams({ access_token: input.accessToken }) : undefined,
  });

  const text = await response.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return {
    request: {
      url: input.endpoint,
      method: input.method,
      headers: useBody ? { "(token in body)": "access_token=…" } : { Authorization: "Bearer …" },
    },
    status: response.status,
    body,
  };
}

// --------------------------------------------------------------------------
// Reading tokens
// --------------------------------------------------------------------------

export interface DecodedJwt {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
}

function decodeSegment(segment: string): Record<string, unknown> {
  const padded = segment.replace(/-/g, "+").replace(/_/g, "/");
  const json = atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), "="));
  return JSON.parse(
    decodeURIComponent(
      json
        .split("")
        .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join(""),
    ),
  ) as Record<string, unknown>;
}

/** Decoding is not verifying. Anyone can read a JWT; `verify` is the other half. */
export function decodeJwt(token: string): DecodedJwt | null {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[0] || !parts[1]) return null;
  try {
    return {
      header: decodeSegment(parts[0]),
      payload: decodeSegment(parts[1]),
      signature: parts[2] ?? "",
    };
  } catch {
    return null;
  }
}

interface Jwk extends JsonWebKey {
  kid?: string;
}

/**
 * Verify a signature against the provider's published keys.
 *
 * This is what a resource server does on every request, and doing it here is
 * the point: no call back to the provider, just the JWKS it published and the
 * token in hand.
 */
export async function verify(
  token: string,
  jwksUri: string,
): Promise<{ ok: true; kid: string } | { ok: false; reason: string }> {
  const decoded = decodeJwt(token);
  if (!decoded) return { ok: false, reason: "Not a JWT." };

  const kid = decoded.header.kid;
  if (typeof kid !== "string") return { ok: false, reason: "No `kid` in the header." };

  const response = await fetch(jwksUri);
  if (!response.ok) return { ok: false, reason: `JWKS fetch failed: ${response.status}` };
  const { keys } = (await response.json()) as { keys: Jwk[] };

  const jwk = keys.find((key) => key.kid === kid);
  if (!jwk) return { ok: false, reason: `No key published for kid ${kid}.` };

  const algorithm = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" };
  const key = await crypto.subtle.importKey("jwk", jwk, algorithm, false, ["verify"]);

  const [header, payload, signature] = token.split(".");
  const signed = new TextEncoder().encode(`${header}.${payload}`);
  const raw = Uint8Array.from(atob((signature ?? "").replace(/-/g, "+").replace(/_/g, "/")), (c) =>
    c.charCodeAt(0),
  );

  const valid = await crypto.subtle.verify(algorithm, key, raw, signed);
  return valid ? { ok: true, kid } : { ok: false, reason: "Signature does not match." };
}

/** Seconds until `exp`, negative once it has passed. */
export function secondsUntil(exp: unknown): number | null {
  return typeof exp === "number" ? Math.round(exp - Date.now() / 1000) : null;
}
