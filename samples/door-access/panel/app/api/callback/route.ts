import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/config";
import * as oidc from "@/lib/oidc";
import * as sessions from "@/lib/sessions";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const home = (query: string) => new URL(`/${query}`, config.origin);

  const failure = params.get("error");
  if (failure) {
    const detail = params.get("error_description") ?? failure;
    return NextResponse.redirect(home(`?error=${encodeURIComponent(detail)}`));
  }

  const state = params.get("state");
  const attempt = state ? sessions.pending.get(state) : undefined;
  if (!state || !attempt) {
    return NextResponse.redirect(
      home(`?error=${encodeURIComponent("The `state` does not match a request this panel made.")}`),
    );
  }
  sessions.pending.delete(state);

  const code = params.get("code");
  if (!code) {
    return NextResponse.redirect(
      home(`?error=${encodeURIComponent("No authorization code came back.")}`),
    );
  }

  try {
    const tokens = await oidc.exchange({ code, verifier: attempt.verifier });
    if (!tokens.id_token) {
      throw new Error("No ID token. Was `openid` in the requested scope?");
    }

    const claims = await oidc.verifyIdToken(tokens.id_token, attempt.nonce);
    const session = sessions.create(claims, tokens);

    if (!tokens.refresh_token) {
      console.warn(
        "[warn] No refresh token. The client needs the `refresh_token` grant and the " +
          "request needs `offline_access` — without both, the refresh button cannot work.",
      );
    }

    const response = NextResponse.redirect(home(""));
    response.cookies.set(sessions.COOKIE, session.id, {
      httpOnly: true,
      // Lax rather than Strict: the browser arrives here by top-level
      // navigation from IDEN, and Strict would withhold the cookie on exactly
      // that hop. `secure` is absent only because this demo runs on http.
      sameSite: "lax",
      path: "/",
      maxAge: 86400,
    });
    return response;
  } catch (problem) {
    const detail = problem instanceof Error ? problem.message : String(problem);
    return NextResponse.redirect(home(`?error=${encodeURIComponent(detail)}`));
  }
}
