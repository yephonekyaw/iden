"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import * as doors from "@/lib/doors";
import * as oidc from "@/lib/oidc";
import * as sessions from "@/lib/sessions";

/**
 * Two buttons, and both of them are server actions.
 *
 * There is no client JavaScript in this sample at all — no fetch from the
 * browser, no state hook, no bundle to speak of. A form posts, this runs, the
 * page re-renders. That is not nostalgia: it is what keeps the access token on
 * the server, and keeping the access token on the server is the argument the
 * whole sample is making.
 */

async function current(): Promise<sessions.Session | undefined> {
  const store = await cookies();
  return sessions.get(store.get(sessions.COOKIE)?.value);
}

export async function openDoor(formData: FormData): Promise<void> {
  const session = await current();
  const door = String(formData.get("door") ?? "");
  if (!session || !door) return;

  session.verdict = await doors.open(session, door);
  revalidatePath("/");
}

/**
 * Ask for a new access token with the refresh token.
 *
 * IDEN re-resolves permissions here rather than replaying the old set, so a
 * role **revoked** a moment ago disappears from the token this returns. That is
 * what makes short-lived access tokens safe to validate offline.
 *
 * It cannot go the other way. A refresh may narrow the original grant and never
 * widen it (RFC 6749 Section 6), so a permission *gained* since sign-in will not
 * appear here however many times this is pressed — that needs a new
 * authorization request, which is the button next to this one.
 */
export async function refreshTokens(): Promise<void> {
  const session = await current();
  if (!session?.refreshToken) return;

  try {
    const tokens = await oidc.refresh(session.refreshToken);
    sessions.reissue(session, tokens);
    session.verdict = undefined;
  } catch (problem) {
    session.verdict = {
      door: "—",
      allowed: false,
      status: 400,
      code: "refresh_failed",
      message: problem instanceof Error ? problem.message : String(problem),
    };
  }

  revalidatePath("/");
}
