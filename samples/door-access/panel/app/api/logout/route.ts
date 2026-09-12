import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/config";
import * as oidc from "@/lib/oidc";
import * as sessions from "@/lib/sessions";

export async function GET(request: NextRequest) {
  const id = request.cookies.get(sessions.COOKIE)?.value;
  const session = sessions.get(id);
  if (id) sessions.destroy(id);

  const url = session ? await oidc.endSessionUrl(session.idToken) : null;
  const response = NextResponse.redirect(url ? new URL(url) : new URL("/", config.origin));
  response.cookies.delete(sessions.COOKIE);
  return response;
}
