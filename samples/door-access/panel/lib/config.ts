/**
 * The panel is a client. It holds a secret, it starts sign-ins, and it knows
 * nothing about who may open what.
 *
 * Contrast `../api/src/config.ts`, which is the same sample's resource server
 * and needs an issuer and an audience and nothing else. The two lists are the
 * clearest statement of the difference between the two roles.
 */

const trim = (value: string) => value.replace(/\/$/, "");

const origin = trim(process.env.DOOR_PANEL_ORIGIN ?? "http://localhost:5401");

export const config = {
  origin,
  issuer: trim(process.env.IDEN_ISSUER ?? "http://localhost:8000"),
  clientId: process.env.DOOR_PANEL_CLIENT_ID ?? "demo-door-panel",
  clientSecret: process.env.DOOR_PANEL_CLIENT_SECRET ?? "",

  redirectUri: `${origin}/api/callback`,
  postLogoutRedirectUri: `${origin}/`,

  /**
   * Where this server reaches the door controller. Not a browser URL — the
   * browser never talks to the API, which is why the access token never leaves
   * this process.
   */
  api: trim(process.env.DOOR_API_ORIGIN ?? "http://localhost:5400"),

  /**
   * Every door scope is requested, every time, whoever is signing in.
   *
   * That looks wrong and is not. IDEN grants the intersection of what was asked
   * for, what this client is allowed to ask for, and what the person actually
   * holds — and prunes the rest **silently** rather than refusing. Asking for
   * everything and being given a subset is how the flow is meant to work: a
   * client that asked only for what it expected the person to have would need
   * to know that in advance, which is the question it is trying to ask.
   */
  scope: [
    "openid",
    "profile",
    "email",
    // Half of what makes a refresh possible; the client's allowed grants are
    // the other half. Without it there is no refresh token and no way to watch
    // a newly granted role take effect.
    "offline_access",
    // About IDEN itself rather than the building: lets the panel show where
    // each permission came from.
    "entity:permissions:read",
    "door:front:open",
    "door:lab:open",
    "door:server:open",
  ].join(" "),
};

if (!config.clientSecret) {
  console.warn(
    "[warn] DOOR_PANEL_CLIENT_SECRET is empty. This client is confidential, so the " +
      "token exchange will fail. IDEN shows the secret once, when the client is " +
      "registered; see 'Register the client' in the README.",
  );
}
