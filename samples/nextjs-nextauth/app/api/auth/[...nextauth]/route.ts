import { handlers } from "@/auth";

/**
 * Auth.js's own routes: `/api/auth/signin`, `/callback/iden`, `/signout`, and
 * the session endpoint. Nothing here is written by hand, which is the point —
 * the redirect URI you register on the client is
 * `http://localhost:5300/api/auth/callback/iden`, and the library owns it.
 */
export const { GET, POST } = handlers;
