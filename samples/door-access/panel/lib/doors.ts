import { config } from "./config";
import type { Session, Verdict } from "./sessions";

/**
 * Talking to the door controller.
 *
 * Everything here is an ordinary HTTP call with a bearer token. There is no
 * shared library between the two processes, no shared database and no shared
 * secret — the access token is the entire interface, which is the property that
 * lets the controller be written in another language, or by another team, or by
 * somebody who has never heard of this panel.
 */

export interface Door {
  id: string;
  name: string;
  blurb: string;
  scope: string;
  acr?: string;
  maxAge?: number;
}

export async function catalogue(): Promise<{ audience: string; doors: Door[] }> {
  const response = await fetch(`${config.api}/doors`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`The door controller answered ${response.status}.`);
  }
  return (await response.json()) as { audience: string; doors: Door[] };
}

/**
 * Pull the parameters out of an RFC 6750 challenge.
 *
 * `WWW-Authenticate: Bearer error="insufficient_user_authentication", max_age=300`
 *
 * Deliberately a regex rather than a full auth-param parser: this reads one
 * header from one service, and a hundred lines of grammar here would bury the
 * point, which is that **the refusal tells you how to succeed**.
 */
function challengeParams(header: string | null): { acrValues?: string; maxAge?: number } {
  if (!header) return {};

  const acr = /acr_values="?([^",]+)"?/.exec(header);
  const age = /max_age=("?)(\d+)\1/.exec(header);

  return {
    acrValues: acr?.[1],
    maxAge: age?.[2] === undefined ? undefined : Number(age[2]),
  };
}

/**
 * Ask the controller to open a door, and record what it said.
 *
 * The panel has no opinion. It does not check the session's scopes first and
 * grey out the buttons it expects to fail — that would be the client deciding,
 * and the client deciding from data it was handed is exactly the thing this
 * sample exists to argue against. Press any door and find out.
 */
export async function open(session: Session, doorId: string): Promise<Verdict> {
  const response = await fetch(`${config.api}/doors/${doorId}/open`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.accessToken}` },
    cache: "no-store",
  });

  if (response.ok) {
    return {
      door: doorId,
      allowed: true,
      status: response.status,
      code: "ok",
      message: "Open.",
    };
  }

  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    error_description?: string;
  };

  return {
    door: doorId,
    allowed: false,
    status: response.status,
    code: body.error ?? "unknown",
    message: body.error_description ?? `The controller answered ${response.status}.`,
    ...challengeParams(response.headers.get("www-authenticate")),
  };
}
