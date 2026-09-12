import { NextResponse, type NextRequest } from "next/server";
import * as oidc from "@/lib/oidc";
import { pending } from "@/lib/sessions";

/**
 * Start a sign-in — and, with parameters, a step-up.
 *
 * One route serves both, because they are the same request. Proving a second
 * factor is not a different flow from signing in; it is `/authorize` with
 * `acr_values` on it, and IDEN responds by walking the person through the step
 * they are missing rather than refusing. That is the whole reason the panel can
 * recover from the server room's refusal without knowing anything about
 * authenticator apps.
 */
export async function GET(request: NextRequest) {
  const { verifier, challenge } = oidc.pkce();
  const state = oidc.random();
  const nonce = oidc.random();
  pending.set(state, { verifier, nonce });

  const acrValues = request.nextUrl.searchParams.get("acr_values") ?? undefined;
  const maxAgeRaw = request.nextUrl.searchParams.get("max_age");

  try {
    const url = await oidc.authorizeUrl({
      state,
      nonce,
      challenge,
      acrValues,
      maxAge: maxAgeRaw === null ? undefined : Number(maxAgeRaw),
    });
    return NextResponse.redirect(url);
  } catch (problem) {
    const detail = problem instanceof Error ? problem.message : String(problem);
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(detail)}`, request.nextUrl.origin),
    );
  }
}
