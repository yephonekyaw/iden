/**
 * What this service needs to know, which is remarkably little.
 *
 * An issuer to trust and an audience to be. No client id, no secret, no
 * redirect URI — this process is a resource server, not a client. It never
 * starts a sign-in and never holds a credential of its own, and the absence of
 * those settings is the clearest statement of what a resource server *is*.
 */

const trim = (value: string) => value.replace(/\/$/, "");

export const config = {
  port: Number(process.env.PORT ?? 5400),

  issuer: trim(process.env.IDEN_ISSUER ?? "http://localhost:8000"),

  /**
   * The name this API answers to, and the value every token must be addressed
   * to. It is an identifier rather than an address — IDEN never calls it, and
   * nothing dereferences it — but it has to match the `audience` registered on
   * the resource API in IDEN character for character.
   */
  audience: process.env.DOOR_AUDIENCE ?? "https://api.example.org/door",
};
