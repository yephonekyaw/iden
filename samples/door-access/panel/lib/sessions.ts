import { randomUUID } from "node:crypto";
import type { JWTPayload } from "jose";
import { peek, type Tokens } from "./oidc";

/**
 * Sessions in a `Map`, which is wrong for production and right here.
 *
 * The point being made is about *where the tokens live*: in this process, never
 * in the browser. The cookie carries an opaque session id and nothing else, so
 * the access token — the thing that actually opens doors — is never in a place
 * the person holding the browser can read, copy, or replay against the door
 * controller directly.
 *
 * A real deployment swaps this for Redis and changes nothing else about that
 * argument. Restarting `next dev` loses every session, which is a fair price
 * for a demo with no dependencies.
 */

/** What the door controller said, last time it was asked. */
export interface Verdict {
  door: string;
  allowed: boolean;
  status: number;
  code: string;
  message: string;
  /**
   * Parsed out of `WWW-Authenticate`. When the refusal was about assurance
   * rather than permission, these are the parameters to send back through
   * `/authorize` — RFC 9470's round trip, in two fields.
   */
  acrValues?: string;
  maxAge?: number;
}

export interface Session {
  id: string;
  subject: string;
  name: string;
  email?: string;
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  /** What the *token* carries, which is not what was asked for. */
  scope: string[];
  acr?: string;
  amr: string[];
  authTime?: number;
  verdict?: Verdict;
}

const sessions = new Map<string, Session>();

/**
 * The half of a sign-in that has to survive the round trip to IDEN.
 *
 * Keyed by `state`, which is what makes checking it meaningful: a callback
 * carrying a `state` this process never issued is not a response to anything
 * this process asked for.
 */
export const pending = new Map<string, { verifier: string; nonce: string }>();

export function create(claims: JWTPayload, tokens: Tokens): Session {
  const access = peek(tokens.access_token);

  const session: Session = {
    id: randomUUID(),
    subject: String(claims.sub ?? ""),
    name: String(claims.name ?? claims.preferred_username ?? claims.sub ?? "Someone"),
    email: typeof claims.email === "string" ? claims.email : undefined,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    idToken: tokens.id_token,
    scope: (access.scope as string | undefined)?.split(" ").filter(Boolean) ?? [],
    acr: typeof access.acr === "string" ? access.acr : undefined,
    amr: Array.isArray(access.amr) ? (access.amr as string[]) : [],
    authTime: typeof access.auth_time === "number" ? access.auth_time : undefined,
  };

  sessions.set(session.id, session);
  return session;
}

/**
 * Replace the tokens on an existing session, keeping the session itself.
 *
 * Used by the refresh button. The person did not sign in again — the same
 * browser session now simply holds a token minted from a fresh evaluation of
 * their permissions.
 */
export function reissue(session: Session, tokens: Tokens): Session {
  const access = peek(tokens.access_token);

  session.accessToken = tokens.access_token;
  // A rotated refresh token replaces the old one, which stopped working the
  // moment this response was written.
  if (tokens.refresh_token) session.refreshToken = tokens.refresh_token;
  if (tokens.id_token) session.idToken = tokens.id_token;
  session.scope = (access.scope as string | undefined)?.split(" ").filter(Boolean) ?? [];
  session.acr = typeof access.acr === "string" ? access.acr : undefined;
  session.amr = Array.isArray(access.amr) ? (access.amr as string[]) : [];
  session.authTime = typeof access.auth_time === "number" ? access.auth_time : undefined;

  return session;
}

export const get = (id: string | undefined): Session | undefined =>
  id ? sessions.get(id) : undefined;

export const destroy = (id: string): void => void sessions.delete(id);

/** The cookie carries this id and nothing else. Named once, used everywhere. */
export const COOKIE = "door_panel_session";
