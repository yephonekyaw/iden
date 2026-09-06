import { randomBytes } from "node:crypto";
import type { JWTPayload } from "jose";
import type { Tokens } from "./oidc.js";

/**
 * This application's own sessions.
 *
 * The point of the demo lives in `bySid`. Each application keeps its own
 * session — that is what a relying party *is* — and IDEN knows nothing about
 * this Map. What ties the two together is the `sid` claim: IDEN's name for the
 * browser session, carried in the ID token, and sent again in the logout token
 * when that session ends.
 *
 * Without an index on `sid`, a logout token arrives naming a session the
 * application cannot find, and "sign out everywhere" quietly means "sign out of
 * the tab you happened to be looking at".
 *
 * In memory, so a restart signs everyone out. A real application would put this
 * in Redis or a database and index the same column.
 */

export interface Session {
  id: string;
  sid: string | null;
  subject: string;
  name: string;
  email: string | null;
  acr: string | null;
  amr: string[];
  authTime: Date | null;
  idToken: string | undefined;
  startedAt: Date;
  /** Set when IDEN ended it rather than the person. The screen says which. */
  endedBy: string | null;
}

const byId = new Map<string, Session>();
const bySid = new Map<string, Set<string>>();

export function create(input: {
  claims: JWTPayload;
  tokens: Tokens;
  sid: string | null;
}): Session {
  const { claims, tokens, sid } = input;
  const id = randomBytes(24).toString("base64url");

  const session: Session = {
    id,
    sid,
    subject: String(claims.sub ?? ""),
    name: String(claims.name ?? claims.preferred_username ?? claims.email ?? "Signed in"),
    email: typeof claims.email === "string" ? claims.email : null,
    acr: typeof claims.acr === "string" ? claims.acr : null,
    amr: Array.isArray(claims.amr) ? (claims.amr as string[]) : [],
    authTime: typeof claims.auth_time === "number" ? new Date(claims.auth_time * 1000) : null,
    idToken: tokens.id_token,
    startedAt: new Date(),
    endedBy: null,
  };

  byId.set(id, session);
  if (sid) {
    // One IDEN session can produce several here — two browsers, or a
    // re-authentication — so this is a set rather than a single id.
    const existing = bySid.get(sid) ?? new Set<string>();
    existing.add(id);
    bySid.set(sid, existing);
  }
  return session;
}

export const get = (id: string | undefined): Session | null =>
  id ? (byId.get(id) ?? null) : null;

export function destroy(id: string): void {
  const session = byId.get(id);
  if (!session) return;
  byId.delete(id);
  if (session.sid) bySid.get(session.sid)?.delete(id);
}

/**
 * End every session IDEN's `sid` produced here. Returns how many there were —
 * the demo shows the number, because zero is the interesting failure.
 */
export function destroyBySid(sid: string, reason = "IDEN"): number {
  const ids = bySid.get(sid);
  if (!ids || ids.size === 0) return 0;

  let count = 0;
  for (const id of ids) {
    const session = byId.get(id);
    if (!session) continue;
    // Marked rather than deleted, so the page this browser is looking at can
    // say *why* it was signed out instead of silently reverting to a login
    // screen. Cleared the moment the browser has been told.
    session.endedBy = reason;
    count += 1;
  }
  return count;
}

/** Called once the browser has been told; after this the session is really gone. */
export function reap(id: string): void {
  const session = byId.get(id);
  if (session?.endedBy) destroy(id);
}

export const count = (): number => byId.size;
