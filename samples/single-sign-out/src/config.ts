/**
 * Two applications from one file.
 *
 * `APP=portal` and `APP=library` are the same server with different
 * credentials, a different port and a different colour. Running them as two
 * processes is the whole point of the demo: nothing is shared between them
 * except the browser and IDEN, so when signing out of one ends the other, it is
 * genuinely the identity provider doing it.
 */

export interface AppIdentity {
  id: string;
  name: string;
  tagline: string;
  accent: string;
  port: number;
}

const APPS: Record<string, AppIdentity> = {
  portal: {
    id: "portal",
    name: "Campus Portal",
    tagline: "Timetable, grades, and everything else nobody reads.",
    accent: "#cc785c",
    port: 5200,
  },
  library: {
    id: "library",
    name: "Library",
    tagline: "Loans, holds, and a fine you had forgotten about.",
    accent: "#6f938c",
    port: 5201,
  },
};

const which = process.env.APP ?? "portal";
const app = APPS[which];

if (!app) {
  console.error(`APP must be one of: ${Object.keys(APPS).join(", ")}`);
  process.exit(1);
}

const port = Number(process.env.PORT ?? app.port);
const origin = process.env.ORIGIN ?? `http://localhost:${port}`;
const sibling = which === "portal" ? APPS.library! : APPS.portal!;

export const config = {
  ...app,
  port,
  origin,
  issuer: (process.env.IDEN_ISSUER ?? "http://localhost:8000").replace(/\/$/, ""),
  clientId: process.env.CLIENT_ID ?? `demo-${app.id}`,
  clientSecret: process.env.CLIENT_SECRET ?? "",
  redirectUri: `${origin}/callback`,
  postLogoutRedirectUri: `${origin}/`,
  scope: process.env.SCOPE ?? "openid profile email",
  /** The other application, so each page can link to it. */
  sibling,
};

export const SIBLING_ORIGIN =
  process.env.SIBLING_ORIGIN ?? `http://localhost:${sibling.port}`;
